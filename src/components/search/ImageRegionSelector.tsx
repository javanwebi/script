import {useRef,useState} from 'react';
import type {PointerEvent} from 'react';
import type {ImageRegion} from '../../services/localQueryImage';
import {validImageRegion} from '../../services/localQueryImage';
import {findImageRegionAtPoint} from '../../utils/imageRegionInteraction';

function sameRegion(a?:ImageRegion,b?:ImageRegion){
 return !!a&&!!b&&Math.abs(a.x-b.x)<0.002&&Math.abs(a.y-b.y)<0.002&&Math.abs(a.width-b.width)<0.002&&Math.abs(a.height-b.height)<0.002;
}
function toPersianNumber(value:number){return String(value).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[Number(d)]);}
export function ImageRegionSelector({src,value,candidateRegions=[],onChange}:{src:string;value?:ImageRegion;candidateRegions?:ImageRegion[];onChange:(r:ImageRegion|undefined)=>void}){
 const start=useRef<{x:number;y:number;clientX:number;clientY:number}|null>(null);
 const [draft,setDraft]=useState<ImageRegion>();
 const [aspect,setAspect]=useState(1);
 const candidates=candidateRegions.filter(validImageRegion);
 const selected=draft || value;
 const point=(event:PointerEvent<HTMLDivElement>)=>{
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
   const candidate=findImageRegionAtPoint(p,candidates);
   if(candidate)onChange(candidate);
   // A tap outside every valid proposal is intentionally a no-op.
  }
  setDraft(undefined);
 };
 const keyboardBase=value || candidates[0] || {x:0.35,y:0.3,width:0.3,height:0.3};
 return <section className="sanat-region-picker" aria-label="انتخاب قطعه در تصویر" data-testid="image-region-selector" dir="rtl">
  <header className="sanat-region-picker__header">
   <div className="sanat-region-picker__heading">
    <span className="sanat-region-picker__icon" aria-hidden="true">⌖</span>
    <div><strong>انتخاب محدوده قطعه</strong><p>{candidates.length?'سیستم چند ناحیه را پیشنهاد داده؛ روی قطعه موردنظر بزنید.':'محدوده خودکار قابل‌اعتماد پیدا نشد؛ دور قطعه کادر بکشید.'}</p></div>
   </div>
   <span className="sanat-region-picker__status">{value?'ناحیه منتخب':'انتخاب خودکار'}</span>
  </header>
  <div className="sanat-region-picker__layout">
   <div role="group" aria-label="انتخاب قطعه با لمس، کشیدن یا کلیدهای جهت" tabIndex={0}
    className="sanat-region-picker__canvas" dir="ltr"
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
   <aside className="sanat-region-picker__side">
    <div className="sanat-region-picker__side-title">پیش‌نمایش برش</div>
    {value?<div className="sanat-region-picker__crop" style={{aspectRatio:aspect*value.width/value.height,backgroundImage:'url('+JSON.stringify(src)+')',backgroundSize:(100/value.width)+'% '+(100/value.height)+'%',backgroundPosition:(value.width<1?100*value.x/(1-value.width):0)+'% '+(value.height<1?100*value.y/(1-value.height):0)+'%'}}/>:
     <div className="sanat-region-picker__empty">ناحیه منتخب پس از تحلیل نمایش داده می‌شود.</div>}
    <p>{value?'این محدوده برای جست‌وجوی مجدد استفاده می‌شود.':'اگر سیستم ناحیه‌ای پیدا نکند، می‌توانید با کشیدن کادر آن را مشخص کنید.'}</p>
    <button type="button" onClick={()=>onChange(undefined)}>جست‌وجوی کل تصویر</button>
   </aside>
  </div>
  <p className="sanat-region-picker__hint">لمس روی کادرهای پیشنهادی: انتخاب قطعه دیگر · لمس فضای خالی: حفظ انتخاب فعلی · کشیدن: برش دستی</p>
 </section>;
}
