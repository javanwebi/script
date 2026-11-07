import {useRef,useState} from 'react';
import type {ImageRegion} from '../../services/localQueryImage';
export function ImageRegionSelector({src,value,onChange}:{src:string;value?:ImageRegion;onChange:(r:ImageRegion|undefined)=>void}){
 const start=useRef<{x:number;y:number}|null>(null);
 const [draft,setDraft]=useState<ImageRegion>();
 const region=draft || value;
 const point=(event:React.PointerEvent<HTMLDivElement>)=>{const box=event.currentTarget.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};};
 return <details className="rounded-xl border border-slate-200 p-3 text-xs my-3">
  <summary className="cursor-pointer font-bold text-orange-700">انتخاب محدودهٔ قطعه در عکس</summary>
  <p className="text-slate-600 my-2 leading-6">در عکس‌های شلوغ، دور قطعه بکشید. با کلیدهای جهت محدوده جابه‌جا می‌شود؛ Shift و جهت اندازه را تغییر می‌دهد.</p>
  <div role="group" aria-label="انتخاب محدوده قطعه با کشیدن یا کلیدهای جهت" tabIndex={0}
   className="relative max-w-sm mx-auto touch-none select-none outline-orange-500"
   onPointerDown={e=>{if(e.button!==0)return;start.current=point(e);e.currentTarget.setPointerCapture(e.pointerId);setDraft(undefined);}}
   onPointerMove={e=>{if(!start.current)return;const p=point(e),s=start.current;setDraft({x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(s.x-p.x),height:Math.abs(s.y-p.y)});}}
   onPointerUp={e=>{if(!start.current)return;const p=point(e),s=start.current;start.current=null;const r={x:Math.min(s.x,p.x),y:Math.min(s.y,p.y),width:Math.abs(s.x-p.x),height:Math.abs(s.y-p.y)};if(r.width>=0.03&&r.height>=0.03)onChange(r);setDraft(undefined);}}
   onPointerCancel={()=>{start.current=null;setDraft(undefined);}}
   onLostPointerCapture={()=>{start.current=null;setDraft(undefined);}}
   onKeyDown={e=>{if(e.key==='Escape'){onChange(undefined);return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const r={...(value || {x:0.1,y:0.1,width:0.8,height:0.8})};const dx=e.key==='ArrowLeft'?-0.02:e.key==='ArrowRight'?0.02:0,dy=e.key==='ArrowUp'?-0.02:e.key==='ArrowDown'?0.02:0;if(e.shiftKey){r.width=Math.max(0.05,Math.min(1-r.x,r.width+dx));r.height=Math.max(0.05,Math.min(1-r.y,r.height+dy));}else{r.x=Math.max(0,Math.min(1-r.width,r.x+dx));r.y=Math.max(0,Math.min(1-r.height,r.y+dy));}onChange(r);}}>
   <img src={src} alt="محدودهٔ قطعه برای جست‌وجو" draggable={false} className="block w-full h-auto pointer-events-none" />
   {region && <div aria-hidden="true" className="absolute border-2 border-orange-500 bg-orange-500/10 pointer-events-none" style={{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`}} />}
  </div>
  <button type="button" onClick={()=>onChange(undefined)} className="mt-2 px-3 py-2 rounded-lg border border-slate-200">جست‌وجوی کل عکس</button>
  <span role="status" className="mr-2 text-slate-600">{value?'محدوده انتخاب شده است':'کل تصویر بررسی می‌شود'}</span>
 </details>;
}
