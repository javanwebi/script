/** CPU-friendly, in-memory lookahead for FORZA's selected Piper Nima voice.
 *
 * Receive complete Persian phrases while LLM SSE is still arriving, synthesize
 * at most two requests ahead, and schedule decoded WAVs in source order on one
 * existing AudioContext player. Never persist transcripts or generated PCM.
 *
 * Initial playback waits until roughly two seconds of speech have been prepared
 * (or a short bounded startup window elapses). This reduces late next-phrase
 * gaps without forcing a multi-second delay on short answers. The player owns
 * gap detection and sample-clock scheduling; if the LLM truly stalls longer
 * than buffered audio, no client can synthesize text that has not arrived.
 */

import type {ForzaWavPlaybackProgress} from './forzaContinuousWav';

export interface ForzaWavScheduler {
  enqueueWav(wav: Uint8Array,onProgress?: (info:ForzaWavPlaybackProgress)=>void): Promise<void>;
}

interface NimaPhraseTask {
  index: number;
  text: string;
  queuedAt: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

export interface ForzaNimaBufferedOptions {
  synthesize: (text: string, signal?: AbortSignal) => Promise<Uint8Array>;
  player: ForzaWavScheduler;
  signal?: AbortSignal;
  maxConcurrent?: number;
  maxAheadPhrases?: number;
  initialBufferSeconds?: number;
  maximumInitialWaitMs?: number;
  onBuffered?: (info: { bufferedSeconds: number; queuedPhrases: number; started: boolean }) => void;
  /** Called only after an ordered WAV source has ended without cancellation. */
  onPhrasePlayed?: (phrase: string) => void;
  onPhraseProgress?: (phrase:string,info:ForzaWavPlaybackProgress) => void;
  onPhraseReady?: (info:{
    index:number;waitMs:number;fetchMs:number;wavBytes:number;durationMs:number
  })=>void;
}

export function forzaPcmWavDurationSeconds(wav: Uint8Array): number {
  if (wav.byteLength < 44) throw new Error('forza_nima_invalid_wav');
  const view = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  const magic = (i: number) => String.fromCharCode(wav[i], wav[i+1], wav[i+2], wav[i+3]);
  if (magic(0) !== 'RIFF' || magic(8) !== 'WAVE') throw new Error('forza_nima_invalid_wav');
  // Piper currently emits standard RIFF, mono, 16-bit PCM. Read the actual
  // data chunk rather than assuming every WAV has a fixed 44-byte header.
  let offset = 12;
  let bytesPerSecond = 0;
  let dataBytes = 0;
  while (offset + 8 <= wav.byteLength) {
    const kind = magic(offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (size > wav.byteLength - start) throw new Error('forza_nima_invalid_wav_length');
    if (kind === 'fmt ' && size >= 16) {
      const pcm = view.getUint16(start, true);
      const channels = view.getUint16(start + 2, true);
      const sampleRate = view.getUint32(start + 4, true);
      const byteRate = view.getUint32(start + 8, true);
      const bits = view.getUint16(start + 14, true);
      if (pcm !== 1 || channels !== 1 || bits !== 16 ||
          sampleRate < 8000 || sampleRate > 48000 ||
          byteRate !== sampleRate * channels * bits / 8)
        throw new Error('forza_nima_unexpected_wav_format');
      bytesPerSecond = byteRate;
    }
    if (kind === 'data') dataBytes = size;
    offset = start + size + (size % 2);
  }
  if (!dataBytes || !bytesPerSecond) throw new Error('forza_nima_missing_wav_data');
  return dataBytes / bytesPerSecond;
}

export class ForzaNimaBufferedSpeech {
  private readonly maxConcurrent: number;
  private readonly maxAheadPhrases: number;
  private outstanding = 0;
  private readonly localAbort = new AbortController();
  private readonly signal: AbortSignal;
  private readonly onAbort = () => this.cancel();
  private readonly initialBufferSeconds: number;
  private readonly maximumInitialWaitMs: number;
  private readonly tasks: NimaPhraseTask[] = [];
  private readonly synthesisPromises: Promise<void>[] = [];
  private readonly scheduledPromises: Promise<void>[] = [];
  private readonly synthesized = new Map<number, Uint8Array>();
  private readonly phraseTexts = new Map<number, string>();
  private nextIndex = 0;
  private nextToQueue = 0;
  private active = 0;
  private started = false;
  private completed = false;
  private cancelled = false;
  private initialWait: ReturnType<typeof setTimeout> | null = null;
  private firstAudioReadyAt = 0;
  private totalBufferedSeconds = 0;
  private error: Error | null = null;

  constructor(private readonly options: ForzaNimaBufferedOptions) {
    this.maxConcurrent = Math.max(1, Math.min(2, options.maxConcurrent ?? 2));
    this.maxAheadPhrases = Math.max(this.maxConcurrent, Math.min(8, options.maxAheadPhrases ?? 4));
    this.signal = options.signal ? AbortSignal.any([options.signal,this.localAbort.signal]) : this.localAbort.signal;
    this.initialBufferSeconds = options.initialBufferSeconds ?? 2;
    this.maximumInitialWaitMs = options.maximumInitialWaitMs ?? 500;
    options.signal?.addEventListener('abort',this.onAbort,{once:true});
    if(options.signal?.aborted)this.cancel();
  }

  add(phrase: string): void {
    if (this.cancelled || this.options.signal?.aborted) return;
    if (this.completed) throw new Error('forza_nima_adding_after_finished');
    const text = phrase.trim();
    if (!text) return;
    if(this.nextIndex>=128)throw new Error('forza_nima_phrase_limit');
    const index = this.nextIndex++;
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    const completion = new Promise<void>((accept, fail) => {
      resolve = accept; reject = fail;
    });
    // The caller observes any rejection on finish(); ensure asynchronous
    // synthesis failures never become an unhandled promise in the meantime.
    void completion.catch(() => {});
    this.synthesisPromises.push(completion);
    this.phraseTexts.set(index,text);
    this.tasks.push({index,text,resolve,reject,queuedAt:performance.now()});
    this.startReadyJobs();
  }

  private startReadyJobs(): void {
    while (!this.cancelled && !this.error &&
           this.active < this.maxConcurrent && this.outstanding < this.maxAheadPhrases && this.tasks.length) {
      const task = this.tasks.shift()!;
      const fetchStartedAt=performance.now();
      this.active++;
      this.outstanding++;
      void Promise.resolve()
        .then(() => {
          if (this.signal.aborted || this.cancelled)
            throw new Error('forza_nima_aborted');
          return this.options.synthesize(task.text, this.signal);
        })
        .then(wav => {
          if (this.cancelled || this.signal.aborted) {
            task.resolve();
            return;
          }
          const duration = forzaPcmWavDurationSeconds(wav);
          this.options.onPhraseReady?.({
            index:task.index,
            waitMs:Math.max(0,Math.round(fetchStartedAt-task.queuedAt)),
            fetchMs:Math.round(performance.now()-fetchStartedAt),
            wavBytes:wav.byteLength,
            durationMs:Math.round(duration*1000),
          });
          this.totalBufferedSeconds += duration;
          this.synthesized.set(task.index, wav);
          task.resolve();
          this.maybeSchedule();
        })
        .catch((cause: unknown) => {
          if(this.cancelled || this.options.signal?.aborted){task.resolve();return;}
          const error = cause instanceof Error ? cause : new Error(String(cause));
          this.fail(error);
          task.reject(error);
        })
        .finally(() => {
          this.active--;
          this.startReadyJobs();
        });
    }
  }

  private fail(error:Error):void {
    this.error ??= error;
    this.localAbort.abort(this.error);
    this.tasks.splice(0).forEach(task=>task.reject(this.error!));
  }

  private async untilAborted<T>(work:Promise<T>):Promise<T>{
    if(this.signal.aborted)throw this.error || new Error('forza_nima_aborted');
    let abort!:()=>void;
    const stopped=new Promise<never>((_,reject)=>{abort=()=>reject(this.error || new Error('forza_nima_aborted'));this.signal.addEventListener('abort',abort,{once:true});});
    try{return await Promise.race([work,stopped]);}
    finally{this.signal.removeEventListener('abort',abort);}
  }

  private contiguousReady(): { count: number; seconds: number } {
    let seconds = 0;
    let count = 0;
    for (let index = this.nextToQueue; this.synthesized.has(index); index++) {
      seconds += forzaPcmWavDurationSeconds(this.synthesized.get(index)!);
      count++;
    }
    return {count,seconds};
  }

  private maybeSchedule(force = false): void {
    if (this.cancelled || this.error) return;
    if (!this.started) {
      const ready = this.contiguousReady();
      if (!ready.count) return;
      if (!this.firstAudioReadyAt) this.firstAudioReadyAt = Date.now();
      if (!force && ready.seconds < this.initialBufferSeconds) {
        if (!this.initialWait) {
          this.initialWait = setTimeout(() => {
            this.initialWait = null;
            this.maybeSchedule(true);
          }, this.maximumInitialWaitMs);
        }
        this.options.onBuffered?.({bufferedSeconds:ready.seconds,queuedPhrases:ready.count,started:false});
        return;
      }
      this.started = true;
      if (this.initialWait) clearTimeout(this.initialWait);
      this.initialWait = null;
    }
    const ready = this.contiguousReady();
    for (let i = 0; i < ready.count; i++) {
      const index=this.nextToQueue;
      const audio = this.synthesized.get(index)!;
      const phrase=this.phraseTexts.get(index)||'';
      this.synthesized.delete(this.nextToQueue++);
      this.phraseTexts.delete(index);
      try {
        const played = this.options.player.enqueueWav(audio,
          progress => this.options.onPhraseProgress?.(phrase,progress));
        this.scheduledPromises.push(played);
        void played.then(()=>{
          if(!this.cancelled && !this.options.signal?.aborted && phrase)
            this.options.onPhrasePlayed?.(phrase);
        }).catch(error => {
          if(!this.cancelled)this.fail(error instanceof Error ? error : new Error(String(error)));
        }).finally(()=>{
          this.outstanding=Math.max(0,this.outstanding-1);
          this.startReadyJobs();
        });
      } catch (error) {
        this.fail(error instanceof Error ? error : new Error(String(error)));
      }
    }
    this.options.onBuffered?.({bufferedSeconds:ready.seconds,queuedPhrases:ready.count,started:true});
  }

  /** Call only after authoritative SSE done (never at transient connection EOF).
   * Waits for every synthesized phrase and actual audio playback to finish.
   */
  async finish(): Promise<void> {
    this.completed = true;
    if (this.cancelled || this.options.signal?.aborted) throw new Error('forza_nima_aborted');
    try {
      await this.untilAborted(Promise.all(this.synthesisPromises));
      this.maybeSchedule(true);
      if (this.error) throw this.error;
      if (this.nextToQueue !== this.nextIndex)
        throw new Error('forza_nima_audio_order_incomplete');
      await this.untilAborted(Promise.all(this.scheduledPromises));
      if (this.error) throw this.error;
    } finally {
      if (this.initialWait) clearTimeout(this.initialWait);
      this.initialWait = null;
      this.options.signal?.removeEventListener('abort',this.onAbort);
    }
  }

  cancel(): void {
    this.cancelled = true;
    this.localAbort.abort();
    this.options.signal?.removeEventListener('abort',this.onAbort);
    this.completed = true;
    if (this.initialWait) clearTimeout(this.initialWait);
    this.initialWait = null;
    this.synthesized.clear();
    this.phraseTexts.clear();
    this.tasks.splice(0).forEach(task => task.resolve());
  }

  get statistics(): { queued: number; scheduled: number; totalBufferedSeconds: number } {
    return {queued:this.nextIndex,scheduled:this.nextToQueue,totalBufferedSeconds:this.totalBufferedSeconds};
  }
}
