/** A fixed Nima acknowledgement, warmed once per call and kept only in RAM.
 * No LLM, no post-stop synthesis request, and no queued acknowledgement after
 * the customer resumes. If warming fails, the call keeps listening silently.
 */
export class ForzaStopAcknowledgement {
  private bytes:Uint8Array|null=null;
  private warmAbort=new AbortController();
  private warming:Promise<void>|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;
  private playback:AbortController|null=null;
  private disposed=false;
  constructor(private synthesize:(signal:AbortSignal)=>Promise<Uint8Array>){}
  warm():Promise<void>{
    if(this.disposed)return Promise.resolve();
    return this.warming??=this.synthesize(this.warmAbort.signal).then(bytes=>{
      if(!this.disposed&&!this.warmAbort.signal.aborted)this.bytes=bytes;
    }).catch(()=>{});
  }
  request(play:(bytes:Uint8Array,controller:AbortController)=>Promise<void>,graceMs=180):boolean{
    this.cancel();
    const bytes=this.bytes;
    if(this.disposed||!bytes)return false;
    this.timer=setTimeout(()=>{
      this.timer=null;
      if(this.disposed)return;
      const controller=new AbortController();
      this.playback=controller;
      void play(bytes,controller).catch(()=>{}).finally(()=>{
        if(this.playback===controller)this.playback=null;
      });
    },graceMs);
    return true;
  }
  cancel(){
    if(this.timer!==null)clearTimeout(this.timer);
    this.timer=null;
    this.playback?.abort();this.playback=null;
  }
  dispose(){this.disposed=true;this.cancel();this.warmAbort.abort();this.bytes=null;}
}
