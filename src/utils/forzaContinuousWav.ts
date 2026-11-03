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

export class ForzaContinuousWav {
  private scheduleTail: Promise<void> = Promise.resolve();
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private playbackTimers = new Set<ReturnType<typeof setTimeout>>();
  private audibleSources = new Set<AudioBufferSourceNode>();
  private playbackState: 'idle' | 'playing' | 'buffering' | 'blocked' | 'muted' = 'idle';
  private playedDuration = 0;
  private playbackSlices = new Map<AudioBufferSourceNode,{start:number;duration:number;started:boolean}>();
  private pending = new Set<() => void>();
  private closed = false;
  private gain: GainNode | null = null;
  private muted = false;
  private underflows = 0;
  constructor(
    private readonly getContext: () => AudioContext | null,
    private readonly onPlaying: () => void,
    private readonly onUnderrun?: (ms:number) => void,
    private readonly onPlaybackState?: (state:'idle'|'playing'|'buffering'|'blocked'|'muted') => void,
  ) {}

  private publish(state: 'idle'|'playing'|'buffering'|'blocked'|'muted'): void {
    if (this.closed || this.playbackState === state) return;
    this.playbackState = state;
    this.onPlaybackState?.(state);
  }

  // AudioContext's clock (not setTimeout or AudioBufferSource.start) is
  // authoritative for the playing indicator. This cannot prove that the
  // physical speaker is audible, but prevents false scheduled playback.
  private monitorStart(source:AudioBufferSourceNode,ctx:AudioContext,startAt:number):void {
    const poll=()=>{
      this.playbackTimers.delete(timer);
      if(this.closed || !this.sources.has(source))return;
      if(ctx.state !== 'running'){
        this.publish('blocked');
        timer=setTimeout(poll,80);
        this.playbackTimers.add(timer);
        return;
      }
      if(ctx.currentTime + 0.006 < startAt){
        timer=setTimeout(poll,Math.max(10,Math.min(45,Math.ceil((startAt-ctx.currentTime)*1000))));
        this.playbackTimers.add(timer);
        return;
      }
      const slice=this.playbackSlices.get(source);
      if(slice) slice.started=true;
      this.audibleSources.add(source);
      if(this.muted)this.publish('muted');
      else {
        this.publish('playing');
        this.onPlaying();
      }
    };
    let timer:ReturnType<typeof setTimeout>=setTimeout(poll,0);
    this.playbackTimers.add(timer);
  }

  /** Decode a server frame immediately, in parallel with the previous frame.
   * Only sample-accurate scheduling is serialized, so network/decode latency
   * cannot add avoidable gaps between already-generated Pocket frames.
   */
  enqueueWav(wav:Uint8Array):Promise<void>{
    if(this.closed)return Promise.resolve();
    const ctx=this.getContext();
    if(!ctx)return Promise.reject(new Error('forza_audio_context_unavailable'));
    const copy=new Uint8Array(wav.byteLength);
    copy.set(wav);
    const decoded=ctx.decodeAudioData(copy.buffer);
    return this.enqueueDecoded(decoded);
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

  private enqueueDecoded(decodedPromise:Promise<AudioBuffer>):Promise<void>{
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
      this.playbackSlices.set(source,{start:startAt,duration:trimmed.duration,started:false});
      source.onended=()=>{
        this.sources.delete(source);
        this.audibleSources.delete(source);
        const item=this.playbackSlices.get(source);
        if(item?.started){
          this.playedDuration += Math.max(0,Math.min(item.duration,ctx.currentTime-item.start));
        }
        this.playbackSlices.delete(source);
        source.disconnect();
        if(!this.closed && !this.audibleSources.size)
          this.publish(this.muted?'muted':'buffering');
        finish();
      };
      source.start(startAt,trimmed.offset,trimmed.duration);
      this.monitorStart(source,ctx,startAt);
    }).catch(error=>finish(error instanceof Error?error:new Error(String(error))));
    return finished;
  }

  get underrunCount(){return this.underflows;}
  get playedSeconds():number {
    let seconds=this.playedDuration;
    const ctx=this.getContext();
    if(ctx){
      for(const item of this.playbackSlices.values())
        if(item.started) seconds+=Math.max(0,Math.min(item.duration,ctx.currentTime-item.start));
    }
    return seconds;
  }
  get isActuallyPlaying():boolean {
    return !this.closed && !this.muted && this.audibleSources.size>0 &&
      this.getContext()?.state==='running';
  }
  setMuted(muted:boolean):void {
    this.muted=muted;
    if(this.gain)this.gain.gain.value=muted?0:1;
    if(!this.closed && this.audibleSources.size) this.publish(muted?'muted':'playing');
  }

  cancel():void {
    if(this.closed)return;
    this.closed=true;
    this.nextStart=0;
    for(const timer of this.playbackTimers)clearTimeout(timer);
    this.playbackTimers.clear();
    // Report the fractional elapsed audio for interrupted-turn context.
    this.playedDuration=this.playedSeconds;
    this.playbackSlices.clear();
    this.audibleSources.clear();
    for(const source of this.sources){
      try{source.stop();}catch{}
      try{source.disconnect();}catch{}
    }
    this.sources.clear();
    try{this.gain?.disconnect();}catch{}
    this.gain=null;
    for(const resolve of [...this.pending])resolve();
    this.pending.clear();
  }
}
