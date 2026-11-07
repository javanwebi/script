import {useState} from 'react';
import {Link} from 'react-router-dom';
import type {CatalogModelSuggestion} from '../../services/aiVisualSearchService';
import {toPersianDigits} from '../../utils/formatters';

export function LocalModelResults({items,onClose}:{items:CatalogModelSuggestion[];onClose:()=>void}){
 const [expanded,setExpanded]=useState(false);
 if(!items.length)return null;
 const exploring=items.every(item=>item.matchBasis==='explore');
 const shown=expanded?items:items.slice(0,12);
 return <section className="space-y-3" aria-label="مدل‌های مشابه و گزینه‌های هم‌خانواده" dir="rtl">
  <div className="flex items-center justify-between gap-2">
   <h4 className="text-sm font-black text-slate-800">{exploring?'نزدیک‌ترین گزینه‌ها؛ تطبیق تأیید نشده':'مدل‌های مشابه برای مقایسه'}</h4>
   <span className="text-xs text-slate-500">{toPersianDigits(items.length)} گزینه</span>
  </div>
  <p className="text-xs leading-6 text-slate-600">{exploring?'تطبیق قابل اتکا پیدا نشد. این‌ها نزدیک‌ترین گزینه‌های واقعی برای بررسی هستند؛ روی قطعه در عکس بزنید یا محدوده را دقیق‌تر انتخاب کنید.':'مدل‌هایی که عکسشان شباهت بیشتری دارد، ابتدا آمده‌اند. گزینه‌های دارای عکس مشترک با عنوان «هم‌خانواده» نمایش داده می‌شوند و امتیاز مستقل ندارند.'}</p>
  <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0 m-0">
   {shown.map((item,index)=><li key={item.code}>
    <article className="h-full rounded-2xl border border-slate-200 bg-white p-3 flex flex-col gap-3">
     <div className="flex items-center justify-between gap-2 text-xs">
      <span className="font-bold text-orange-700">گزینه {toPersianDigits(index+1)}</span>
      {item.matchBasis==='visual'&&item.visualScore!==undefined?
       <span className="rounded-lg bg-orange-50 px-2 py-1 text-orange-800">شباهت تصویری: {toPersianDigits(item.visualScore)} از ۱۰۰</span>:
       <span className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">{item.matchBasis==='explore'?'برای بررسی؛ تأیید نشده':item.matchBasis==='read_code'?'پیشنهاد بر اساس کد خوانده‌شده':'مدل هم‌خانواده'}</span>}
     </div>
     {item.image?<img src={item.image} alt={item.name} loading="lazy" className="w-full h-36 object-contain rounded-xl bg-slate-50" />:
      <div className="h-36 grid place-items-center rounded-xl bg-slate-50 text-xs text-slate-500">عکس اختصاصی ثبت نشده</div>}
     {item.imageScope==='family'&&item.image&&<p className="text-[11px] text-slate-500">عکس نمونهٔ خانواده / مشترک بین مدل‌ها</p>}
     <div>
      <h5 className="text-sm font-bold text-slate-800">{item.name}</h5>
      <p className="text-xs text-slate-500 mt-1">{item.familyName}{item.model?` · مدل ${item.model}`:''}{item.size?` · سایز ${item.size}`:''}</p>
      <p className="mt-1 text-xs font-mono text-orange-700" dir="ltr">{item.code}</p>
     </div>
     {!!item.specs.length&&<dl className="grid grid-cols-2 gap-2 text-xs">{item.specs.slice(0,4).map((spec,i)=><div key={i} className="bg-slate-50 rounded-lg p-2"><dt className="text-slate-500">{spec.key}</dt><dd className="m-0 mt-1 font-bold text-slate-700" dir="auto">{spec.value}</dd></div>)}</dl>}
     <p className="text-xs leading-6 text-slate-500">{item.reason}</p>
     <div className="mt-auto flex gap-2 text-xs">
      <Link to={`/product/${encodeURIComponent(item.code)}`} onClick={onClose} className="flex-1 text-center rounded-xl bg-orange-600 text-white px-3 py-2.5">مشاهده این مدل</Link>
      <Link to={`/product/${encodeURIComponent(item.familyCode)}`} onClick={onClose} className="rounded-xl border border-slate-200 px-3 py-2.5 text-slate-700">همه مدل‌های خانواده</Link>
     </div>
    </article>
   </li>)}
  </ol>
  {!expanded&&items.length>shown.length&&<button type="button" onClick={()=>setExpanded(true)} className="w-full rounded-xl border border-orange-200 bg-orange-50 py-3 text-xs font-bold text-orange-700">نمایش مدل‌های بیشتر ({toPersianDigits(items.length-shown.length)} گزینه)</button>}
 </section>;
}
