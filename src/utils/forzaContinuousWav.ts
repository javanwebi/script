/** Sample-accurate scheduling of Pocket WAV segments.
 * This intentionally does not change the neural TTS engine. It eliminates
 * HTMLAudioElement pause/reopen gaps by scheduling decoded buffers against one
 * AudioContext clock. A slow synthesizer may still cause buffer underrun.
 */
/** Clip only quiet leading/trailing padding generated around isolated WAV
 * clauses. Keep a 30 ms safety margin to protect weak Persian consonants. */
export function pocketWavWindow(buffer:AudioBuffer):{offset:number;duration:number}{
  const entire={offset:0,duration:buffer.duration};
  if(!buffer.length||!buffer.sampleRate||typeof buffer.getChannelData!=='function'||buffer.duration<0.35)return entire;
  const pcm=buffer.getChannelData(0);
  const length=pcm.length;
  const step=Math.max(1,Math.round(buffer.sampleRate/200));
  const threshold=0.0015;
  const maxTrim=Math.min(Math.round(buffer.sampleRate*0.24),Math.floor(length*0.24));
  let begin=0,finish=length;
  const audible=(a:number,b:number)=>{
    for(let i=a;i<b;i+=4)if(Math.abs(pcm[i])>=threshold)return true;
    return false;
  };
  while(begin+step<maxTrim&&!audible(begin,Math.min(begin+step,length)))begin+=step;
  while(finish-step>length-maxTrim&&!audible(finish-step,finish))finish-=step;
  if(begin===0&&finish===length)return entire;
  // If the sample is effectively silent, do not shrink it into zero duration.
  if(!audible(begin,finish))return entire;
  const padding=Math.round(buffer.sampleRate*0.03);
  begin=Math.max(0,begin-padding);
  finish=Math.min(length,finish+padding);
  if(finish-begin<buffer.sampleRate*0.15)return entire;
  return {offset:begin/buffer.sampleRate,duration:(finish-begin)/buffer.sampleRate};
}

export interface ForzaWavPlaybackProgress {
  phase: 'started' | 'finished' | 'interrupted';
  playedMs: number;
  durationMs: number;
}

export class ForzaContinuousWav {
  private scheduleTail: Promise<void> = Promise.resolve();
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private progress = new Map<AudioBufferSourceNode,{
    startsAt:number; durationMs:number; onProgress?: (event:ForzaWavPlaybackProgress)=>void;
    started:boolean;
  }>();
  private startedSources = new Set<AudioBufferSourceNode>();
  private startTimers = new Set<ReturnType<typeof setTimeout>>();
  private pending = new Set<() => void>();
  private closed = false;
  private gain: GainNode | null = null;
  private muted = false;
  private underflows = 0;
  constructor(
    private readonly getContext: () => AudioContext | null,
    private readonly onPlaying: () => void,
    private readonly onUnderrun?: (ms:number) => void,
    private readonly onIdle?: () => void,
    private readonly onStage?: (stage:string, elapsedMs:number) => void,
  ) {}

  /** Decode a server frame immediately, in parallel with the previous frame.
   * Only sample-accurate scheduling is serialized, so network/decode latency
   * cannot add avoidable gaps between already-generated Pocket frames.
   */
  enqueueWav(wav:Uint8Array,onProgress?: (event:ForzaWavPlaybackProgress)=>void):Promise<void>{
    if(this.closed)return Promise.resolve();
    const ctx=this.getContext();
    if(!ctx)return Promise.reject(new Error('forza_audio_context_unavailable'));
    const copy=new Uint8Array(wav.byteLength);
    copy.set(wav);
    const decodeStarted=performance.now();
    const decoded=ctx.decodeAudioData(copy.buffer).then(result=>{
      this.onStage?.('decode_ready',Math.round(performance.now()-decodeStarted));
      return result;
    });
    return this.enqueueDecoded(decoded,onProgress);
  }

  /** Compatibility path for an already cached same-origin/blob WAV URL. */
  enqueue(wavUrl:string):Promise<void>{
    if(this.closed)return Promise.resolve();
    const ctx=this.getContext();
    if(!ctx)return Promise.reject(new Error('forza_audio_context_unavailable'));
    const decoded=(async()=>{
      const response=await fetch(wavUrl);
      if(!response.ok)throw new Error('forza_wav_unavailable');
      return await ctx.decodeAudioData(await response.arrayBuffer());
    })();
    return this.enqueueDecoded(decoded);
  }

  private enqueueDecoded(decodedPromise:Promise<AudioBuffer>,
    onProgress?: (event:ForzaWavPlaybackProgress)=>void):Promise<void>{
    let resolveFinished!:()=>void;
    let rejectFinished!:(error:Error)=>void;
    const finished=new Promise<void>((resolve,reject)=>{
      resolveFinished=resolve;rejectFinished=reject;
    });
    let settled=false;
    const finish=(error?:Error)=>{
      if(settled)return;
      settled=true;
      this.pending.delete(cancel);
      if(error)rejectFinished(error);
      else resolveFinished();
    };
    const cancel=()=>finish();
    this.pending.add(cancel);
    // Attach a rejection handler immediately; the ordered scheduler below
    // still observes and reports the original decode failure.
    void decodedPromise.catch(()=>{});
    this.scheduleTail=this.scheduleTail.then(async()=>{
      if(this.closed){finish();return;}
      const ctx=this.getContext();
      if(!ctx)throw new Error('forza_audio_context_unavailable');
      if(ctx.state==='suspended')await ctx.resume();
      if(this.closed){finish();return;}
      if(ctx.state!=='running')throw new Error('forza_audio_context_suspended');
      const decoded=await decodedPromise;
      if(this.closed){finish();return;}
      if(!decoded.duration||!Number.isFinite(decoded.duration))
        throw new Error('forza_wav_empty');
      const source=ctx.createBufferSource();
      source.buffer=decoded;
      const trimmed=pocketWavWindow(decoded);
      if(!this.gain){
        this.gain=ctx.createGain();
        this.gain.gain.value=this.muted?0:1;
        this.gain.connect(ctx.destination);
      }
      source.connect(this.gain);
      this.sources.add(source);
      const earliest=ctx.currentTime+0.025;
      if(this.nextStart>0&&earliest>this.nextStart+0.025){
        this.underflows++;
        this.onUnderrun?.(Math.round((earliest-this.nextStart)*1000));
      }
      const startAt=Math.max(earliest,this.nextStart);
      this.nextStart=startAt+trimmed.duration;
      const progress={startsAt:startAt,durationMs:trimmed.duration*1000,onProgress,started:false};
      this.progress.set(source,progress);
      let startTimer:ReturnType<typeof setTimeout>|null=null;
      source.onended=()=>{
        if(startTimer!==null){
          clearTimeout(startTimer);
          this.startTimers.delete(startTimer);
        }
        this.startedSources.delete(source);
        this.sources.delete(source);
        this.progress.delete(source);
        if(!this.closed)progress.onProgress?.({phase:'finished',
          playedMs:progress.durationMs,durationMs:progress.durationMs});
        source.disconnect();
        finish();
        if(!this.closed && this.startedSources.size===0){
          // A missing future WAV means buffering, not audible speech.
          this.onIdle?.();
          this.onStage?.('playback_idle',0);
        }
      };
      source.start(startAt,trimmed.offset,trimmed.duration);
      this.onStage?.('audio_scheduled',Math.round((startAt-ctx.currentTime)*1000));
      // Scheduling a future WebAudio source is NOT evidence that it started.
      // Start status follows its AudioContext clock time, not fetch/decode.
      startTimer=setTimeout(()=>{
        if(startTimer!==null)this.startTimers.delete(startTimer);
        if(this.closed || !this.sources.has(source))return;
        if(ctx.state!=='running'){
          this.onStage?.('audio_context_'+ctx.state,0);
          return;
        }
        this.startedSources.add(source);
        progress.started=true;
        progress.onProgress?.({phase:'started',playedMs:0,durationMs:progress.durationMs});
        this.onStage?.('playback_started',0);
        this.onPlaying();
      },Math.max(0,(startAt-ctx.currentTime)*1000));
      this.startTimers.add(startTimer);
    }).catch(error=>finish(error instanceof Error?error:new Error(String(error))));
    return finished;
  }

  get underrunCount(){return this.underflows;}
  setMuted(muted:boolean):void {
    this.muted=muted;
    if(this.gain)this.gain.gain.value=muted?0:1;
  }

  cancel():void {
    if(this.closed)return;
    this.closed=true;
    this.nextStart=0;
    for(const timer of this.startTimers)clearTimeout(timer);
    this.startTimers.clear();
    this.startedSources.clear();
    const ctx=this.getContext();
    for(const source of this.sources){
      const meta=this.progress.get(source);
      if(meta){
        const playedMs=meta.started && ctx
          ? Math.max(0,Math.min(meta.durationMs,(ctx.currentTime-meta.startsAt)*1000)) : 0;
        meta.onProgress?.({phase:'interrupted',playedMs,durationMs:meta.durationMs});
      }
      source.onended=null;
      try{source.stop();}catch{}
      try{source.disconnect();}catch{}
    }
    this.sources.clear();
    this.progress.clear();
    try{this.gain?.disconnect();}catch{}
    this.gain=null;
    for(const resolve of [...this.pending])resolve();
    this.pending.clear();
  }
}
