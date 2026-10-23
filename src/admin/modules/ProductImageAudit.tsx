import React, {useMemo,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Download,ImagePlus,Search,SlidersHorizontal,X,FolderPlus,FileImage,ArrowLeft,Info} from 'lucide-react';
import type {Product} from '../../types';
import {getImageAssignmentAudit} from '../../data/imageAssignments';
import {getProductImageUrl} from '../../assets/imagesproducts';
import {ProductImage} from '../../components/product/ProductImage';
import {normalizeCatalogueText} from '../../data/userProducts';

type AuditRow=ReturnType<typeof getImageAssignmentAudit>[number];
type Filter='all'|'sku-linked'|'family-example'|'unassigned'|'catalogue-photo';
type StorageChoice='family'|'sku';
type Source='existing'|'upload'|'url';
const fa=(n:number)=>n.toLocaleString('fa-IR');
const statusLabel=(r:AuditRow)=>r.status==='sku-linked'?'کد متصل':r.status==='family-example'?'فقط خانواده':'بدون اتصال';
const statusColor=(r:AuditRow)=>r.status==='sku-linked'?'bg-emerald-50 text-emerald-700':r.status==='family-example'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700';
const card='rounded-xl border border-[#E7E8EA] bg-white';
export function ProductImageAudit({products,categories,onEdit,onCreateFamily,onCreateCategory,onCreateSku}:{
  products:Product[];
  categories:{name:string;subcategories?:string[]}[];
  onEdit:(familyCode:string,file:string,skuCode?:string,imageUrl?:string,imageTitle?:string)=>void;
  onCreateFamily:(file:string,category:string,subcategory:string,imageUrl?:string,imageTitle?:string)=>void;
  onCreateCategory:()=>void;
  onCreateSku:(familyCode:string,file:string,imageUrl?:string,imageTitle?:string)=>void;
}){
  const audit=useMemo(()=>getImageAssignmentAudit(products),[products]);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [page,setPage]=useState(0);
  const [familyFilter,setFamilyFilter]=useState('all');
  const [moreFilters,setMoreFilters]=useState(false);
  const [file,setFile]=useState('');
  const [url,setUrl]=useState('');
  const [source,setSource]=useState<Source>('existing');
  const [urlInput,setUrlInput]=useState('');
  const [sourceError,setSourceError]=useState('');
  const [title,setTitle]=useState('');
  const [category,setCategory]=useState('');
  const [subcategory,setSubcategory]=useState('');
  const [familyCode,setFamilyCode]=useState('');
  const [familySearch,setFamilySearch]=useState('');
  const [sku,setSku]=useState('');
  const [placement,setPlacement]=useState<StorageChoice>('family');
  const [showEvidence,setShowEvidence]=useState(false);
  const [mobileEditor,setMobileEditor]=useState(false);
  const selectedRow=audit.find(x=>x.file===file);
  const family=products.find(x=>x.code===familyCode);
  const allFamilies=useMemo(()=>[...new Map(audit.flatMap(r=>r.families.map(f=>[f.code,f.name] as const))).entries()].sort((a,b)=>a[1].localeCompare(b[1],'fa')),[audit]);
  const categoryNames=useMemo(()=>[...new Set([...categories.map(c=>c.name),...products.map(p=>p.categoryName)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa')),[products,categories]);
  const subcategories=useMemo(()=>[...new Set([...(categories.find(x=>x.name===category)?.subcategories||[]),...products.filter(x=>x.categoryName===category).map(x=>x.subcategory||'')].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'fa')),[products,categories,category]);
  const families=useMemo(()=>products.filter(p=>(!category||p.categoryName===category)&&(!subcategory||p.subcategory===subcategory)&&normalizeCatalogueText(p.code+' '+p.name+' '+(p.variants||[]).map(v=>v.code+' '+v.name).join(' ')).includes(normalizeCatalogueText(familySearch))).slice(0,100),[products,category,subcategory,familySearch]);
  const filtered=useMemo(()=>audit.filter(r=>{
    if(filter!=='all'&&(filter==='catalogue-photo'?!r.ownerCatalogue:r.status!==filter))return false;
    if(familyFilter==='none'&&r.families.length)return false;
    if(familyFilter!=='all'&&familyFilter!=='none'&&!r.families.some(f=>f.code===familyFilter))return false;
    return normalizeCatalogueText([r.file,r.observed,r.research?.visualType,r.ownerCatalogue?.catalogueGroup,...r.families.flatMap(f=>[f.code,f.name,...f.skus.map(s=>s.code)])].join(' ')).includes(normalizeCatalogueText(search.trim()));
  }),[audit,filter,familyFilter,search]);
  const totals=useMemo(()=>({unassigned:audit.filter(x=>x.status==='unassigned').length,family:audit.filter(x=>x.status==='family-example').length,sku:audit.filter(x=>x.status==='sku-linked').length,catalogue:audit.filter(x=>!!x.ownerCatalogue).length}),[audit]);
  const pages=Math.max(1,Math.ceil(filtered.length/24));
  const currentPage=Math.min(page,pages-1);
  const visible=filtered.slice(currentPage*24,(currentPage+1)*24);
  const choose=(f:string)=>{
    const found=audit.find(x=>x.file===f);
    setFile(f);setUrl(getProductImageUrl(f));setSource('existing');setSourceError('');setTitle(found?.observed||'');
    setFamilySearch('');setCategory('');setSubcategory('');setFamilyCode('');setSku('');setPlacement('family');setShowEvidence(false);setMobileEditor(true);
  };
  const create=()=>{setFile('');setUrl('');setSource('upload');setSourceError('');setTitle('');setCategory('');setSubcategory('');setFamilyCode('');setFamilySearch('');setSku('');setPlacement('family');setShowEvidence(false);setMobileEditor(true)};
  const chooseFile=(upload?:File)=>{
    if(!upload)return;
    if(!upload.type.startsWith('image/')){setSourceError('فایل انتخاب‌شده تصویر نیست.');return}
    if(upload.size>5*1024*1024){setSourceError('حداکثر حجم هر تصویر ۵ مگابایت است.');return}
    const reader=new FileReader();
    reader.onload=()=>{setFile(upload.name);setUrl(String(reader.result||''));setTitle(upload.name);setSourceError('')};
    reader.onerror=()=>setSourceError('فایل خوانده نشد.');
    reader.readAsDataURL(upload);
  };
  const chooseUrl=()=>{
    try{const value=new URL(urlInput.trim());if(!['https:','http:'].includes(value.protocol))throw Error('invalid');setFile(value.pathname.split('/').pop()||'تصویر جدید');setUrl(value.href);setTitle('');setSourceError('')}
    catch{setSourceError('لینک معتبر تصویر با https یا http وارد کنید.')}
  };
  const closeSelection=()=>{setMobileEditor(false);setFile('');setUrl('');setSource('existing')};
  const apply=()=>{
    if(!file||!url||!familyCode||(placement==='sku'&&!sku))return;
    onEdit(familyCode,file,placement==='sku'?sku:undefined,url,title);
    closeSelection();
  };
  const exportAudit=()=>{
    const blob=new Blob([JSON.stringify(audit,null,2)],{type:'application/json;charset=utf-8'});
    const href=URL.createObjectURL(blob),el=document.createElement('a');
    el.href=href;el.download='sanatpish-image-assignments.json';el.click();
    window.setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  const filterItem=(value:Filter,label:string,count:number)=><button type="button" aria-pressed={filter===value} onClick={()=>{setFilter(value);setPage(0)}} className={`min-w-0 rounded-xl border px-3 py-3 text-right transition-colors ${filter===value?'border-[#E06518] bg-[#FFF2E8]':'border-[#E7E8EA] bg-white hover:bg-slate-50'}`}><span className="text-[11px] text-slate-500 block">{label}</span><strong className="text-lg text-[#55565A]">{fa(count)}</strong></button>;

  return <section dir="rtl" aria-label="میزکار بررسی تصاویر" className="rounded-2xl border border-[#E7E8EA] bg-[#F8F9FA] overflow-hidden">
    <header className="bg-white px-4 py-4 sm:px-5 border-b border-[#E7E8EA] flex flex-wrap justify-between items-center gap-3">
      <div className="min-w-0">
        <h2 className="text-base sm:text-lg font-black text-[#55565A]">میزکار تصاویر کالا <span className="text-[#E06518]">({fa(audit.length)})</span></h2>
        <p className="text-xs text-slate-500 mt-1">یک تصویر انتخاب کنید؛ محل نمایش و اطلاعات محصول را تعیین کنید. هیچ کدی خودکار تأیید نمی‌شود.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={create} className="rounded-xl bg-[#E06518] px-4 py-2.5 text-white text-xs font-bold flex items-center gap-2"><ImagePlus size={16}/> تصویر جدید</button>
        <button type="button" onClick={exportAudit} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-[#55565A] flex items-center gap-2"><Download size={15}/> خروجی</button>
      </div>
    </header>

    <div className="p-3 sm:p-4 grid grid-cols-2 md:grid-cols-4 gap-2">
      {filterItem('all','همه تصاویر',audit.length)}
      {filterItem('unassigned','بدون اتصال',totals.unassigned)}
      {filterItem('family-example','تصویر خانواده',totals.family)}
      {filterItem('sku-linked','متصل به کد کالا',totals.sku)}
    </div>
    <div className="px-3 sm:px-4 pb-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] gap-4 items-start">
        <div className={`${card} p-3 sm:p-4 min-w-0 ${mobileEditor?'hidden xl:block':''}`}>
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <div className="relative flex-1 min-w-[190px]"><Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/><input type="search" aria-label="جستجوی تصویر" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="شماره تصویر، نام محصول یا کد…" className="w-full rounded-xl border border-slate-200 py-3 pr-10 pl-3 text-sm outline-none focus:border-[#E06518]"/></div>
            <button type="button" aria-expanded={moreFilters} onClick={()=>setMoreFilters(v=>!v)} className="rounded-xl border border-slate-200 px-3 py-3 text-xs flex items-center gap-2"><SlidersHorizontal size={15}/> فیلترها</button>
          </div>
          {moreFilters&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3 p-3 bg-slate-50 rounded-xl">
            <label className="text-xs text-slate-600">وضعیت<select value={filter} onChange={e=>{setFilter(e.target.value as Filter);setPage(0)}} className="mt-1 block w-full bg-white border rounded-lg p-2"><option value="all">همه</option><option value="unassigned">بدون اتصال</option><option value="family-example">فقط خانواده</option><option value="sku-linked">متصل به SKU</option><option value="catalogue-photo">دارای شاهد کاتالوگ</option></select></label>
            <label className="text-xs text-slate-600">خانواده<select value={familyFilter} onChange={e=>{setFamilyFilter(e.target.value);setPage(0)}} className="mt-1 block w-full bg-white border rounded-lg p-2"><option value="all">همه خانواده‌ها</option><option value="none">بدون خانواده</option>{allFamilies.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select></label>
            <button type="button" className="text-xs text-[#C65A16] text-right" onClick={()=>{setSearch('');setFilter('all');setFamilyFilter('all');setPage(0)}}>پاک‌کردن همه فیلترها</button>
          </div>}
          <p className="text-xs text-slate-500 mb-3">{fa(filtered.length)} تصویر پیدا شد — تصویر را برای ویرایش انتخاب کنید.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-2">
            {visible.map(row=><button type="button" key={row.file} aria-pressed={file===row.file&&source==='existing'} onClick={()=>choose(row.file)} className={`min-w-0 rounded-xl border overflow-hidden text-right transition-all ${file===row.file&&source==='existing'?'border-[#E06518] ring-2 ring-[#FBE0CF]':'border-slate-200 hover:border-[#E06518]'}`}>
              <div className="aspect-[4/3] bg-[#F8F9FA] p-2"><ProductImage src={getProductImageUrl(row.file)} alt={row.observed||row.file} className="w-full h-full object-contain"/></div>
              <div className="p-2 space-y-1"><span dir="ltr" className="block text-[11px] font-mono font-bold text-[#55565A] truncate">{row.file}</span><span className={`block w-fit rounded-md px-1.5 py-0.5 text-[10px] ${statusColor(row)}`}>{statusLabel(row)}</span></div>
            </button>)}
          </div>
          {!visible.length&&<p role="status" className="text-sm text-slate-500 py-12 text-center">تصویری پیدا نشد. فیلترها را تغییر دهید.</p>}
          <div className="flex justify-center items-center gap-3 pt-5 text-xs">
            <button type="button" disabled={!currentPage} onClick={()=>setPage(currentPage-1)} className="flex items-center gap-1 border rounded-lg p-2 disabled:opacity-40"><ChevronRight size={15}/> قبلی</button>
            <span>{fa(currentPage+1)} از {fa(pages)}</span>
            <button type="button" disabled={currentPage>=pages-1} onClick={()=>setPage(currentPage+1)} className="flex items-center gap-1 border rounded-lg p-2 disabled:opacity-40">بعدی <ChevronLeft size={15}/></button>
          </div>
        </div>

        <aside aria-label="ویرایش اتصال و اطلاعات تصویر" className={`${card} min-w-0 overflow-hidden xl:sticky xl:top-4 ${!mobileEditor?'hidden xl:block':''}`}>
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 bg-white">
            <div><h3 className="text-sm font-black text-[#55565A]">اطلاعات و محل تصویر</h3><p className="text-[11px] text-slate-500 mt-1">فقط موارد مرتبط با تصویر انتخاب‌شده</p></div>
            {mobileEditor&&<button type="button" onClick={()=>setMobileEditor(false)} className="xl:hidden border p-2 rounded-lg" aria-label="بازگشت به تصاویر"><ArrowLeft size={17}/></button>}
          </div>
          {!url&&source==='existing'?<div className="px-5 py-14 text-center space-y-3"><FileImage size={38} className="mx-auto text-slate-300"/><strong className="block text-sm text-[#55565A]">هنوز تصویری انتخاب نشده است</strong><p className="text-xs text-slate-500 leading-6">روی یکی از تصاویر فهرست بزنید یا با «تصویر جدید» یک فایل وارد کنید.</p><button type="button" onClick={create} className="rounded-xl border border-[#E06518] text-[#C65A16] px-4 py-2 text-xs">افزودن تصویر</button></div>:
          <div className="space-y-4 p-3 sm:p-4 max-h-[78vh] overflow-y-auto">
            <div className="flex flex-wrap gap-2" role="group" aria-label="منبع تصویر">
              {([['existing','بانک تصاویر'],['upload','بارگذاری فایل'],['url','لینک تصویر']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={source===key} onClick={()=>{setSource(key);setUrl('');setFile('');setSourceError('')}} className={`flex-1 rounded-lg px-2 py-2 text-[11px] border font-bold ${source===key?'border-[#E06518] bg-[#FFF2E8] text-[#C65A16]':'border-slate-200 text-slate-600'}`}>{label}</button>)}
            </div>
            {source==='existing'&&!url&&<p className="text-xs text-slate-500">تصویر را از فهرست سمت راست انتخاب کنید.</p>}
            {source==='upload'&&<label className="block border border-dashed border-[#E7B995] rounded-xl p-3 text-xs font-bold text-[#55565A]">انتخاب تصویر از دستگاه
              <input type="file" accept="image/*" onChange={e=>chooseFile(e.target.files?.[0])} className="mt-2 w-full text-xs"/>
            </label>}
            {source==='url'&&<div className="flex gap-2"><input type="url" value={urlInput} onChange={e=>setUrlInput(e.target.value)} dir="ltr" placeholder="https://..." className="min-w-0 flex-1 border rounded-lg p-2 text-xs"/><button type="button" onClick={chooseUrl} className="rounded-lg bg-[#55565A] text-white px-3 text-xs">انتخاب</button></div>}
            {sourceError&&<p role="alert" className="text-xs text-rose-600">{sourceError}</p>}
            {url&&<div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex gap-3 items-center">
              <div className="w-24 h-24 bg-white rounded-lg shrink-0"><ProductImage src={url} alt={file} className="w-full h-full object-contain"/></div>
              <div className="min-w-0"><p dir="ltr" className="text-xs font-mono truncate">{file}</p><p className="text-[11px] text-slate-500 mt-2">این تصویر هنوز تأیید فنی نشده است.</p></div>
            </div>}
            {url&&<label className="block text-xs font-bold text-[#55565A]">نام یا توضیح تصویر<input value={title} onChange={e=>setTitle(e.target.value)} className="w-full mt-2 rounded-lg border border-slate-200 p-2.5" placeholder="مثلاً نمای روبه‌روی قطعه"/></label>}
            {url&&<div className="space-y-3">
              <div className="flex items-center justify-between"><h4 className="text-xs font-black text-[#55565A]">دسته‌بندی محصول</h4><button type="button" onClick={onCreateCategory} className="text-[#C65A16] text-[11px] font-bold flex items-center gap-1"><FolderPlus size={14}/> دسته/زیردسته جدید</button></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-600">دسته اصلی<select value={category} onChange={e=>{setCategory(e.target.value);setSubcategory('');setFamilyCode('');setSku('')}} className="mt-1 w-full border rounded-lg bg-white p-2.5"><option value="">همه دسته‌ها</option>{categoryNames.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
                <label className="text-[11px] text-slate-600">زیردسته<select disabled={!category} value={subcategory} onChange={e=>{setSubcategory(e.target.value);setFamilyCode('');setSku('')}} className="mt-1 w-full border rounded-lg bg-white p-2.5 disabled:opacity-50"><option value="">همه زیردسته‌ها</option>{subcategories.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
              </div>
              <div className="flex items-center justify-between"><h4 className="text-xs font-black text-[#55565A]">خانواده کالا</h4><button type="button" disabled={!file} onClick={()=>{onCreateFamily(file,category,subcategory,url,title);closeSelection()}} className="text-[#C65A16] text-[11px] font-bold disabled:opacity-50">+ ساخت خانواده جدید</button></div>
              <input value={familySearch} onChange={e=>setFamilySearch(e.target.value)} placeholder="جستجو با نام یا کد خانواده…" className="w-full border rounded-lg p-2.5 text-xs"/>
              <select aria-label="انتخاب خانواده کالا" value={familyCode} onChange={e=>{setFamilyCode(e.target.value);setSku('')}} className="w-full border rounded-lg bg-white p-3 text-xs"><option value="">انتخاب خانواده</option>{families.map(p=><option key={p.code} value={p.code}>{p.name} — {p.code}</option>)}</select>
            </div>}
            {url&&family&&<div className="space-y-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between"><h4 className="text-xs font-black text-[#55565A]">محل نمایش تصویر</h4><button type="button" onClick={()=>{onCreateSku(family.code,file,url,title);closeSelection()}} className="text-[11px] font-bold text-[#C65A16]">+ ساخت کد جدید</button></div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={placement==='family'} onClick={()=>{setPlacement('family');setSku('')}} className={`p-3 rounded-xl border text-xs text-right ${placement==='family'?'border-[#E06518] bg-[#FFF2E8]':'border-slate-200'}`}><strong className="block">خانواده</strong><span className="block text-[10px] text-slate-500 mt-1">برای همه مدل‌ها</span></button>
                <button type="button" aria-pressed={placement==='sku'} onClick={()=>setPlacement('sku')} className={`p-3 rounded-xl border text-xs text-right ${placement==='sku'?'border-[#E06518] bg-[#FFF2E8]':'border-slate-200'}`}><strong className="block">کد کالا</strong><span className="block text-[10px] text-slate-500 mt-1">فقط یک مدل مشخص</span></button>
              </div>
              {placement==='sku'&&<label className="block text-xs text-[#55565A]">کد دقیق SKU<select value={sku} onChange={e=>setSku(e.target.value)} className="mt-1 w-full border rounded-lg p-3 bg-white"><option value="">کد کالا را انتخاب کنید</option>{(family.variants||[]).map(v=><option key={v.code} value={v.code}>{v.code} — {v.name}</option>)}</select></label>}
            </div>}
            {url&&selectedRow&&<details open={showEvidence} onToggle={e=>setShowEvidence(e.currentTarget.open)} className="rounded-xl border border-slate-200 text-xs">
              <summary className="cursor-pointer p-3 font-bold text-[#55565A] flex gap-2 items-center"><Info size={15}/> اطلاعات فنی و شاهد کاتالوگ</summary>
              <div className="border-t p-3 space-y-2 text-slate-600 leading-6">
                <p>{selectedRow.observed}</p>
                {selectedRow.research&&<><p><b>نوع ظاهری:</b> {selectedRow.research.visualType}</p><p>{selectedRow.research.visibleFeatures}</p><p><b>بررسی لازم:</b> {selectedRow.research.requiredChecks.join('، ')}</p></>}
                {selectedRow.ownerCatalogue&&<p>کاتالوگ: {selectedRow.ownerCatalogue.catalogueGroup}، صفحه PDF {selectedRow.ownerCatalogue.page}</p>}
                {selectedRow.families.map(f=><div key={f.code} className="border-t pt-2"><b>{f.name}</b> ({f.code})<p>{f.skus.map(s=>s.code).join('، ')||'کد تأیید نشده'}</p></div>)}
                {!!selectedRow.duplicateFiles.length&&<p>تصاویر مشابه ثبت‌شده: {selectedRow.duplicateFiles.join('، ')}</p>}
              </div>
            </details>}
            {url&&<p className="text-[11px] leading-5 text-amber-700">اتصال یا انتخاب کد، تأیید هویت قطعه نیست. مشخصات فنی را در ویرایشگر محصول تکمیل کنید. فایل جدید تا زمانی که در فضای ذخیره دائمی بارگذاری نشود، نباید منتشر شود.</p>}
            {url&&<button type="button" disabled={!familyCode||(placement==='sku'&&!sku)} onClick={apply} className="w-full rounded-xl bg-[#E06518] text-white py-3.5 font-bold text-xs disabled:opacity-40 flex justify-center items-center gap-2"><Check size={17}/> ادامه برای تکمیل مشخصات و ذخیره</button>}
          </div>}
        </aside>
      </div>
    </div>
  </section>;
}
