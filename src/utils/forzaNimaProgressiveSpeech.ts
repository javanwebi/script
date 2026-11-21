/** Progressive Nima playback: each received WAV frame is queued immediately,
 * while the private Piper service continues synthesizing later clauses.
 * Phrase-level lookahead remains bounded and preserves original SSE order.
 */
import type {ForzaWavPlaybackProgress} from './forzaContinuousWav';
import {
  forzaPcmWavDurationSeconds,
  type ForzaWavScheduler,
} from './forzaNimaBufferedSpeech';

interface PhraseTask {
  index: number;
  text: string;
  queuedAt: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

interface PhraseBuffer {
  text: string;
  chunks: Uint8Array[];
  durations: number[];
  nextChunk: number;
  complete: boolean;
  firstChunkReported: boolean;
  playPromises: Promise<void>[];
}

export interface ForzaNimaProgressiveOptions {
  synthesizeStream: (
    text: string,
    signal: AbortSignal,
    onChunk: (wav: Uint8Array) => void,
  ) => Promise<void>;
  player: ForzaWavScheduler;
  signal?: AbortSignal;
  maxConcurrent?: number;
  maxAheadPhrases?: number;
  initialBufferSeconds?: number;
  maximumInitialWaitMs?: number;
  onBuffered?: (info: {bufferedSeconds:number;queuedPhrases:number;started:boolean}) => void;
  onPhrasePlayed?: (phrase: string) => void;
  onPhraseProgress?: (phrase:string,info:ForzaWavPlaybackProgress) => void;
  onPhraseReady?: (info:{
    index:number;waitMs:number;fetchMs:number;wavBytes:number;durationMs:number
  })=>void;
}

export class ForzaNimaProgressiveSpeech {
  private readonly maxConcurrent: number;
  private readonly maxAheadPhrases: number;
  private readonly localAbort = new AbortController();
  private readonly signal: AbortSignal;
  private readonly onAbort = () => this.cancel();
  private readonly initialBufferSeconds: number;
  private readonly maximumInitialWaitMs: number;
  private readonly tasks: PhraseTask[] = [];
  private readonly synthesisPromises: Promise<void>[] = [];
  private readonly scheduledPromises: Promise<void>[] = [];
  private readonly phrases = new Map<number,PhraseBuffer>();
  private nextIndex = 0;
  private nextPhraseToQueue = 0;
  private active = 0;
  private outstanding = 0;
  private started = false;
  private completed = false;
  private cancelled = false;
  private initialWait: ReturnType<typeof setTimeout> | null = null;
  private totalBufferedSeconds = 0;
  private error: Error | null = null;

  constructor(private readonly options: ForzaNimaProgressiveOptions) {
    this.maxConcurrent = Math.max(1,Math.min(2,options.maxConcurrent ?? 2));
    this.maxAheadPhrases = Math.max(this.maxConcurrent,Math.min(8,options.maxAheadPhrases ?? 4));
    this.signal = options.signal
      ? AbortSignal.any([options.signal,this.localAbort.signal])
      : this.localAbort.signal;
    this.initialBufferSeconds = options.initialBufferSeconds ?? 2;
    this.maximumInitialWaitMs = options.maximumInitialWaitMs ?? 180;
    options.signal?.addEventListener('abort',this.onAbort,{once:true});
    if(options.signal?.aborted)this.cancel();
  }

  add(phrase: string): void {
    if(this.cancelled || this.options.signal?.aborted)return;
    if(this.completed)throw new Error('forza_nima_adding_after_finished');
    const text=phrase.trim();
    if(!text)return;
    if(this.nextIndex>=128)throw new Error('forza_nima_phrase_limit');
    const index=this.nextIndex++;
    let resolve!:()=>void;
    let reject!:(error:Error)=>void;
    const completion=new Promise<void>((accept,fail)=>{resolve=accept;reject=fail;});
    void completion.catch(()=>{});
    this.synthesisPromises.push(completion);
    this.phrases.set(index,{
      text,chunks:[],durations:[],nextChunk:0,complete:false,
      firstChunkReported:false,playPromises:[],
    });
    this.tasks.push({index,text,resolve,reject,queuedAt:performance.now()});
    this.startReadyJobs();
  }

  private startReadyJobs(): void {
    while(!this.cancelled && !this.error &&
      this.active<this.maxConcurrent &&
      this.outstanding<this.maxAheadPhrases &&
      this.tasks.length){
      const task=this.tasks.shift()!;
      const fetchStartedAt=performance.now();
      this.active++;
      this.outstanding++;
      void Promise.resolve().then(async()=>{
        if(this.signal.aborted || this.cancelled)throw new Error('forza_nima_aborted');
        await this.options.synthesizeStream(task.text,this.signal,wav=>{
          this.acceptChunk(task.index,wav,task.queuedAt,fetchStartedAt);
        });
        if(this.cancelled || this.signal.aborted){task.resolve();return;}
        const phrase=this.phrases.get(task.index);
        if(!phrase || !phrase.chunks.length)throw new Error('forza_nima_empty_phrase_stream');
        phrase.complete=true;
        task.resolve();
        this.maybeSchedule();
      }).catch((cause:unknown)=>{
        if(this.cancelled || this.options.signal?.aborted){task.resolve();return;}
        const error=cause instanceof Error?cause:new Error(String(cause));
        this.fail(error);
        task.reject(error);
      }).finally(()=>{
        this.active--;
        this.startReadyJobs();
      });
    }
  }

  private acceptChunk(index:number,wav:Uint8Array,queuedAt:number,fetchStartedAt:number):void {
    if(this.cancelled || this.signal.aborted)return;
    const phrase=this.phrases.get(index);
    if(!phrase)throw new Error('forza_nima_unexpected_stream_chunk');
    if(phrase.chunks.length>=48)throw new Error('forza_nima_phrase_frame_limit');
    const duration=forzaPcmWavDurationSeconds(wav);
    phrase.chunks.push(wav);
    phrase.durations.push(duration);
    this.totalBufferedSeconds+=duration;
    if(!phrase.firstChunkReported){
      phrase.firstChunkReported=true;
      this.options.onPhraseReady?.({
        index,
        waitMs:Math.max(0,Math.round(fetchStartedAt-queuedAt)),
        fetchMs:Math.max(0,Math.round(performance.now()-fetchStartedAt)),
        wavBytes:wav.byteLength,
        durationMs:Math.round(duration*1000),
      });
    }
    this.maybeSchedule();
  }

  private fail(error:Error):void {
    this.error??=error;
    this.localAbort.abort(this.error);
    this.tasks.splice(0).forEach(task=>task.reject(this.error!));
  }

  private async untilAborted<T>(work:Promise<T>):Promise<T>{
    if(this.signal.aborted)throw this.error||new Error('forza_nima_aborted');
    let abort!:()=>void;
    const stopped=new Promise<never>((_,reject)=>{
      abort=()=>reject(this.error||new Error('forza_nima_aborted'));
      this.signal.addEventListener('abort',abort,{once:true});
    });
    try{return await Promise.race([work,stopped]);}
    finally{this.signal.removeEventListener('abort',abort);}
  }

  private contiguousReady():{count:number;seconds:number}{
    let count=0,seconds=0;
    for(let index=this.nextPhraseToQueue;index<this.nextIndex;index++){
      const phrase=this.phrases.get(index);
      if(!phrase)break;
      const available=phrase.chunks.length-phrase.nextChunk;
      if(available>0){
        count++;
        for(let chunk=phrase.nextChunk;chunk<phrase.durations.length;chunk++)
          seconds+=phrase.durations[chunk];
      }
      if(!phrase.complete)break;
    }
    return {count,seconds};
  }

  private maybeSchedule(force=false):void {
    if(this.cancelled || this.error)return;
    if(!this.started){
      const ready=this.contiguousReady();
      if(!ready.count)return;
      if(!force && ready.seconds<this.initialBufferSeconds){
        if(!this.initialWait){
          this.initialWait=setTimeout(()=>{
            this.initialWait=null;
            this.maybeSchedule(true);
          },this.maximumInitialWaitMs);
        }
        this.options.onBuffered?.({
          bufferedSeconds:ready.seconds,queuedPhrases:ready.count,started:false
        });
        return;
      }
      this.started=true;
      if(this.initialWait)clearTimeout(this.initialWait);
      this.initialWait=null;
    }

    while(true){
      const index=this.nextPhraseToQueue;
      const phrase=this.phrases.get(index);
      if(!phrase)break;
      while(phrase.nextChunk<phrase.chunks.length){
        const wav=phrase.chunks[phrase.nextChunk++];
        try{
          const played=this.options.player.enqueueWav(wav,
            progress=>this.options.onPhraseProgress?.(phrase.text,progress));
          phrase.playPromises.push(played);
        }catch(error){
          this.fail(error instanceof Error?error:new Error(String(error)));
          return;
        }
      }
      if(phrase.complete && phrase.nextChunk===phrase.chunks.length){
        this.phrases.delete(index);
        this.nextPhraseToQueue++;
        const played=Promise.all(phrase.playPromises).then(()=>{
          if(!this.cancelled && !this.options.signal?.aborted && phrase.text)
            this.options.onPhrasePlayed?.(phrase.text);
        }).catch(error=>{
          if(!this.cancelled)this.fail(error instanceof Error?error:new Error(String(error)));
          throw error;
        }).finally(()=>{
          this.outstanding=Math.max(0,this.outstanding-1);
          this.startReadyJobs();
        });
        this.scheduledPromises.push(played);
        void played.catch(()=>{});
        continue;
      }
      break;
    }
    const ready=this.contiguousReady();
    this.options.onBuffered?.({
      bufferedSeconds:ready.seconds,queuedPhrases:ready.count,started:true
    });
  }

  async finish():Promise<void>{
    this.completed=true;
    if(this.cancelled || this.options.signal?.aborted)throw new Error('forza_nima_aborted');
    try{
      await this.untilAborted(Promise.all(this.synthesisPromises));
      this.maybeSchedule(true);
      if(this.error)throw this.error;
      if(this.nextPhraseToQueue!==this.nextIndex)
        throw new Error('forza_nima_audio_order_incomplete');
      await this.untilAborted(Promise.all(this.scheduledPromises));
      if(this.error)throw this.error;
    }finally{
      if(this.initialWait)clearTimeout(this.initialWait);
      this.initialWait=null;
      this.options.signal?.removeEventListener('abort',this.onAbort);
    }
  }

  cancel():void{
    this.cancelled=true;
    this.localAbort.abort();
    this.options.signal?.removeEventListener('abort',this.onAbort);
    this.completed=true;
    if(this.initialWait)clearTimeout(this.initialWait);
    this.initialWait=null;
    this.phrases.clear();
    this.tasks.splice(0).forEach(task=>task.resolve());
  }

  get statistics():{queued:number;scheduled:number;totalBufferedSeconds:number}{
    return {
      queued:this.nextIndex,
      scheduled:this.nextPhraseToQueue,
      totalBufferedSeconds:this.totalBufferedSeconds,
    };
  }
}