import React, { useMemo, useState } from 'react';
import type { Product } from '../../types';
import { getImageAssignmentAudit } from '../../data/imageAssignments';
import { getProductImageUrl } from '../../assets/imagesproducts';
import { ProductImage } from '../../components/product/ProductImage';
import { normalizeCatalogueText } from '../../data/userProducts';
import { Modal } from '../../components/ui/Modal';

export function ProductImageAudit({products,onEdit}:{products:Product[];onEdit:(familyCode:string,file:string)=>void}) {
  const [query,setQuery]=useState('');const [status,setStatus]=useState('all');const [page,setPage]=useState(0);
  const [selected,setSelected]=useState<string|null>(null);const [familyQuery,setFamilyQuery]=useState('');
  const audit=useMemo(()=>getImageAssignmentAudit(products),[products]);
  const filtered=useMemo(()=>audit.filter(row=>(status==='all'||row.status===status||(status==='catalogue-photo'&&!!row.ownerCatalogue))&&normalizeCatalogueText([row.file,row.observed,row.research?.visualType,row.research?.visibleFeatures,row.ownerCatalogue?.catalogueGroup,...row.families.flatMap(f=>[f.code,f.name,...f.skus.flatMap(v=>[v.code,v.name])])].join(' ')).includes(normalizeCatalogueText(query))),[audit,query,status]);
  const pageCount=Math.max(1,Math.ceil(filtered.length/24));const activePage=Math.min(page,pageCount-1);
  const families=products.filter(p=>normalizeCatalogueText(p.code+' '+p.name+' '+(p.variants||[]).map(v=>v.code+' '+v.name).join(' ')).includes(normalizeCatalogueText(familyQuery))).slice(0,30);
  const download=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(audit,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='sanatpish-image-assignments.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  return <details className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
    <summary className="cursor-pointer font-bold text-[#55565A]">بررسی تصویر، خانواده و کد کالا — {audit.length.toLocaleString('fa-IR')} تصویر</summary>
    <p className="text-xs leading-6 text-slate-600">تصویر نمونهٔ خانواده با تصویر کد کالا متفاوت است. نام فایل و شمارهٔ عکس، کد انبار نیست. حتی خانوادهٔ تک‌کد بدون شاهد کاتالوگ، اتصال قطعی محسوب نمی‌شود.</p>
    <div className="flex flex-wrap gap-2 text-xs">
      <input aria-label="جستجوی تصاویر و کدهای متصل" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}} placeholder="نام، کد یا شماره تصویر" className="min-w-48 rounded-xl border p-2" />
      <select aria-label="وضعیت اتصال تصویر" value={status} onChange={e=>{setStatus(e.target.value);setPage(0)}} className="rounded-xl border p-2"><option value="all">همهٔ تصاویر</option><option value="sku-linked">دارای اتصال به کد کالا</option><option value="family-example">نمونهٔ خانواده</option><option value="unassigned">نیازمند تعیین خانواده</option><option value="catalogue-photo">عکس و عنوان در کاتالوگ پیدا شده</option></select>
      <button type="button" onClick={download} className="rounded-xl border px-3 text-[#E06518]">خروجی همهٔ تصاویر و اتصال‌ها</button>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">{filtered.slice(activePage*24,activePage*24+24).map(row=><article key={row.file} className="rounded-xl border border-slate-200 p-3 space-y-2 text-xs">
      <ProductImage src={getProductImageUrl(row.file)} alt={row.observed} className="h-32 w-full object-contain" />
      {row.ownerCatalogue&&<div className="rounded-lg border border-emerald-100 bg-emerald-50/40 p-2 leading-6"><strong>عنوان گروه در کاتالوگ: {row.ownerCatalogue.catalogueGroup}</strong><p>صفحهٔ چاپی {row.ownerCatalogue.printedPage}؛ صفحهٔ PDF {row.ownerCatalogue.page}</p><p>خود عکس و عنوان گروه تطبیق دارد؛ اتصال به کد انبار و سایز دقیق هنوز تأیید نشده است.</p></div>}
      <strong dir="ltr">{row.file}</strong>{row.research && <div className="rounded-lg border border-orange-100 bg-orange-50/30 p-2 space-y-2"><strong>{row.research.visualType}</strong><p className="leading-5">{row.research.visibleFeatures}</p><p className="leading-5">برای تعیین مدل: {row.research.requiredChecks.join('، ')}</p><p>استاندارد و کد دقیق هنوز تأیید نشده‌اند.</p></div>}<p className="leading-5 text-slate-600">{row.observed}</p>
      {row.families.map(f=><div key={f.code} className="rounded-lg bg-slate-50 p-2 leading-6"><p>خانواده: {f.name} ({f.code})</p><p>{f.category}</p>{f.skus.length ? f.skus.map(v=><p key={v.code}>کد متصل‌شده: {v.code} — {v.name}</p>) : <p>نمونهٔ خانواده؛ {f.candidateSkuCount.toLocaleString('fa-IR')} کد احتمالی، بدون کد تأییدشده</p>}</div>)}
      {!row.families.length&&<p className="text-amber-700">خانواده و کد هنوز تأیید نشده است</p>}
      {!!row.duplicateFiles.length&&<p>فایل تکراریِ یکسان: {row.duplicateFiles.join('، ')}</p>}
      <button type="button" onClick={()=>{setSelected(row.file);setFamilyQuery(row.families[0]?.name||'')}} className="rounded-lg border px-3 py-2 font-bold text-[#E06518]">بررسی و اتصال به خانواده / کد</button>
    </article>)}</div>
    <div className="flex gap-3 items-center text-xs"><button type="button" disabled={activePage===0} onClick={()=>setPage(activePage-1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">قبلی</button><span>{activePage+1} / {pageCount} — {filtered.length.toLocaleString('fa-IR')} تصویر</span><button type="button" disabled={activePage===pageCount-1} onClick={()=>setPage(activePage+1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">بعدی</button></div>
    <Modal isOpen={!!selected} onClose={()=>setSelected(null)} title="انتخاب خانواده برای بررسی تصویر"><div className="space-y-3"><p className="text-xs leading-6">پس از انتخاب خانواده، تصویر به پیش‌نویس ویرایشگر اضافه می‌شود. کد دقیق را با مدرک تعیین کنید و سپس ذخیره کنید.</p><input aria-label="جستجوی خانواده برای تصویر" value={familyQuery} onChange={e=>setFamilyQuery(e.target.value)} className="w-full rounded-xl border p-3" placeholder="نام خانواده یا کد کالا" />{families.map(f=><button type="button" key={f.code} onClick={()=>{if(selected)onEdit(f.code,selected);setSelected(null)}} className="block w-full rounded-xl border p-3 text-right text-xs">{f.name} — {f.code}</button>)}</div></Modal>
  </details>;
}
