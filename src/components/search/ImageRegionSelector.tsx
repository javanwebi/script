import {useRef,useState} from 'react';
import type {ImageRegion} from '../../services/localQueryImage';
import {tapImageRegion} from '../../utils/imageRegionInteraction';
export function ImageRegionSelector({src,value,onChange}:{src:string;value?:ImageRegion;onChange:(r:ImageRegion|undefined)=>void}){
 const start=useRef<{x:number;y:number;clientX:number;clientY:number}|null>(null);
 const [draft,setDraft]=useState<ImageRegion>();
 const [aspect,setAspect]=useState(1);
 const region=draft || value;
 const point=(event:React.PointerEvent<HTMLDivElement>)=>{const box=event.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};};
 return <section className="rounded-2xl border border-slate-200 bg-white p-3 text-xs my-3" aria-label="انتخاب قطعه در تصویر">
  <p className="font-bold text-orange-700">روی قطعه بزنید تا همان قسمت جست‌وجو شود</p>
  <p className="text-slate-600 my-2 leading-6">برای انتخاب دقیق‌تر دور قطعه بکشید. با کلیدهای جهت محدوده جابه‌جا می‌شود؛ Shift و جهت اندازه را تغییر می‌دهد.</p>
  <div role="group" aria-label="انتخاب محدوده قطعه با لمس، کشیدن یا کلیدهای جهت" tabIndex={0}
   className="relative max-w-2xl mx-auto overflow-hidden rounded-xl touch-none select-none outline-orange-500 cursor-crosshair" dir="ltr"
   onPointerDown={e=>{if(e.button!==0||!e.isPrimary)return;start.current={...point(e),clientX:e.clientX,clientY:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);setDraft(undefined);}}
   onPointerMove={e=>{if(!start.current)return;const p=point(e),s=start.current;setDraft({x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(s.x-p.x),height:Math.abs(s.y-p.y)});}}
   onPointerUp={e=>{if(!start.current)return;const p=point(e),s=start.current;start.current=null;
    if(Math.hypot(e.clientX-s.clientX,e.clientY-s.clientY)<=8)onChange(tapImageRegion(p,aspect));
    else{const r={x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(s.x-p.x),height:Math.abs(s.y-p.y)};if(r.width>=0.03&&r.height>=0.03)onChange(r);}
    setDraft(undefined);}}
   onPointerCancel={()=>{start.current=null;setDraft(undefined);}}
   onLostPointerCapture={()=>{start.current=null;setDraft(undefined);}}
   onKeyDown={e=>{if(e.key==='Escape'){onChange(undefined);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const r={...(value || tapImageRegion({x:0.5,y:0.5},aspect))};const dx=e.key==='ArrowLeft'?-0.02:e.key==='ArrowRight'?0.02:0,dy=e.key==='ArrowUp'?-0.02:e.key==='ArrowDown'?0.02:0;if(e.shiftKey){r.width=Math.max(0.03,Math.min(1-r.x,r.width+dx));r.height=Math.max(0.03,Math.min(1-r.y,r.height+dy));}else{r.x=Math.max(0,Math.min(1-r.width,r.x+dx));r.y=Math.max(0,Math.min(1-r.height,r.y+dy));}onChange(r);}}>
   <img src={src} alt="عکس ارسالی؛ قطعه مورد نظر را لمس کنید" draggable={false} onLoad={e=>setAspect(e.currentTarget.naturalWidth/e.currentTarget.naturalHeight || 1)} className="block w-full h-auto pointer-events-none" />
   {region && region.width>0 && region.height>0 && <div aria-hidden="true" className="absolute border-[3px] border-white rounded-xl pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" style={{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`}} />}
  </div>
  {value && <div className="mt-3 flex items-center gap-3">
   <div role="img" aria-label="نمای بزرگ‌شده محدوده انتخابی" className="w-28 max-h-36 rounded-xl border border-orange-200 bg-no-repeat shrink-0" style={{aspectRatio:aspect*value.width/value.height,backgroundImage:`url(${JSON.stringify(src)})`,backgroundSize:`${100/value.width}% ${100/value.height}%`,backgroundPosition:`${value.width<1?100*value.x/(1-value.width):0}% ${value.height<1?100*value.y/(1-value.height):0}%`}} />
   <span className="text-slate-600 leading-6">محدودهٔ انتخابی؛ برای بررسی قطعهٔ دیگر، روی همان قطعه در عکس بزنید.</span>
  </div>}
  <button type="button" onClick={()=>onChange(undefined)} className="mt-3 px-3 py-2 rounded-lg border border-slate-200">جست‌وجوی کل عکس</button>
 </section>;
}
