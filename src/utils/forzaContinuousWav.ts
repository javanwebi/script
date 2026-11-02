/** Sample-accurate scheduling of Pocket WAV segments.
 * This intentionally does not change the neural TTS engine. It eliminates
 * HTMLAudioElement pause/reopen gaps by scheduling decoded buffers against one
 * AudioContext clock. A slow synthesizer may still cause buffer underrun.
 */
/** Remove only true low-amplitude padding, never mid-sentence pauses.
 * Piper can emit several seconds of trailing PCM silence. Previous trimming
 * stopped after 240ms, leaving FORZA marked "speaking" long after audible
 * speech ended. Retain 60ms at either edge for quiet Persian consonants. */
export function pocketWavWindow(buffer:AudioBuffer):{offset:number;duration:number}{
  const entire={offset:0,duration:buffer.duration};
  if(!buffer.length||!buffer.sampleRate||typeof buffer.getChannelData!=='function'||buffer.duration<0.35)return entire;
  const pcm=buffer.getChannelData(0);
  const length=pcm.length;
  const step=Math.max(1,Math.round(buffer.sampleRate/200));
  const threshold=0.0015;
  const leadingLimit=Math.min(Math.round(buffer.sampleRate*0.24),Math.floor(length*0.24));
  // Inspect at most the last twelve seconds in 20ms PCM windows. Piper
  // sometimes ends a WAV with a near-silent noise floor, not digital zeros;
  // amplitude spikes are a poor proxy for speech. Windowed RMS plus a
  // relative threshold identifies the last meaningful audible phoneme.
  const trailingLimit=Math.min(
    Math.round(buffer.sampleRate*12),
    Math.max(0,length-Math.round(buffer.sampleRate*0.15)),
  );
  let begin=0,finish=length;
  const audible=(a:number,b:number)=>{
    for(let i=a;i<b;i+=4)if(Math.abs(pcm[i])>=threshold)return true;
    return false;
  };
  while(begin+step<leadingLimit&&!audible(begin,Math.min(begin+step,length)))begin+=step;

  const frame=Math.max(1,Math.round(buffer.sampleRate*0.02));
  const tailStart=Math.max(0,length-trailingLimit);
  const frames:{start:number,end:number,rms:number}[]=[];
  let strongest=0;
  for(let pos=tailStart;pos<length;pos+=frame){
    const end=Math.min(length,pos+frame);
    let energy=0,count=0;
    for(let i=pos;i<end;i+=3){energy+=pcm[i]*pcm[i];count++;}
    const rms=Math.sqrt(energy/Math.max(1,count));
    frames.push({start:pos,end,rms});
    strongest=Math.max(strongest,rms);
  }
  if(strongest<threshold){
    // Fully silent WAVs have no speech boundary to detect; preserve them
    // rather than fabricating an audible beginning/end.
    if(!audible(0,length))return entire;
  }
  const speechFloor=Math.max(threshold,Math.min(0.018,strongest*0.10));
  for(let i=frames.length-1;i>=0;i--){
    if(frames[i].rms>=speechFloor){
      finish=frames[i].end;
      break;
    }
  }
  if(begin===0&&finish===length)return entire;
  // Preserve the established leading margin (30ms) and 80ms for
  // quiet Persian word endings, avoiding clipped consonants.
  begin=Math.max(0,begin-Math.round(buffer.sampleRate*0.03));
  finish=Math.min(length,finish+Math.round(buffer.sampleRate*0.08));
  if(finish-begin<buffer.sampleRate*0.15)return entire;
  return {offset:begin/buffer.sampleRate,duration:(finish-begin)/buffer.sampleRate};
}

export class ForzaContinuousWav {
  private scheduleTail: Promise<void> = Promise.resolve();
  private nextStart = 0;
  private sources = new Set<AudioBufferSourceNode>();
  private pending = new Set<() => void>();
  private closed = false;
  private gain: GainNode | null = null;
  private muted = false;
  private underflows = 0;
  constructor(
    private readonly getContext: () => AudioContext | null,
    private readonly onPlaying: () => void,
    private readonly onUnderrun?: (ms:number) => void,
    private readonly onPlaybackIdle?: () => void,
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
      source.onended=()=>{
        this.sources.delete(source);
        source.disconnect();
        finish();
        // The browser's actual audio source end, not SSE done / TTS HTTP
        // completion, owns the "speaking" indicator. More audio can still
        // arrive later; that remains an in-progress AI turn, not listening.
        if(!this.closed && this.sources.size===0)this.onPlaybackIdle?.();
      };
      source.start(startAt,trimmed.offset,trimmed.duration);
      this.onPlaying();
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
