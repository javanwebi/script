import {useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import {validImageRegion,type ImageRegion} from '../../utils/imageRegion';
import {findImageRegionAtPoint,tapImageRegion} from '../../utils/imageRegionInteraction';

function sameRegion(a?:ImageRegion,b?:ImageRegion){
 return !!a&&!!b&&Math.abs(a.x-b.x)<0.002&&Math.abs(a.y-b.y)<0.002&&Math.abs(a.width-b.width)<0.002&&Math.abs(a.height-b.height)<0.002;
}
function toPersianNumber(value:number){return String(value).replace(/[0-9]/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);}

type ImagePoint={x:number;y:number};
interface Props {
 src:string;
 value?:ImageRegion;
 candidateRegions?:ImageRegion[];
 onChange:(region:ImageRegion|undefined)=>void;
 onSearch?:()=>void;
 onFullImageSearch?:()=>void;
}

export function ImageRegionSelector({src,value,candidateRegions=[],onChange,onSearch,onFullImageSearch}:Props){
 const start=useRef<{x:number;y:number;clientX:number;clientY:number}|null>(null);
 const [draft,setDraft]=useState<ImageRegion>();
 const [aspect,setAspect]=useState(1);
 const candidates=candidateRegions.filter(validImageRegion);
 const selected=draft || value;
 const point=(event:PointerEvent<HTMLDivElement>):ImagePoint=>{
  const box=event.currentTarget.getBoundingClientRect();
  return {x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};
 };
 const finish=(event:PointerEvent<HTMLDivElement>)=>{
  if(!start.current)return;
  const p=point(event),s=start.current;
  start.current=null;
  const moved=Math.hypot(event.clientX-s.clientX,event.clientY-s.clientY);
  if(moved>8){
   const region={x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(p.x-s.x),height:Math.abs(p.y-s.y)};
   if(validImageRegion(region))onChange(region);
  }else{
   // Prefer an actual server-proposed object box. If the tap lands on another
   // part not in the proposals, create a centered focus crop around that point.
   const candidate=findImageRegionAtPoint(p,candidates);
   onChange(candidate || tapImageRegion(p,aspect));
  }
  setDraft(undefined);
 };
 const keyboardBase=value || candidates[0] || {x:0.35,y:0.3,width:0.3,height:0.3};
 return <section className="sanat-region-picker" aria-label="انتخاب قطعه در تصویر" data-testid="image-region-selector" dir="rtl">
  <header className="sanat-region-picker__header">
   <div className="sanat-region-picker__heading">
    <span className="sanat-region-picker__icon" aria-hidden="true">⌖</span>
    <div><strong>انتخاب محدوده قطعه</strong><p>{candidates.length?'روی کادر قطعه موردنظر بزنید؛ برای انتخاب نقطه دیگری از تصویر، همان‌جا لمس کنید.':'روی خود قطعه بزنید تا برش اولیه اطراف آن ساخته شود؛ برای دقت بیشتر کادر بکشید.'}</p></div>
   </div>
   <span className="sanat-region-picker__status">{value?'ناحیه منتخب':candidates.length?'پیشنهادهای سیستم':'انتخاب ناحیه'}</span>
  </header>
  <div className="sanat-region-picker__layout">
   <div className="sanat-region-picker__canvas">
    <div role="group" aria-label="انتخاب قطعه با لمس، کشیدن یا کلیدهای جهت" tabIndex={0}
     className="sanat-region-picker__frame" dir="ltr"
     onPointerDown={event=>{
      if(event.button!==0||!event.isPrimary)return;
      start.current={...point(event),clientX:event.clientX,clientY:event.clientY};
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraft(undefined);
     }}
     onPointerMove={event=>{
      if(!start.current)return;
      const p=point(event),s=start.current;
      setDraft({x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(p.x-s.x),height:Math.abs(p.y-s.y)});
     }}
     onPointerUp={finish}
     onPointerCancel={()=>{start.current=null;setDraft(undefined);}}
     onLostPointerCapture={()=>{start.current=null;setDraft(undefined);}}
     onKeyDown={event=>{
      if(event.key==='Escape'){onChange(undefined);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      const r={...keyboardBase};
      const dx=event.key==='ArrowLeft'?-0.02:event.key==='ArrowRight'?0.02:0;
      const dy=event.key==='ArrowUp'?-0.02:event.key==='ArrowDown'?0.02:0;
      if(event.shiftKey){r.width=Math.max(0.03,Math.min(1-r.x,r.width+dx));r.height=Math.max(0.03,Math.min(1-r.y,r.height+dy));}
      else{r.x=Math.max(0,Math.min(1-r.width,r.x+dx));r.y=Math.max(0,Math.min(1-r.height,r.y+dy));}
      onChange(r);
     }}>
     <img src={src} alt="عکس ارسالی؛ ناحیه قطعه را انتخاب کنید" draggable={false}
      onLoad={event=>setAspect(event.currentTarget.naturalWidth/event.currentTarget.naturalHeight||1)}/>
     {candidates.map((region,index)=><div key={index} aria-hidden="true"
      className={"sanat-region-picker__candidate "+(sameRegion(value,region)?"is-selected":"")}
      style={{left:(region.x*100)+"%",top:(region.y*100)+"%",width:(region.width*100)+"%",height:(region.height*100)+"%"}}>
      <span>{toPersianNumber(index+1)}</span>
     </div>)}
     {selected&&!candidates.some(region=>sameRegion(selected,region))&&<div aria-hidden="true" className="sanat-region-picker__candidate is-selected is-manual"
      style={{left:(selected.x*100)+"%",top:(selected.y*100)+"%",width:(selected.width*100)+"%",height:(selected.height*100)+"%"}}/>}
     {draft&&draft.width>0&&draft.height>0&&<div aria-hidden="true" className="sanat-region-picker__draft"
      style={{left:(draft.x*100)+"%",top:(draft.y*100)+"%",width:(draft.width*100)+"%",height:(draft.height*100)+"%"}}/>}
    </div>
   </div>
   <aside className="sanat-region-picker__side">
    <div className="sanat-region-picker__side-title">پیش‌نمایش برش</div>
    {selected?<div className="sanat-region-picker__crop" style={{aspectRatio:aspect*selected.width/selected.height,backgroundImage:'url('+JSON.stringify(src)+')',backgroundSize:(100/selected.width)+'% '+(100/selected.height)+'%',backgroundPosition:(selected.width<1?100*selected.x/(1-selected.width):0)+'% '+(selected.height<1?100*selected.y/(1-selected.height):0)+'%'}}/>:
     <div className="sanat-region-picker__empty">هنوز برشی انتخاب نشده؛ روی قطعه بزنید یا کادر بکشید.</div>}
    <p>{selected?'برش انتخاب‌شده را بررسی کنید؛ جست‌وجو فقط پس از زدن دکمه انجام می‌شود.':'با لمس قطعه، برش اولیه ساخته می‌شود و می‌توانید آن را اصلاح کنید.'}</p>
    {onSearch&&<button type="button" className="sanat-region-picker__search" onClick={onSearch} disabled={!value}>جست‌وجوی این قطعه</button>}
    <button type="button" className="sanat-region-picker__full-image" onClick={()=>onFullImageSearch ? onFullImageSearch() : onChange(undefined)}>جست‌وجوی کل تصویر</button>
   </aside>
  </div>
  <p className="sanat-region-picker__hint">لمس روی کادر پیشنهادی: انتخاب همان قطعه · لمس روی قطعه دیگر: ساخت برش جدید · کشیدن: تنظیم دقیق کادر</p>
 </section>;
}
