import {useRef,useState} from 'react';
import type {PointerEvent,KeyboardEvent} from 'react';
import {validImageRegion,type ImageRegion} from '../../utils/imageRegion';
import {findImageRegionAtPoint,type ImagePoint} from '../../utils/imageRegionInteraction';

function sameRegion(a?:ImageRegion,b?:ImageRegion){
 return !!a&&!!b&&Math.abs(a.x-b.x)<0.002&&Math.abs(a.y-b.y)<0.002&&Math.abs(a.width-b.width)<0.002&&Math.abs(a.height-b.height)<0.002;
}
function toPersianNumber(value:number){return String(value).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);}

interface Props {
 src:string;
 value?:ImageRegion;
 candidateRegions?:ImageRegion[];
 onChange:(region:ImageRegion|undefined)=>void;
 onSelectPoint?:(point:ImagePoint)=>void;
 selectionBusy?:boolean;
 selectionError?:string;
 onFullImageSearch?:()=>void;
}

export function ImageRegionSelector({
 src,value,candidateRegions=[],onChange,onSelectPoint,selectionBusy=false,selectionError,onFullImageSearch,
}:Props){
 const start=useRef<{clientX:number;clientY:number}|null>(null);
 const [aspect,setAspect]=useState(1);
 const candidates=candidateRegions.filter(validImageRegion);
 const selected=value;
 const point=(event:PointerEvent<HTMLDivElement>):ImagePoint|null=>{
  const box=event.currentTarget.getBoundingClientRect();
  if(box.width<=0||box.height<=0)return null;
  const x=(event.clientX-box.left)/box.width;
  const y=(event.clientY-box.top)/box.height;
  if(x<0||x>1||y<0||y>1)return null;
  return {x,y};
 };
 const finish=(event:PointerEvent<HTMLDivElement>)=>{
  if(!start.current)return;
  const origin=start.current;
  start.current=null;
  const moved=Math.hypot(event.clientX-origin.clientX,event.clientY-origin.clientY);
  // The customer only taps the object. Drawing or resizing a rectangle is disabled.
  if(moved>8||selectionBusy)return;
  const selectedPoint=point(event);
  if(!selectedPoint)return;
  if(onSelectPoint){onSelectPoint(selectedPoint);return;}
  const candidate=findImageRegionAtPoint(selectedPoint,candidates);
  if(candidate)onChange(candidate);
 };
 const keyboardSelect=(event:KeyboardEvent<HTMLDivElement>)=>{
  if(event.key==='Escape'){onChange(undefined);return;}
  if(event.key!=='Enter'&&event.key!==' ')return;
  event.preventDefault();
  const base=selected || candidates[0];
  onSelectPoint?.(base
   ? {x:Math.max(0,Math.min(1,base.x+base.width/2)),y:Math.max(0,Math.min(1,base.y+base.height/2))}
   : {x:0.5,y:0.5});
 };
 const cropStyle=selected?{
  aspectRatio:aspect*selected.width/selected.height,
  backgroundImage:'url('+JSON.stringify(src)+')',
  backgroundSize:(100/selected.width)+'% '+(100/selected.height)+'%',
  backgroundPosition:(selected.width<1?100*selected.x/(1-selected.width):0)+'% '+(selected.height<1?100*selected.y/(1-selected.height):0)+'%',
 }:undefined;

 return <section className="sanat-region-picker" aria-label="انتخاب هوشمند قطعه در تصویر" data-testid="image-region-selector" dir="rtl">
  <header className="sanat-region-picker__header">
   <div className="sanat-region-picker__heading">
    <span className="sanat-region-picker__icon" aria-hidden="true">⌖</span>
    <div><strong>انتخاب قطعه با لمس تصویر</strong><p>روی خود قطعه ضربه بزنید؛ سیستم مرز آن را استخراج و برش را آماده می‌کند.</p></div>
   </div>
   <span className="sanat-region-picker__status">{selectionBusy?'در حال استخراج':selected?'قطعه انتخاب شد':candidates.length?'پیشنهادهای خودکار':'آماده انتخاب'}</span>
  </header>
  <div className="sanat-region-picker__layout">
   <div className="sanat-region-picker__canvas">
    <div role="group" aria-label="برای انتخاب قطعه روی همان قسمت تصویر ضربه بزنید" tabIndex={0}
     className="sanat-region-picker__frame" dir="ltr"
     onPointerDown={event=>{
      if(event.button!==0||!event.isPrimary||selectionBusy)return;
      start.current={clientX:event.clientX,clientY:event.clientY};
      event.currentTarget.setPointerCapture(event.pointerId);
     }}
     onPointerUp={finish}
     onPointerCancel={()=>{start.current=null;}}
     onLostPointerCapture={()=>{start.current=null;}}
     onKeyDown={keyboardSelect}>
     <img src={src} alt="تصویر قطعه؛ برای انتخاب روی خود قطعه ضربه بزنید" draggable={false}
      onLoad={event=>setAspect(event.currentTarget.naturalWidth/event.currentTarget.naturalHeight||1)}/>
     {candidates.map((region,index)=><div key={index} aria-hidden="true"
      className={"sanat-region-picker__candidate "+(sameRegion(value,region)?"is-selected":"")}
      style={{left:(region.x*100)+"%",top:(region.y*100)+"%",width:(region.width*100)+"%",height:(region.height*100)+"%"}}>
      <span>{toPersianNumber(index+1)}</span>
     </div>)}
     {selectionBusy&&<div className="sanat-region-picker__busy" role="status" aria-live="polite"><span className="sanat-region-picker__busy-spinner"/>در حال استخراج مرز قطعه انتخاب‌شده…</div>}
    </div>
   </div>
   <aside className="sanat-region-picker__side">
    <div className="sanat-region-picker__side-title">پیش‌نمایش برش واقعی</div>
    {selected?<div className="sanat-region-picker__crop" style={cropStyle}/ >:
     <div className="sanat-region-picker__empty">پس از لمس قطعه، برش اختصاصی آن اینجا نمایش داده می‌شود.</div>}
    <p>{selected?'همین برش پس از تأیید برای تحلیل و جست‌وجوی کاتالوگ استفاده می‌شود.':'برای انتخاب قطعه دیگر، روی همان قطعه در تصویر ضربه بزنید.'}</p>
    <button type="button" onClick={()=>onFullImageSearch?onFullImageSearch():onChange(undefined)} disabled={selectionBusy}>جست‌وجوی کل تصویر</button>
   </aside>
  </div>
  {selectionError&&<p className="sanat-region-picker__error" role="alert">{selectionError}</p>}
  <p className="sanat-region-picker__hint">نیازی به کشیدن کادر نیست؛ فقط روی قطعه موردنظر ضربه بزنید. لمس فضای خالی انتخاب قبلی را تغییر نمی‌دهد.</p>
 </section>;
}
