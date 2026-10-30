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
  private pending = new Set<() => void>();
  private closed = false;
  private gain: GainNode | null = null;
  private muted = false;
  private underflows = 0;
  constructor(
    private readonly getContext: () => AudioContext | null,
    private readonly onPlaying: () => void,
    private readonly onUnderrun?: (ms:number) => void,
  ) {}

  enqueue(wavUrl: string): Promise<void> {
    if (this.closed) return Promise.resolve();
    let resolveFinished!: () => void;
    let rejectFinished!: (error:Error) => void;
    const finished = new Promise<void>((resolve,reject)=> {
      resolveFinished=resolve;rejectFinished=reject;
    });
    let settled = false;
    const finish = (error?:Error) => {
      if(settled)return;
      settled=true;
      this.pending.delete(cancel);
      if(error)rejectFinished(error);
      else resolveFinished();
    };
    const cancel=()=>finish();
    this.pending.add(cancel);
    this.scheduleTail=this.scheduleTail.then(async()=>{
      if(this.closed){finish();return;}
      const ctx=this.getContext();
      if(!ctx)throw new Error('forza_audio_context_unavailable');
      if(ctx.state==='suspended')await ctx.resume();
      if(this.closed){finish();return;}
      if(ctx.state!=='running')throw new Error('forza_audio_context_suspended');
      const response=await fetch(wavUrl);
      if(!response.ok)throw new Error('forza_wav_unavailable');
      const decoded=await ctx.decodeAudioData(await response.arrayBuffer());
      if(this.closed){finish();return;}
      if(!decoded.duration || !Number.isFinite(decoded.duration))
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
      // Count genuine starvation only if audio was already scheduled.
      if(this.nextStart>0 && earliest>this.nextStart+0.025){
        this.underflows++;
        this.onUnderrun?.(Math.round((earliest-this.nextStart)*1000));
      }
      const startAt=Math.max(earliest,this.nextStart);
      this.nextStart=startAt+trimmed.duration;
      source.onended=()=>{
        this.sources.delete(source);
        source.disconnect();
        finish();
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
