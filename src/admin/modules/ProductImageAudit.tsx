import React, { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, ClipboardCheck, Download, Filter, ImagePlus, LayoutGrid, List, Search, X } from 'lucide-react';
import type { Product } from '../../types';
import { getImageAssignmentAudit } from '../../data/imageAssignments';
import { getProductImageUrl } from '../../assets/imagesproducts';
import { ProductImage } from '../../components/product/ProductImage';
import { normalizeCatalogueText } from '../../data/userProducts';
import { Modal } from '../../components/ui/Modal';

type AuditRow = ReturnType<typeof getImageAssignmentAudit>[number];
type StatusFilter = 'all' | 'sku-linked' | 'family-example' | 'unassigned' | 'catalogue-photo';
const fa = (n: number) => n.toLocaleString('fa-IR');
const filters: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'همه تصاویر' },
  { value: 'unassigned', label: 'بدون خانواده' },
  { value: 'family-example', label: 'نمونه خانواده' },
  { value: 'sku-linked', label: 'متصل به کد کالا' },
  { value: 'catalogue-photo', label: 'دارای شاهد کاتالوگ' },
];
function statusText(row: AuditRow) {
  if (row.status === 'sku-linked') return 'دارای اتصال کد';
  if (row.status === 'family-example') return 'فقط خانواده';
  return 'بدون اتصال';
}
function statusStyle(row: AuditRow) {
  if (row.status === 'sku-linked') return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (row.status === 'family-example') return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-rose-700 bg-rose-50 border-rose-200';
}
export function ProductImageAudit({
  products, categories, onEdit, onCreateFamily, onCreateCategory, onCreateSku,
}: {
  products: Product[];
  categories: {name:string;subcategories?:string[]}[];
  onEdit: (familyCode:string,file:string,skuCode?:string,imageUrl?:string,imageTitle?:string)=>void;
  onCreateFamily: (file:string,category:string,subcategory:string,imageUrl?:string,imageTitle?:string)=>void;
  onCreateCategory: ()=>void;
  onCreateSku: (familyCode:string,file:string,imageUrl?:string,imageTitle?:string)=>void;
}) {
  const [opened, setOpened] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedUrl,setSelectedUrl]=useState('');
  const [sourceMode,setSourceMode]=useState<'existing'|'upload'|'url'>('existing');
  const [newImageUrl,setNewImageUrl]=useState('');
  const [sourceError,setSourceError]=useState('');
  const [imageTitle,setImageTitle]=useState('');
  const [selectedCategory,setSelectedCategory]=useState('');
  const [selectedSubcategory,setSelectedSubcategory]=useState('');
  const [selectedFamily,setSelectedFamily]=useState('');
  const [selectedSku,setSelectedSku]=useState('');
  const [location,setLocation]=useState<'family'|'sku'>('family');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [familyQuery, setFamilyQuery] = useState('');
  const [familyFilter, setFamilyFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(false);
  const audit = useMemo(() => getImageAssignmentAudit(products), [products]);
  const counts = useMemo(() => ({
    unassigned: audit.filter(x => x.status === 'unassigned').length,
    family: audit.filter(x => x.status === 'family-example').length,
    sku: audit.filter(x => x.status === 'sku-linked').length,
    catalogue: audit.filter(x => !!x.ownerCatalogue).length,
  }), [audit]);
  const familyChoices = useMemo(() => [...new Map(audit.flatMap(x => x.families.map(f => [f.code, f.name] as const))).entries()].sort((a,b) => a[1].localeCompare(b[1], 'fa')), [audit]);
  const filtered = useMemo(() => audit.filter(row => {
    if (status !== 'all' && (status === 'catalogue-photo' ? !row.ownerCatalogue : row.status !== status)) return false;
    if (familyFilter === 'none' && row.families.length) return false;
    if (familyFilter !== 'all' && familyFilter !== 'none' && !row.families.some(f => f.code === familyFilter)) return false;
    const haystack = [
      row.file, row.observed, row.research?.visualType, row.research?.visibleFeatures,
      row.ownerCatalogue?.catalogueGroup,
      ...row.families.flatMap(f => [f.code, f.name, ...f.skus.flatMap(v => [v.code, v.name])]),
    ].join(' ');
    return normalizeCatalogueText(haystack).includes(normalizeCatalogueText(query.trim()));
  }), [audit, status, familyFilter, query]);
  const perPage = view === 'grid' ? 18 : 24;
  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const activePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(activePage * perPage, (activePage + 1) * perPage);
  const selectedRow = audit.find(row => row.file === selected);
  const families=products.filter(p=>
    (!selectedCategory||p.categoryName===selectedCategory)
    &&(!selectedSubcategory||p.subcategory===selectedSubcategory)
    &&normalizeCatalogueText(p.code+' '+p.name+' '+(p.variants||[]).map(v=>v.code+' '+v.name).join(' ')).includes(normalizeCatalogueText(familyQuery))
  ).slice(0,80);
  const currentFamily=products.find(p=>p.code===selectedFamily);
  const categoryOptions=Array.from(new Set([...categories.map(c=>c.name),...products.map(p=>p.categoryName)].filter(Boolean))).sort((a,b)=>a.localeCompare(b,'fa'));
  const subcategoryOptions=Array.from(new Set([
    ...(categories.find(c=>c.name===selectedCategory)?.subcategories||[]),
    ...products.filter(p=>p.categoryName===selectedCategory).map(p=>p.subcategory||'')
  ].filter(Boolean))).sort((a,b)=>a.localeCompare(b,'fa'));
  const chooseImage=(file:string)=>{
    setSelected(file);setSelectedUrl(getProductImageUrl(file));setSourceMode('existing');setSourceError('');setImageTitle('');setFamilyQuery('');setSelectedCategory('');setSelectedSubcategory('');
    setSelectedFamily('');setSelectedSku('');setLocation('family');
  };
  const openEditor=()=>{
    if(!selectedFamily||!selected)return;
    if(location==='sku'&&!selectedSku)return;
    onEdit(selectedFamily,selected,location==='sku'?selectedSku:undefined,selectedUrl,imageTitle);
    setSelected(null);
  };
  const openNewImage=()=>{setSelected(null);setSelectedUrl('');setImageTitle('');setSourceMode('upload');setSourceError('');setSelectedFamily('');setSelectedCategory('');setSelectedSubcategory('');setSelectedSku('');setLocation('family')};
  const loadFile=(file?:File)=>{
    if(!file)return;
    if(!file.type.startsWith('image/')){setSourceError('فقط فایل تصویر قابل انتخاب است.');return;}
    if(file.size>5*1024*1024){setSourceError('اندازه تصویر باید کمتر از ۵ مگابایت باشد.');return;}
    const reader=new FileReader();
    reader.onload=()=>{setSelected(file.name);setSelectedUrl(String(reader.result||''));setSourceError('');setImageTitle(file.name)};
    reader.onerror=()=>setSourceError('خواندن فایل انجام نشد.');
    reader.readAsDataURL(file);
  };
  const setLinkImage=()=>{
    const link=newImageUrl.trim();
    if(!/^https?:\/\/[^\s]+$/i.test(link)){setSourceError('لینک تصویر باید با http یا https آغاز شود.');return;}
    setSelected(link.split('/').pop()?.split('?')[0]||'تصویر جدید');
    setSelectedUrl(link);setImageTitle('');setSourceError('');
  };
  const download = () => {
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'sanatpish-image-assignments.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const openAssignment = (row: AuditRow) => { chooseImage(row.file); setFamilyQuery(row.families[0]?.name || ''); };
  const selectFilter = (value: StatusFilter) => { setStatus(value); setPage(0); };
  const resetFilters = () => { setQuery(''); setStatus('all'); setFamilyFilter('all'); setPage(0); };
  const hasFilters = !!query || status !== 'all' || familyFilter !== 'all';

  return <section aria-label="بررسی و اتصال تصاویر کاتالوگ" className="rounded-2xl border border-[#E8EAEE] bg-white overflow-hidden">
    <header className="p-4 sm:p-5 border-b border-[#F0F0F2] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm sm:text-base font-black text-[#55565A]">بررسی تصویر، خانواده و کد کالا <span className="text-[#E06518]">({fa(audit.length)})</span></h3>
          <p className="text-xs text-slate-500 mt-1">ابتدا تصویر را پیدا کنید؛ سپس اتصال به خانواده و کد را با شاهد کاتالوگ بررسی کنید.</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <button type="button" onClick={openNewImage} className="flex items-center gap-1.5 bg-[#E06518] text-white rounded-xl px-3 py-2.5 text-xs font-bold"><ImagePlus size={16}/> افزودن تصویر و تکمیل محصول</button>
          <button type="button" onClick={download} className="flex items-center gap-1.5 border border-[#E8EAEE] text-[#55565A] rounded-xl px-3 py-2.5 text-xs font-bold" title="خروجی تمام تصاویر و اتصال‌ها"><Download size={16}/> خروجی</button>
          <button type="button" onClick={() => setOpened(v => !v)} aria-expanded={opened} aria-label={opened ? 'بستن بخش تصاویر' : 'بازکردن بخش تصاویر'} className="border border-[#E8EAEE] rounded-xl p-2.5"><ChevronDown size={17} className={opened ? 'rotate-180' : ''}/></button>
        </div>
      </div>
      <p className="text-[11px] text-[#7B7C80]">اتصال ثبت‌شده به SKU به معنی تأیید قطعی مدل، سایز یا استاندارد نیست؛ تأیید فقط با مدرک فنی انجام می‌شود.</p>
    </header>
    {opened && <div className="p-3 sm:p-5 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3" aria-label="خلاصه وضعیت تصاویر">
        {[
          {label:'همه تصاویر',value:audit.length,key:'all' as StatusFilter},
          {label:'بدون خانواده',value:counts.unassigned,key:'unassigned' as StatusFilter},
          {label:'فقط خانواده',value:counts.family,key:'family-example' as StatusFilter},
          {label:'متصل به کد',value:counts.sku,key:'sku-linked' as StatusFilter},
        ].map(item => <button type="button" key={item.key} onClick={() => selectFilter(item.key)} aria-pressed={status === item.key} className={`text-right rounded-xl border p-3 min-h-20 transition-colors ${status === item.key ? 'bg-[#FFF6EF] border-[#E06518]' : 'bg-[#FAFAFB] border-[#ECEDEF] hover:border-[#F1C6AA]'}`}><span className="block text-xs text-[#77787C]">{item.label}</span><strong className="block text-lg mt-1 text-[#55565A]">{fa(item.value)}</strong></button>)}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex-1 min-w-[190px]">
          <Search size={16} aria-hidden="true" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#898A8D]"/>
          <input aria-label="جستجوی تصاویر و کدهای متصل" value={query} onChange={e => {setQuery(e.target.value);setPage(0)}} placeholder="جستجو: نام، کد، شماره تصویر…" className="w-full rounded-xl border border-[#E3E5E9] py-2.5 pr-10 pl-3 text-sm outline-none focus:border-[#E06518]"/>
        </label>
        <button type="button" aria-expanded={showFilters} onClick={() => setShowFilters(v => !v)} className={`rounded-xl border px-3 py-2.5 flex gap-1.5 items-center text-xs font-bold ${showFilters ? 'bg-[#FFF6EF] border-[#E06518] text-[#C35311]' : 'border-[#E3E5E9] text-[#55565A]'}`}><Filter size={15}/> فیلترها</button>
        <div className="flex rounded-xl border border-[#E3E5E9] p-1" role="group" aria-label="نوع نمایش">
          <button type="button" onClick={() => {setView('grid');setPage(0)}} aria-label="نمایش کارت‌ها" aria-pressed={view==='grid'} className={`p-1.5 rounded-lg ${view==='grid'?'bg-[#FFF0E5] text-[#E06518]':'text-[#8D8E91]'}`}><LayoutGrid size={18}/></button>
          <button type="button" onClick={() => {setView('list');setPage(0)}} aria-label="نمایش فهرست" aria-pressed={view==='list'} className={`p-1.5 rounded-lg ${view==='list'?'bg-[#FFF0E5] text-[#E06518]':'text-[#8D8E91]'}`}><List size={18}/></button>
        </div>
      </div>
      {showFilters && <div className="rounded-xl bg-[#FAFAFB] border border-[#E8EAEE] p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs font-bold text-[#55565A]">وضعیت اتصال<select aria-label="وضعیت اتصال تصویر" value={status} onChange={e => selectFilter(e.target.value as StatusFilter)} className="mt-1 w-full rounded-xl border border-[#E3E5E9] bg-white p-2.5">{filters.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></label>
        <label className="text-xs font-bold text-[#55565A]">خانواده کالا<select aria-label="فیلتر خانواده تصویر" value={familyFilter} onChange={e => {setFamilyFilter(e.target.value);setPage(0)}} className="mt-1 w-full rounded-xl border border-[#E3E5E9] bg-white p-2.5"><option value="all">همه خانواده‌ها</option><option value="none">بدون خانواده</option>{familyChoices.map(([code,name])=><option key={code} value={code}>{name} — {code}</option>)}</select></label>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-slate-500">{fa(counts.catalogue)} تصویر شاهد عنوان/گروه کاتالوگ دارند؛ این شاهد به‌تنهایی کد دقیق را تأیید نمی‌کند.</span><button type="button" onClick={resetFilters} className="text-xs text-[#E06518] border border-[#F3D5C0] rounded-lg px-3 py-2">پاک‌کردن فیلترها</button></div>
      </div>}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-500"><span>نمایش {fa(filtered.length)} تصویر {hasFilters && <button type="button" onClick={resetFilters} className="mr-2 text-[#E06518] underline">حذف فیلتر</button>}</span><span>صفحه {fa(activePage+1)} از {fa(pageCount)}</span></div>
      {visible.length===0 && <div role="status" className="text-center py-14 border border-dashed rounded-xl text-sm text-[#77787C]">تصویری با این جستجو و فیلترها پیدا نشد. <button type="button" className="text-[#E06518] underline" onClick={resetFilters}>نمایش همه</button></div>}
      <div className={view==='grid'?'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3':'flex flex-col gap-2'}>
        {visible.map(row => <article key={row.file} className={`border border-[#E8EAEE] rounded-xl bg-white hover:border-[#EFC4A7] transition-colors p-3 ${view==='list'?'flex flex-wrap sm:flex-nowrap items-center gap-3':'space-y-3'}`}>
          <div className={view==='list'?'w-24 h-24 shrink-0 bg-[#F9FAFB] rounded-lg flex items-center justify-center':'h-36 bg-[#F9FAFB] rounded-lg flex items-center justify-center'}>
            <ProductImage src={getProductImageUrl(row.file)} alt={row.observed||row.file} className="w-full h-full object-contain p-2" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong dir="ltr" className="text-xs font-mono text-[#55565A]">{row.file}</strong>
              <span className={`border rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyle(row)}`}>{statusText(row)}</span>
            </div>
            <p className="text-xs text-[#55565A] line-clamp-2">{row.observed}</p>
            <div className="text-[11px] text-slate-500 space-y-1">
              <p className="truncate">خانواده: <span className="font-bold text-[#55565A]">{row.families.length ? row.families.map(f=>f.name).join('، ') : 'تعیین نشده'}</span></p>
              <p className="truncate">کد SKU: <span dir="ltr" className="font-semibold text-[#55565A]">{row.families.flatMap(f=>f.skus.map(v=>v.code)).join('، ')||'تأیید نشده'}</span></p>
              {row.ownerCatalogue && <p className="text-emerald-700">شاهد کاتالوگ: صفحه PDF {row.ownerCatalogue.page}</p>}
            </div>
            {expanded===row.file && <div className="space-y-2 rounded-lg bg-[#FAFAFB] border border-[#ECEDEF] p-3 text-xs leading-6">
              {row.research && <><p><strong>نوع ظاهری:</strong> {row.research.visualType}</p><p>{row.research.visibleFeatures}</p><p><strong>نیازمند بررسی:</strong> {row.research.requiredChecks.join('، ')}</p></>}
              {row.ownerCatalogue && <><p><strong>گروه در کاتالوگ:</strong> {row.ownerCatalogue.catalogueGroup}</p><p>صفحه چاپی {row.ownerCatalogue.printedPage}، صفحه PDF {row.ownerCatalogue.page}</p></>}
              {row.families.map(f=><div key={f.code} className="border-t pt-2"><p><strong>{f.name}</strong> ({f.code})</p><p>{f.category}</p>{f.skus.length?f.skus.map(v=><p key={v.code}>کد متصل: {v.code} — {v.name}</p>):<p>{fa(f.candidateSkuCount)} کد کاندید، بدون اتصال تأییدشده</p>}</div>)}
              {row.duplicateFiles.length>0 && <p>تصاویر با محتوای یکسان: {row.duplicateFiles.join('، ')}</p>}
              <p className="font-semibold text-amber-700">نام عکس و ظاهر قطعه، تأیید کد فنی محسوب نمی‌شود.</p>
            </div>}
            <div className="flex flex-wrap gap-2 items-center">
              <button type="button" onClick={() => openAssignment(row)} className="bg-[#E06518] text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5"><ClipboardCheck size={14}/> بررسی و اتصال</button>
              <button type="button" onClick={()=>setExpanded(v=>v===row.file?null:row.file)} aria-expanded={expanded===row.file} className="border border-[#E3E5E9] text-[#55565A] rounded-lg px-3 py-2 text-xs">{expanded===row.file?'بستن جزئیات':'جزئیات فنی'}</button>
            </div>
          </div>
        </article>)}
      </div>
      <nav aria-label="صفحه‌بندی تصاویر" className="flex items-center justify-center gap-3 pt-2">
        <button type="button" disabled={activePage===0} onClick={()=>setPage(activePage-1)} className="flex items-center gap-1 border rounded-xl px-3 py-2 text-xs disabled:opacity-40"><ChevronRight size={15}/> قبلی</button>
        <span className="text-xs text-[#55565A]">{fa(activePage+1)} / {fa(pageCount)}</span>
        <button type="button" disabled={activePage>=pageCount-1} onClick={()=>setPage(activePage+1)} className="flex items-center gap-1 border rounded-xl px-3 py-2 text-xs disabled:opacity-40">بعدی <ChevronLeft size={15}/></button>
      </nav>
    </div>}
    <Modal isOpen={!!selectedUrl||sourceMode!=='existing'} onClose={()=>{setSelected(null);setSelectedUrl('');setSourceMode('existing')}} title="تکمیل اطلاعات تصویر و محصول">
      <div className="space-y-4 max-h-[78vh] overflow-y-auto p-1" dir="rtl">
        <div className="rounded-xl border bg-white p-3 space-y-3">
          <strong className="text-xs text-[#55565A]">۱. انتخاب تصویر</strong>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={()=>{setSourceMode('existing');setSelected(null);setSelectedUrl('')}} className={`px-3 py-2 rounded-xl border text-xs ${sourceMode==='existing'?'bg-[#FFF3EA] border-[#E06518]':'bg-white'}`}>بانک ۸۶۹ تصویر</button>
            <button type="button" onClick={()=>{setSourceMode('upload');setSelected(null);setSelectedUrl('')}} className={`px-3 py-2 rounded-xl border text-xs ${sourceMode==='upload'?'bg-[#FFF3EA] border-[#E06518]':'bg-white'}`}>فایل جدید</button>
            <button type="button" onClick={()=>{setSourceMode('url');setSelected(null);setSelectedUrl('')}} className={`px-3 py-2 rounded-xl border text-xs ${sourceMode==='url'?'bg-[#FFF3EA] border-[#E06518]':'bg-white'}`}>لینک تصویر</button>
          </div>
          {sourceMode==='existing'&&!selectedUrl&&<p className="text-xs text-slate-500">تصویر موجود را از کارت‌های این صفحه با دکمه «بررسی و اتصال» انتخاب کنید.</p>}
          {sourceMode==='upload'&&<label className="block text-xs font-bold text-slate-700">انتخاب تصویر از دستگاه (حداکثر ۵ مگابایت)
            <input type="file" accept="image/*" onChange={e=>loadFile(e.target.files?.[0])} className="mt-2 block w-full rounded-xl border p-3 text-xs"/>
          </label>}
          {sourceMode==='url'&&<div className="flex flex-col sm:flex-row gap-2">
            <input type="url" dir="ltr" value={newImageUrl} onChange={e=>setNewImageUrl(e.target.value)} placeholder="https://example.com/photo.png" className="flex-1 min-w-0 rounded-xl border p-3 text-xs"/>
            <button type="button" onClick={setLinkImage} className="rounded-xl bg-[#55565A] text-white px-4 py-2 text-xs">انتخاب لینک</button>
          </div>}
          {sourceError&&<p role="alert" className="text-xs text-rose-700">{sourceError}</p>}
        </div>
        {selectedUrl&&<div className="flex gap-3 items-center rounded-xl bg-[#FAFAFB] border p-3">
          {selectedUrl&&<ProductImage src={selectedUrl} alt={selected||"تصویر محصول"} className="w-20 h-20 rounded-xl object-contain bg-white shrink-0"/>}
          <div className="min-w-0"><b className="text-sm text-[#55565A]">این تصویر متعلق به کجاست؟</b><p className="text-xs text-slate-500 mt-1" dir="ltr">{selected}</p><p className="text-[11px] text-amber-700 mt-1">پیشنهادها تأیید هویت فنی نیستند؛ شما محل و کد نهایی را تعیین می‌کنید.</p></div>
        </div>}
        {selectedUrl&&<label className="block text-xs font-bold text-slate-700">نام یا توضیح تصویر
          <input value={imageTitle} onChange={e=>setImageTitle(e.target.value)} placeholder="مثلاً تصویر نمای جلو" className="w-full mt-2 border rounded-xl p-3"/>
          <span className="block text-[11px] text-slate-500 mt-1">نام محصول، کد و مشخصات فنی در ویرایشگر کالا تکمیل می‌شوند. برای فایل جدید، ذخیره دائمی در فضای ابری تصاویر باید در تنظیمات سرور فعال باشد؛ پیش‌نمایش فایل در مرورگر به‌تنهایی نگهداری دائمی نیست.</span>
        </label>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs font-bold text-slate-700">۱. دسته‌بندی
            <select value={selectedCategory} onChange={e=>{setSelectedCategory(e.target.value);setSelectedSubcategory('');setSelectedFamily('');setSelectedSku('')}} className="mt-1.5 w-full p-3 rounded-xl border bg-white">
              <option value="">همه دسته‌بندی‌ها</option>{categoryOptions.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className="text-xs font-bold text-slate-700">۲. زیردسته
            <select disabled={!selectedCategory} value={selectedSubcategory} onChange={e=>{setSelectedSubcategory(e.target.value);setSelectedFamily('');setSelectedSku('')}} className="mt-1.5 w-full p-3 rounded-xl border bg-white disabled:opacity-50">
              <option value="">همه زیردسته‌ها</option>{subcategoryOptions.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <button type="button" className="text-xs text-[#C65A16] underline" onClick={()=>{setSelected(null);onCreateCategory()}}>+ افزودن دسته‌بندی یا زیردسته جدید</button>
        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-700">۳. خانواده کالا</label>
          <input value={familyQuery} onChange={e=>setFamilyQuery(e.target.value)} placeholder="جستجوی نام خانواده، کد خانواده یا SKU" className="w-full border rounded-xl p-3 text-sm"/>
          <select aria-label="انتخاب خانواده" size={Math.min(5,Math.max(2,families.length+1))} value={selectedFamily} onChange={e=>{setSelectedFamily(e.target.value);setSelectedSku('')}} className="w-full p-2 border rounded-xl bg-white text-xs">
            <option value="">خانواده را انتخاب کنید...</option>
            {families.map(f=><option key={f.code} value={f.code}>{f.name} — {f.code}</option>)}
          </select>
          <button type="button" className="text-xs text-[#C65A16] underline" onClick={()=>{if(selected){onCreateFamily(selected,selectedCategory,selectedSubcategory,selectedUrl,imageTitle);setSelected(null)}}}>+ تعریف خانواده و کالای جدید برای همین تصویر</button>
        </div>
        {currentFamily&&<div className="rounded-xl border border-[#F4D4BE] bg-[#FFF9F5] p-3 space-y-3">
          <button type="button" onClick={()=>{if(selected&&selectedUrl){onCreateSku(currentFamily.code,selected,selectedUrl,imageTitle);setSelected(null);setSelectedUrl('');setSourceMode('existing')}}}
            className="rounded-xl border border-[#E06518] text-[#C65A16] bg-white px-3 py-2.5 text-xs font-bold">
            + تعریف کد کالای جدید و مشخصات فنی در این خانواده
          </button>
          <strong className="text-xs text-[#55565A]">۴. محل اتصال تصویر</strong>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex gap-2 items-center rounded-xl bg-white border p-3 text-xs"><input type="radio" name="attach-place" checked={location==='family'} onChange={()=>{setLocation('family');setSelectedSku('')}}/> تصویر عمومی خانواده</label>
            <label className="flex gap-2 items-center rounded-xl bg-white border p-3 text-xs"><input type="radio" name="attach-place" checked={location==='sku'} onChange={()=>setLocation('sku')}/> تصویر مخصوص یک کد کالا</label>
          </div>
          {location==='sku'&&<label className="block text-xs font-bold text-slate-700">کد کالای دقیق
            <select value={selectedSku} onChange={e=>setSelectedSku(e.target.value)} className="mt-1.5 w-full border rounded-xl p-3 bg-white">
              <option value="">انتخاب کد کالا الزامی است</option>{(currentFamily.variants||[]).map(v=><option value={v.code} key={v.code}>{v.code} — {v.name}</option>)}
            </select>
          </label>}
          <p className="text-[11px] text-slate-600">برای افزودن کد جدید، تغییر نام، سایز، مشخصات فنی و سایر اطلاعات، وارد ویرایشگر خانواده شوید. تصویر در پیش‌نویس قرار می‌گیرد و فقط پس از ذخیره نهایی ثبت می‌شود.</p>
        </div>}
        <div className="sticky bottom-0 bg-white border-t pt-3 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={()=>{setSelected(null);setSelectedUrl('');setSourceMode('existing')}} className="border rounded-xl px-4 py-2.5 text-xs">انصراف</button>
          <button type="button" onClick={openEditor} disabled={!selectedUrl||!selectedFamily||(location==='sku'&&!selectedSku)} className="bg-[#E06518] text-white rounded-xl px-5 py-2.5 text-xs font-bold disabled:opacity-50">ادامه در ویرایشگر و بررسی مشخصات</button>
        </div>
      </div>
    </Modal>
  </section>;
}
