import {useRef,useState} from 'react';
import {Crosshair,MousePointer2,ScanSearch,Maximize2} from 'lucide-react';
import type {ImageRegion} from '../../services/localQueryImage';
import {tapImageRegion} from '../../utils/imageRegionInteraction';

type SelectionMode='automatic'|'manual'|'full';
interface Props {
 src:string;
 value?:ImageRegion;
 mode?:SelectionMode;
 onChange:(region:ImageRegion|undefined)=>void;
}

export function ImageRegionSelector({src,value,mode='automatic',onChange}:Props){
 const start=useRef<{x:number;y:number;clientX:number;clientY:number}|null>(null);
 const [draft,setDraft]=useState<ImageRegion>();
 const [aspect,setAspect]=useState(1);
 const region=draft || value;
 const point=(event:React.PointerEvent<HTMLDivElement>)=>{
  const box=event.currentTarget.getBoundingClientRect();
  return {x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};
 };
 const title=mode==='manual'?'ناحیه انتخاب‌شده توسط شما':mode==='automatic'&&value?'ناحیه پیشنهادی هوش مصنوعی':'انتخاب محدوده قطعه';
 const description=value
  ? mode==='manual'?'این محدوده با انتخاب شما بررسی می‌شود. برای امتحان قطعه‌ای دیگر، روی همان قسمت تصویر بزنید یا دور آن بکشید.':
    'سیستم این قسمت را برای جست‌وجو پیشنهاد داده است. اگر قطعه دیگری مدنظر شماست، روی آن بزنید یا دورش کادر بکشید.'
  : 'سیستم هنوز محدوده مطمئنی انتخاب نکرده است. روی خود قطعه بزنید یا با کشیدن انگشت/ماوس دور آن کادر بکشید.';
 return <section className="my-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="انتخاب قطعه در تصویر" dir="rtl">
  <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
   <div className="flex min-w-0 items-start gap-3">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-50 text-[#E56B1E]"><ScanSearch size={20}/></span>
    <div className="min-w-0">
     <div className="flex flex-wrap items-center gap-2">
      <h3 className="text-sm font-extrabold text-slate-900">{title}</h3>
      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${mode==='manual'?'bg-sky-50 text-sky-700':value?'bg-orange-50 text-orange-700':'bg-slate-100 text-slate-600'}`}>
       {mode==='manual'?'انتخاب شما':value?'پیشنهاد سیستم':'انتخاب دستی'}
      </span>
     </div>
     <p className="mt-1 max-w-2xl text-xs leading-6 text-slate-500">{description}</p>
    </div>
   </div>
   <span className="hidden items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-500 sm:inline-flex"><MousePointer2 size={13}/> لمس یا کشیدن برای انتخاب</span>
  </header>
  <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_190px]">
   <div className="min-w-0">
    <div role="group" aria-label="انتخاب محدوده قطعه با لمس، کشیدن یا کلیدهای جهت" tabIndex={0}
     className="relative mx-auto max-h-[55vh] w-full touch-none select-none overflow-hidden rounded-xl bg-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-[#E56B1E] focus-visible:ring-offset-2"
     dir="ltr"
     onPointerDown={event=>{
      if(event.button!==0||!event.isPrimary)return;
      start.current={...point(event),clientX:event.clientX,clientY:event.clientY};
      event.currentTarget.setPointerCapture(event.pointerId);
      setDraft(undefined);
     }}
     onPointerMove={event=>{
      if(!start.current)return;
      const next=point(event),origin=start.current;
      setDraft({x:Math.min(origin.x,next.x),y:Math.min(origin.y,next.y),width:Math.abs(origin.x-next.x),height:Math.abs(origin.y-next.y)});
     }}
     onPointerUp={event=>{
      if(!start.current)return;
      const next=point(event),origin=start.current;
      start.current=null;
      if(Math.hypot(event.clientX-origin.clientX,event.clientY-origin.clientY)<=8)onChange(tapImageRegion(next,aspect));
      else{
       const nextRegion={x:Math.min(origin.x,next.x),y:Math.min(origin.y,next.y),width:Math.abs(origin.x-next.x),height:Math.abs(origin.y-next.y)};
       if(nextRegion.width>=0.03&&nextRegion.height>=0.03)onChange(nextRegion);
      }
      setDraft(undefined);
     }}
     onPointerCancel={()=>{start.current=null;setDraft(undefined);}}
     onLostPointerCapture={()=>{start.current=null;setDraft(undefined);}}
     onKeyDown={event=>{
      if(event.key==='Escape'){onChange(undefined);return;}
      if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
      event.preventDefault();
      const next={...(value || tapImageRegion({x:0.5,y:0.5},aspect))};
      const dx=event.key==='ArrowLeft'?-0.02:event.key==='ArrowRight'?0.02:0;
      const dy=event.key==='ArrowUp'?-0.02:event.key==='ArrowDown'?0.02:0;
      if(event.shiftKey){next.width=Math.max(0.03,Math.min(1-next.x,next.width+dx));next.height=Math.max(0.03,Math.min(1-next.y,next.height+dy));}
      else{next.x=Math.max(0,Math.min(1-next.width,next.x+dx));next.y=Math.max(0,Math.min(1-next.height,next.y+dy));}
      onChange(next);
     }}>
     <img src={src} alt="عکس ارسالی؛ قطعه مورد نظر را لمس کنید" draggable={false}
      onLoad={event=>setAspect(event.currentTarget.naturalWidth/event.currentTarget.naturalHeight||1)}
      className="pointer-events-none block h-auto max-h-[55vh] w-full object-contain"/>
     {region&&region.width>0&&region.height>0&&<div aria-hidden="true"
      className="pointer-events-none absolute rounded-lg border-[3px] border-[#FF9A4A] shadow-[0_0_0_9999px_rgba(8,15,24,.52),0_0_18px_rgba(229,107,30,.65)]"
      style={{left:`${region.x*100}%`,top:`${region.y*100}%`,width:`${region.width*100}%`,height:`${region.height*100}%`}}>
      <span className="absolute -top-7 left-0 whitespace-nowrap rounded-md bg-[#E56B1E] px-2 py-1 text-[10px] font-bold text-white shadow">{mode==='manual'?'انتخاب شما':'ناحیه پیشنهادی'}</span>
     </div>}
    </div>
   </div>
   <aside className="flex min-w-0 flex-row items-center gap-3 rounded-xl bg-slate-50 p-3 lg:flex-col lg:items-stretch">
    <div className="flex min-w-0 flex-1 items-center gap-2 lg:flex-col lg:items-stretch">
     <div className="flex items-center gap-2 text-xs font-extrabold text-slate-800"><Crosshair size={15} className="text-[#E56B1E]"/> برش انتخاب‌شده</div>
     {value?<>
      <div role="img" aria-label="نمای بزرگ‌شده محدوده انتخابی" className="h-16 w-20 shrink-0 rounded-lg border border-orange-200 bg-white bg-no-repeat lg:h-32 lg:w-full"
       style={{aspectRatio:aspect*value.width/value.height,backgroundImage:`url(${JSON.stringify(src)})`,backgroundSize:`${100/value.width}% ${100/value.height}%`,backgroundPosition:`${value.width<1?100*value.x/(1-value.width):0}% ${value.height<1?100*value.y/(1-value.height):0}%`}}/>
      <p className="hidden text-[11px] leading-5 text-slate-500 lg:block">همین قسمت برای مقایسه با تصاویر کاتالوگ استفاده می‌شود.</p>
     </>:<div className="flex h-16 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-2 text-center text-[10px] leading-5 text-slate-400 lg:h-32">پس از انتخاب قطعه، پیش‌نمایش برش اینجا نمایش داده می‌شود.</div>}
    </div>
    <button type="button" onClick={()=>onChange(undefined)}
     className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-bold text-slate-700 transition hover:border-[#E56B1E] hover:text-[#C95210] lg:w-full">
     <Maximize2 size={14}/> جست‌وجوی کل تصویر
    </button>
   </aside>
  </div>
  <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-[10px] leading-5 text-slate-500 sm:px-5">
   <span>برای انتخاب قطعه دیگر روی آن ضربه بزنید؛ برای برش دقیق‌تر دور آن بکشید.</span>
   <span className="font-semibold text-[#C45D1A]">تغییر انتخاب، جست‌وجو را دوباره اجرا می‌کند</span>
  </footer>
 </section>;
}
