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
  products, onEdit, onCreateFamily,
}: {
  products: Product[];
  onEdit: (familyCode: string, file: string) => void;
  onCreateFamily?: () => void;
}) {
  const [opened, setOpened] = useState(true);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [page, setPage] = useState(0);
  const [view, setView] = useState<'grid'|'list'>('grid');
  const [selected, setSelected] = useState<string | null>(null);
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
  const families = products.filter(p =>
    normalizeCatalogueText(p.code + ' ' + p.name + ' ' + (p.variants || []).map(v => v.code + ' ' + v.name).join(' ')).includes(normalizeCatalogueText(familyQuery))
  ).slice(0, 30);
  const download = () => {
    const blob = new Blob([JSON.stringify(audit, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = 'sanatpish-image-assignments.json'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const openAssignment = (row: AuditRow) => { setSelected(row.file); setFamilyQuery(row.families[0]?.name || ''); };
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
          {onCreateFamily && <button type="button" onClick={onCreateFamily} className="flex items-center gap-1.5 bg-[#E06518] text-white rounded-xl px-3 py-2.5 text-xs font-bold"><ImagePlus size={16}/> افزودن خانواده و تصویر</button>}
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
    <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="اتصال تصویر به خانواده و بررسی کد">
      <div className="space-y-4" dir="rtl">
        {selectedRow && <div className="flex items-center gap-3 rounded-xl bg-[#FAFAFB] p-3"><div className="w-20 h-20 shrink-0"><ProductImage src={getProductImageUrl(selectedRow.file)} alt={selectedRow.observed} className="w-full h-full object-contain"/></div><div className="min-w-0 text-xs space-y-1"><strong dir="ltr" className="block">{selectedRow.file}</strong><p className="line-clamp-2">{selectedRow.observed}</p><p className="text-amber-700">انتخاب خانواده به‌تنهایی کد SKU را تأیید نمی‌کند.</p></div></div>}
        <p className="text-xs text-slate-600 leading-6">خانواده را انتخاب کنید تا ویرایشگر واقعی محصول باز شود. در آنجا تصویر را به کد مشخص وصل کنید و پس از بررسی شاهد کاتالوگ، تغییرات را ذخیره کنید.</p>
        <label className="block text-xs font-bold text-[#55565A]">جستجوی خانواده یا کد کالا<input aria-label="جستجوی خانواده برای تصویر" autoFocus value={familyQuery} onChange={e=>setFamilyQuery(e.target.value)} className="mt-2 w-full rounded-xl border border-[#E3E5E9] p-3" placeholder="عنوان، کد خانواده یا SKU"/></label>
        <div className="max-h-[45vh] overflow-y-auto space-y-2" role="list">
          {families.map(f=><button type="button" key={f.code} onClick={()=>{if(selected)onEdit(f.code,selected);setSelected(null)}} className="block w-full rounded-xl border border-[#ECEDEF] hover:border-[#E06518] p-3 text-right text-xs"><strong className="block">{f.name}</strong><span dir="ltr" className="text-slate-500">{f.code}</span><span className="block text-[11px] text-slate-500 mt-1">{fa(f.variants?.length||0)} کد در این خانواده</span></button>)}
          {families.length===0&&<p className="text-center text-sm text-slate-500 py-5">خانواده‌ای پیدا نشد.</p>}
        </div>
        <div className="flex justify-between gap-2 border-t pt-3">
          {onCreateFamily && <button type="button" onClick={()=>{setSelected(null);onCreateFamily()}} className="text-xs border border-[#F3C9AD] text-[#C15112] rounded-xl px-3 py-2 flex items-center gap-1"><ImagePlus size={15}/> تعریف خانواده جدید</button>}
          <button type="button" onClick={()=>setSelected(null)} className="text-xs border rounded-xl px-3 py-2 flex items-center gap-1"><X size={15}/> انصراف</button>
        </div>
      </div>
    </Modal>
  </section>;
}
