/** Sample-accurate scheduling of Pocket WAV segments.
 * This intentionally does not change the neural TTS engine. It eliminates
 * HTMLAudioElement pause/reopen gaps by scheduling decoded buffers against one
 * AudioContext clock. A slow synthesizer may still cause buffer underrun.
 */
/** Piper occasionally produces 2–5 seconds of *silent PCM after the final
 * audible word*. AudioBufferSource.onended waits for ALL PCM including that
 * padding; with the previous 240ms trim limit, FORZA showed "speaking" for
 * seconds after the user heard the last word. Trim long silence, never words.
 *
 * Use a low adaptive amplitude threshold and 80ms trailing consonant margin.
 * Keep at least 150ms of material and do not touch missing/fully silent PCM.
 * Only the WAV play window changes — the original model and bytes in memory
 * remain unchanged. All frames use this for one uninterrupted AudioContext.
 */
export function pocketWavWindow(buffer:AudioBuffer):{offset:number;duration:number}{
  const entire={offset:0,duration:buffer.duration};
  if(!buffer.length||!buffer.sampleRate||
     typeof buffer.getChannelData!=='function'||buffer.duration<0.35)return entire;
  const pcm=buffer.getChannelData(0);
  if(!pcm||!pcm.length)return entire;
  const sampleRate=buffer.sampleRate, length=pcm.length;
  const bin=Math.max(1,Math.round(sampleRate*0.01));
  let peak=0;
  // Sample every fourth PCM frame; Nima speech is far above floating point
  // noise, and this low-cost measurement runs only once per finished WAV.
  for(let i=0;i<length;i+=4)peak=Math.max(peak,Math.abs(pcm[i]));
  if(peak<0.001)return entire;
  const threshold=Math.max(0.0008,Math.min(0.0025,peak*0.009));
  const audible=(from:number,to:number)=>{
    for(let i=from;i<to;i+=2)
      if(Math.abs(pcm[i])>=threshold)return true;
    return false;
  };
  const paddingStart=Math.round(sampleRate*0.04);
  const paddingEnd=Math.round(sampleRate*0.07);
  // Allow several seconds of dead-air from VITS/Piper (not just 240ms).
  // The word edge must be audible; preserve the last 80ms near that edge.
  const maxTail=Math.min(Math.round(sampleRate*8),length-Math.round(sampleRate*0.15));
  let end=length, removed=0;
  while(removed+bin<=maxTail &&
        !audible(Math.max(0,end-bin),end)) {
    end-=bin;removed+=bin;
  }
  end=Math.min(length,end+paddingEnd);

  let start=0;
  const maxLead=Math.min(Math.round(sampleRate*1.2),Math.floor(length*0.45));
  while(start+bin<maxLead && !audible(start,start+bin))start+=bin;
  start=Math.max(0,start-paddingStart);
  if(end-start<Math.round(sampleRate*0.15))return entire;
  return {offset:start/sampleRate,duration:(end-start)/sampleRate};
}

export class ForzaContinuousWav {
  private scheduleTail: Promise<void> = Promise.resolve();
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private pending = new Set<() => void>();
  private scheduledStartTimers = new Set<ReturnType<typeof setTimeout>>();
  private closed = false;
  private gain: GainNode | null = null;
  private muted = false;
  private underflows = 0;
  constructor(
    private readonly getContext: () => AudioContext | null,
    private readonly onPlaying: () => void,
    private readonly onUnderrun?: (ms:number) => void,
    private readonly onPlaybackDrained?: () => void,
  ) {}

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
      const paddingRemovedMs=Math.max(0,Math.round((decoded.duration-trimmed.offset-trimmed.duration)*1000));
      if(paddingRemovedMs>=250)console.info('[FORZA_AUDIO_TRIM] trailing_silence_ms='+paddingRemovedMs);
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
      let startTimer:ReturnType<typeof setTimeout>|null=null;
      source.onended=()=>{
        if(startTimer!==null){
          clearTimeout(startTimer);
          this.scheduledStartTimers.delete(startTimer);
          startTimer=null;
        }
        this.sources.delete(source);
        source.disconnect();
        finish();
        // Actual PCM ended, not just source.start() being scheduled for the
        // future. A full turn may still be synthesizing its next phrase.
        if(!this.closed && this.sources.size===0)
          this.onPlaybackDrained?.();
      };
      source.start(startAt,trimmed.offset,trimmed.duration);
      // source.start(futureTime) only schedules audio. Earlier code announced
      // "speaking" right now, even for a segment several seconds in the
      // future, leaving the UI stuck while no voice was audible.
      const untilStartMs=Math.max(0,Math.round((startAt-ctx.currentTime)*1000));
      if(untilStartMs<=60)this.onPlaying();
      else {
        startTimer=setTimeout(()=>{
          this.scheduledStartTimers.delete(startTimer!);
          startTimer=null;
          if(!this.closed&&this.sources.has(source))this.onPlaying();
        },untilStartMs);
        this.scheduledStartTimers.add(startTimer);
      }
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
    for(const timer of this.scheduledStartTimers)clearTimeout(timer);
    this.scheduledStartTimers.clear();
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
