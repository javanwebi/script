import React, {useEffect, useMemo, useState} from 'react';
import {Link} from 'react-router-dom';
import {Search, MessageSquare, ArrowUpLeft} from 'lucide-react';
import {getAllProducts, subscribeCatalogChanges} from '../../data/mockGenerator';
import {ProductImage} from '../product/ProductImage';
import {INDUSTRIES} from '../../data/siteContent';

const normalize=(value:string)=>value.replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/\u200c/g,' ').toLowerCase().trim();
export function IndustryProductFinder({industry}:{industry:typeof INDUSTRIES[number]}){
 const [term,setTerm]=useState('');
 const [query,setQuery]=useState('');
 const [revision,setRevision]=useState(0);
 useEffect(()=>subscribeCatalogChanges(()=>setRevision(n=>n+1)),[]);
 const products=useMemo(()=>getAllProducts().filter(p=>{
  if(p.active===false)return false;
  const text=normalize(`${p.name} ${p.code} ${p.brand||''}`);
  return (term?[term]:industry.terms).some(t=>text.includes(normalize(t))) && (!query||text.includes(normalize(query)));
 }),[industry,term,query,revision]);
 return <section className="editorial-wrap py-8" aria-label={`انتخاب محصول برای ${industry.title}`}>
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
   <div><span className="store-eyebrow">از کاتالوگ واقعی صنعت پیش</span><h2 className="text-2xl font-black mt-2">قطعه را پیدا کنید؛ انتخاب را با مشاوره دقیق کنید</h2><p className="text-sm leading-7 mt-3 text-slate-600">این خانواده‌ها برای بررسی اولیه پیشنهاد شده‌اند. سازگاری با دستگاه، ابعاد و شرایط کار باید تأیید شود.</p></div>
   <label className="flex items-center gap-3 bg-white border border-slate-300 rounded-xl px-4 min-h-12 lg:min-w-72"><Search size={20}/><input className="min-w-0 w-full bg-transparent py-3 outline-none" aria-label="جستجو در محصولات این صنعت" placeholder="نام یا کد قطعه…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
  </div>
  <div className="flex flex-wrap gap-2 my-5" role="group" aria-label="گروه قطعه">
   {['',...industry.terms].map((t,index)=><button key={t} type="button" aria-pressed={term===t} onClick={()=>setTerm(t)} className={`min-h-11 rounded-xl border px-4 text-sm ${term===t?'bg-[#23262B] text-white border-[#23262B]':'bg-white text-slate-700 border-slate-200'}`}>{index===0?'همه گروه‌ها':industry.parts[index-1]||t}</button>)}
  </div>
  <p className="text-xs text-slate-500 mb-3" aria-live="polite">{products.length.toLocaleString('fa-IR')} خانواده در کاتالوگ فعلی</p>
  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
   {products.slice(0,12).map(p=><article key={p.code} className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col">
    <Link to={`/product/${encodeURIComponent(p.code)}`} className="flex gap-4 p-4 items-center"><div className="w-24 h-24 shrink-0"><ProductImage src={p.images?.[0]} alt={p.name} thumbnail loading="lazy"/></div><div className="min-w-0"><span className="text-xs text-slate-500" dir="ltr">{p.code}</span><h3 className="font-bold text-sm leading-7">{p.name}</h3><span className="text-xs text-slate-500">{p.brand}</span></div></Link>
    <Link className="mt-auto flex gap-2 items-center justify-between border-t border-slate-100 px-4 min-h-12 text-sm text-[#a5450e] bg-orange-50" to={`/ai-consult?industry=${industry.slug}&q=${encodeURIComponent(`برای محصول ${p.name} با کد ${p.code} در صنعت ${industry.title} مشاوره می‌خواهم. ابتدا کاربرد و شرایط کار من را بپرس و مشخصات را فقط از کاتالوگ تأییدشده بیان کن.`)}`}><span className="flex gap-2 items-center"><MessageSquare size={17}/>مشاوره انتخاب این قطعه</span><ArrowUpLeft size={17}/></Link>
   </article>)}
  </div>
  {!products.length&&<div role="status" className="p-6 border border-dashed border-slate-300 rounded-2xl text-sm leading-8">در داده‌های فعلی محصولی با این فیلتر پیدا نشد. نام یا گروه دیگری انتخاب کنید؛ این نتیجه به معنی ناممکن بودن تأمین نیست.</div>}
  {products.length>12&&<Link className="inline-flex min-h-12 items-center mt-4 text-sm font-bold" to={`/products?q=${encodeURIComponent(query||term||industry.terms[0])}`}>ادامه بررسی در کاتالوگ <ArrowUpLeft size={18}/></Link>}
 </section>;
}
