import {useState} from 'react';
import {Link} from 'react-router-dom';
import {ArrowUpLeft,Box,ChevronDown,ImageOff,Layers3} from 'lucide-react';
import type {CatalogModelSuggestion} from '../../services/aiVisualSearchService';
import {toPersianDigits} from '../../utils/formatters';

export function LocalModelResults({items,onClose}:{items:CatalogModelSuggestion[];onClose:()=>void}){
 const [expanded,setExpanded]=useState(false);
 if(!items.length)return null;
 const exploring=items.every(item=>item.matchBasis==='explore');
 const shown=expanded?items:items.slice(0,12);
 return <section className="space-y-4" aria-label="مدل‌های مشابه و گزینه‌های هم‌خانواده" dir="rtl">
  <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-3">
   <div className="min-w-0">
    <div className="mb-1 flex items-center gap-2 text-[10px] font-extrabold tracking-wide text-[#C45D1A]"><Layers3 size={14}/> FORZA VISION / CATALOGUE RESULTS</div>
    <h3 className="text-base font-black text-slate-900 sm:text-lg">{exploring?'نزدیک‌ترین گزینه‌ها برای بررسی':'محصولات مشابه از کاتالوگ صنعت پیش'}</h3>
    <p className="mt-1 text-xs leading-6 text-slate-500">{exploring?'این گزینه‌ها تطبیق تأییدشده نیستند. برای نتیجه بهتر، محدوده قطعه را روی عکس انتخاب کنید.':'نتایج تصویری به‌ترتیب شباهت عکس مرتب شده‌اند؛ داشتن یا نداشتن کد، رتبه شباهت تصویر را تغییر نمی‌دهد.'}</p>
   </div>
   <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">{toPersianDigits(items.length)} نتیجه</span>
  </header>
  <ol className="grid list-none grid-cols-1 gap-3 p-0 m-0 sm:grid-cols-2 xl:grid-cols-3">
   {shown.map((item,index)=>{
    const familyOnly=item.recordType==='family'||!item.code;
    const destination='/product/'+encodeURIComponent(item.code || item.familyCode);
    return <li key={item.code || ('family:'+item.familyCode)}>
     <article className={'flex h-full flex-col overflow-hidden rounded-2xl border bg-white transition-shadow hover:shadow-md '+(index===0?'border-orange-300 shadow-sm':'border-slate-200')}>
      <div className="flex items-center justify-between gap-2 px-3 pt-3 text-xs">
       <span className="font-extrabold text-slate-700">گزینه {toPersianDigits(index+1)}</span>
       {item.matchBasis==='visual'&&item.visualScore!==undefined
        ?<span className="rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-extrabold text-[#B95312]">شباهت تصویر {toPersianDigits(item.visualScore)} از ۱۰۰</span>
        :<span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{item.matchBasis==='explore'?'تطبیق تأیید نشده':item.matchBasis==='read_code'?'پیشنهاد از روی کد':'هم‌خانواده'}</span>}
      </div>
      <div className="relative mx-3 mt-3 grid h-44 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 to-slate-100">
       {item.image?<img src={item.image} alt={item.name} loading="lazy" className="h-full w-full object-contain p-3"/>:
        <div className="flex flex-col items-center gap-2 text-slate-400"><ImageOff size={25}/><span className="text-[11px]">تصویر اختصاصی ثبت نشده</span></div>}
       {familyOnly&&<span className="absolute bottom-2 right-2 rounded-full border border-white/80 bg-white/95 px-2.5 py-1 text-[10px] font-bold text-slate-700 shadow-sm">خانواده بدون کد کالا</span>}
       {item.imageScope==='family'&&item.image&&<span className="absolute bottom-2 left-2 rounded-full bg-slate-900/75 px-2 py-1 text-[9px] font-semibold text-white">عکس نمونهٔ خانواده</span>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
       <div className="min-w-0">
        <h4 className="text-sm font-black leading-6 text-slate-900">{item.name}</h4>
        <p className="mt-0.5 text-xs text-slate-500">{item.familyName}{item.model?' · مدل '+item.model:''}{item.size?' · سایز '+item.size:''}</p>
        {item.code
         ?<p className="mt-2 inline-flex rounded-md bg-slate-50 px-2 py-1 font-mono text-xs font-bold text-[#B95312]" dir="ltr">{item.code}</p>
         :<p className="mt-2 inline-flex rounded-md bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-500">کد کالا برای این خانواده ثبت نشده</p>}
       </div>
       {!!item.specs.length&&<dl className="grid grid-cols-2 gap-2 text-[11px]">{item.specs.slice(0,4).map((spec,i)=><div key={i} className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">{spec.key}</dt><dd className="m-0 mt-1 font-bold text-slate-800" dir="auto">{spec.value}</dd></div>)}</dl>}
       <p className="text-xs leading-6 text-slate-500">{item.reason}</p>
       <div className="mt-auto flex gap-2 pt-1 text-xs">
        <Link to={destination} onClick={onClose} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-3 py-2.5 font-bold text-white transition hover:bg-[#C95210]">
         {familyOnly?'مشاهده خانواده':'مشاهده این مدل'} <ArrowUpLeft size={14}/>
        </Link>
        {!familyOnly&&<Link to={'/product/'+encodeURIComponent(item.familyCode)} onClick={onClose} className="inline-flex min-h-10 items-center justify-center gap-1 rounded-xl border border-slate-200 px-3 py-2.5 font-semibold text-slate-700 hover:border-orange-300 hover:text-[#B95312]"><Box size={14}/> همه مدل‌ها</Link>}
       </div>
      </div>
     </article>
    </li>;
   })}
  </ol>
  {!expanded&&items.length>shown.length&&<button type="button" onClick={()=>setExpanded(true)} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-200 bg-orange-50 text-xs font-extrabold text-[#B95312] transition hover:bg-orange-100">نمایش مدل‌های بیشتر · {toPersianDigits(items.length-shown.length)} <ChevronDown size={15}/></button>}
 </section>;
}
