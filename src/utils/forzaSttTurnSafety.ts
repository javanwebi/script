/** A compressed recording is indivisible: reject its audio fallback if any
 * part overlapped speaker output. Admitted live words remain usable. */
export class ForzaRecordingSafety {
  private contaminated=false;
  reset(){this.contaminated=false;}
  observe(playing:boolean,recentPlayback:boolean){
    this.contaminated ||= playing || recentPlayback;
  }
  get safe(){return !this.contaminated;}
}
export class ForzaSttFailure extends Error {
  constructor(public code:string,message:string){super(message);this.name='ForzaSttFailure';}
}
export function forzaSttFailure(status:number,code:string){
  if(status===422&&code==='stt_no_transcript')return new ForzaSttFailure(code,'گفتار واضحی در این بخش پیدا نشد؛ گوش می‌دهم، دوباره صحبت کنید.');
  if(status===429||code==='stt_rate_limited')return new ForzaSttFailure('stt_busy','تشخیص گفتار موقتاً شلوغ است؛ لطفاً دوباره تلاش کنید.');
  return new ForzaSttFailure('stt_unavailable','ارتباط تشخیص گفتار کامل نشد؛ لطفاً دوباره صحبت کنید یا پیام را تایپ کنید.');
}
