import React, {useEffect,useMemo,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Download,ImagePlus,Search,SlidersHorizontal,X,FolderPlus,FileImage,ArrowLeft,ArrowLeftRight,Edit3,Info} from 'lucide-react';
import type {Product, Category} from '../../types';
import {getImageAssignmentAudit,type DbImageAuditRow} from '../../data/imageAssignments';
import {getProductImageUrl} from '../../assets/imagesproducts';
import {ProductImage} from '../../components/product/ProductImage';
import {uploadProductImage} from '../../services/productImageUpload';
import {normalizeCatalogueText} from '../../data/userProducts';
import {useApprovedMenuTaxonomy,saveApprovedFamilyAssignment} from '../useApprovedMenuTaxonomy';

type AuditRow=ReturnType<typeof getImageAssignmentAudit>[number];
type Filter='all'|'sku-linked'|'family-example'|'unassigned'|'catalogue-photo';
type StorageChoice='family'|'sku';
type Source='existing'|'upload'|'url';
const fa=(n:number)=>n.toLocaleString('fa-IR');
const statusLabel=(r:AuditRow)=>r.status==='sku-linked'?'کد متصل':r.status==='family-example'?'فقط خانواده':'بدون اتصال';
const statusColor=(r:AuditRow)=>r.status==='sku-linked'?'bg-emerald-50 text-emerald-700':r.status==='family-example'?'bg-amber-50 text-amber-700':'bg-rose-50 text-rose-700';
const card='rounded-xl border border-[#E7E8EA] bg-white';
export function ProductImageAudit({products,categories,onEdit,onCreateFamily,onCreateCategory,onEditCategory,onEditFamily,onCreateSku,onAssignSku,onAssignDirectSku}:{
  products:Product[];
  categories:Category[];
  onEdit:(familyCode:string,file:string,skuCode?:string,imageUrl?:string,imageTitle?:string,persistedId?:string)=>void;
  onCreateFamily:(file:string,category:string,submenu:string,subcategory:string,imageUrl?:string,imageTitle?:string,upload?:File,
    target?:{categorySlug:string;submenu:string;leaf:string})=>void;
  onCreateCategory:(imageUrl?:string)=>void;
  onEditCategory:(categoryName:string,imageUrl?:string)=>void;
  onEditFamily:(familyCode:string,file:string,imageUrl?:string,imageTitle?:string,upload?:File)=>void;
  onCreateSku:(familyCode:string,file:string,imageUrl?:string,imageTitle?:string)=>void;
  onAssignSku:(input:{targetFamilyCode:string;skuCode:string;imageUrl:string;fileName:string;title?:string;persistedId?:string})=>Promise<void>;
  onAssignDirectSku:(input:{skuCode:string;categorySlug:string;submenu:string;subcategory:string;imageUrl:string})=>Promise<void>;
}){
  const [records,setRecords]=useState<DbImageAuditRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setLoadError('');
    fetch('/api/admin/catalog-image-audits',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async res=>{const data=await res.json();if(!res.ok||!data.success||!Array.isArray(data.rows))throw Error(data.message||'اطلاعات تصاویر در دسترس نیست.');return data.rows as DbImageAuditRow[];})
      .then(rows=>{setRecords(rows);setLoading(false);})
      .catch(error=>{if(!controller.signal.aborted){setLoadError(error.message||'ارتباط با دیتابیس برقرار نشد.');setLoading(false);}});
    return ()=>controller.abort();
  },[]);
  const audit=useMemo(()=>getImageAssignmentAudit(products,records),[products,records]);
  const [search,setSearch]=useState('');
  const [filter,setFilter]=useState<Filter>('all');
  const [page,setPage]=useState(0);
  const [familyFilter,setFamilyFilter]=useState('all');
  const [moreFilters,setMoreFilters]=useState(false);
  const [file,setFile]=useState('');
  const [url,setUrl]=useState('');
  const [source,setSource]=useState<Source>('existing');
  const [selectedUpload,setSelectedUpload]=useState<File|null>(null);
  const [savingUpload,setSavingUpload]=useState(false);
  const [urlInput,setUrlInput]=useState('');
  const [sourceError,setSourceError]=useState('');
  const [title,setTitle]=useState('');
  const [menuGroup,setMenuGroup]=useState('');
  const [category,setCategory]=useState('');
  const [submenu,setSubmenu]=useState('');
  const [subcategory,setSubcategory]=useState('');
  const [familyCode,setFamilyCode]=useState('');
  const [familySearch,setFamilySearch]=useState('');
  const [searchAllFamilies,setSearchAllFamilies]=useState(false);
  const [directMode,setDirectMode]=useState(false);
  const [sku,setSku]=useState('');
  const [skuSearch,setSkuSearch]=useState('');
  const [placement,setPlacement]=useState<StorageChoice>('family');
  const [showEvidence,setShowEvidence]=useState(false);
  const [mobileEditor,setMobileEditor]=useState(false);
  const taxonomy=useApprovedMenuTaxonomy();
  const approvedCategories=taxonomy.categories;
  const approvedGroups=taxonomy.groups;
  const selectedApprovedCategory=approvedCategories.find(x=>x.slug===category);
  const menuSubmenus=(selectedApprovedCategory?.children||[]).map(x=>({value:x.name,label:x.name}));
  const menuLeaves=(selectedApprovedCategory?.children||[]).find(x=>x.name===submenu)?.children?.map(x=>({value:x.name,label:x.name}))||[];
  const matchedGroup=approvedGroups.find(x=>x.categorySlugs.includes(category));

  const selectedRow=audit.find(x=>x.file===file);
  const family=products.find(x=>x.code===familyCode);
  // All families must be selectable, even with no currently associated image.
  // Hierarchy: categoryName -> submenu -> subcategory -> family (as on the site).
  const allFamilies=useMemo(()=>[...products].sort((a,b)=>a.name.localeCompare(b.name,'fa')),[products]);
  // The imported four-level hierarchy is the sole selectable taxonomy.
  // Old product category fields are retained only for backward-compatible product storage.
  const currentCategory=selectedApprovedCategory;
  useEffect(()=>{
    const onSaved=(event:Event)=>{
      const detail=(event as CustomEvent<{categoryName?:string;submenu?:string;subcategory?:string;familyCode?:string;imageUrl?:string;imageFileName?:string}>).detail;
      if(!detail)return;
      // The legacy family fields do not define its approved menu classification.
      // Resolve the approved path by family code after the family has been saved.
      if(detail.familyCode){
        const assigned=taxonomy.byFamily.get(detail.familyCode);
        if(assigned){
          setCategory(assigned.categorySlug);
          setMenuGroup(approvedGroups.find(group=>group.categorySlugs.includes(assigned.categorySlug))?.id||'');
          setSubmenu(assigned.submenuName||'');
          setSubcategory(assigned.leafName||'');
        }
      }
      if(detail.familyCode){setFamilyCode(detail.familyCode);setFamilySearch('');}
      if(detail.imageUrl){
        setUrl(previous=>{if(previous.startsWith('blob:'))URL.revokeObjectURL(previous);return detail.imageUrl||'';});
        setFile(detail.imageFileName||'تصویر خانواده');
        setSource('existing');
        setSelectedUpload(null);
      }
    };
    window.addEventListener('atlas-image-assignment-hierarchy-saved',onSaved);
    return ()=>window.removeEventListener('atlas-image-assignment-hierarchy-saved',onSaved);
  },[taxonomy.byFamily,approvedGroups]);
  const families=useMemo(()=>products.filter(p=>{
    const assignment=taxonomy.byFamily.get(p.code);
    const matchesPath=(!category||assignment?.categorySlug===category) &&
      (!submenu||assignment?.submenuName===submenu) &&
      (!subcategory||assignment?.leafName===subcategory);
    return (searchAllFamilies || (taxonomy.assignmentsLoaded && matchesPath && Boolean(assignment))) &&
      normalizeCatalogueText(p.code+' '+p.name+' '+(p.variants||[]).map(v=>v.code+' '+v.name).join(' ')).includes(normalizeCatalogueText(familySearch));
  }).sort((a,b)=>a.name.localeCompare(b.name,'fa')),
  [products,category,submenu,subcategory,familySearch,searchAllFamilies,taxonomy.byFamily,taxonomy.assignmentsLoaded]);
  // Build one searchable index across every family, not only the selected destination family.
  const allSkuChoices=useMemo(()=>products.flatMap(product=>(product.variants||[]).map(variant=>{
    const assignedImage=product.galleryImages?.find(image=>image.scope==='variant'&&image.variantCode===variant.code)?.url;
    // Never mislabel a generic family photo as the verified image of this exact SKU.
    const rawImage=assignedImage||variant.images?.[0]||'';
    return {family:product,variant,imageUrl:getProductImageUrl(rawImage)||rawImage};
  })).sort((a,b)=>a.variant.code.localeCompare(b.variant.code,'en',{numeric:true,sensitivity:'base'})),[products]);
  const matchingSkus=useMemo(()=>{
    const query=normalizeCatalogueText(skuSearch.trim());
    const matches=query?allSkuChoices.filter(({family:owner,variant})=>normalizeCatalogueText([
      variant.code,variant.name,variant.size,variant.model,owner.code,owner.name,owner.categoryName,owner.submenu,owner.subcategory
    ].filter(Boolean).join(' ')).includes(query)):allSkuChoices;
    return matches.slice(0,30);
  },[allSkuChoices,skuSearch]);
  const selectedSkuChoice=allSkuChoices.find(choice=>choice.variant.code===sku);
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
    setFile(f);setUrl(getProductImageUrl(f));setSource('existing');setSelectedUpload(null);setSourceError('');setTitle(found?.observed||'');
    setFamilySearch('');setMenuGroup('');setCategory('');setSubmenu('');setSubcategory('');setFamilyCode('');setSku('');setSkuSearch('');setPlacement('family');setDirectMode(false);setShowEvidence(false);setMobileEditor(true);
  };
  const create=()=>{setFile('');setUrl('');setSource('upload');setSelectedUpload(null);setSourceError('');setTitle('');setMenuGroup('');setCategory('');setSubmenu('');setSubcategory('');setFamilyCode('');setFamilySearch('');setSku('');setSkuSearch('');setPlacement('family');setShowEvidence(false);setMobileEditor(true)};
  const chooseFile=(upload?:File)=>{
    if(!upload)return;
    if(!['image/png','image/jpeg','image/webp'].includes(upload.type)){setSourceError('فقط PNG، JPG یا WebP مجاز است.');return}
    if(upload.size>8*1024*1024){setSourceError('حداکثر حجم هر تصویر ۸ مگابایت است.');return}
    setSelectedUpload(upload);
    // Local preview is immediate; upload sends the original bytes, not base64.
    if(url.startsWith('blob:'))URL.revokeObjectURL(url);
    setFile(upload.name);setUrl(URL.createObjectURL(upload));
    setTitle(upload.name);setSourceError('');
  };
  const chooseUrl=()=>{
    try{const value=new URL(urlInput.trim());if(!['https:','http:'].includes(value.protocol))throw Error('invalid');setFile(value.pathname.split('/').pop()||'تصویر جدید');setUrl(value.href);setTitle('');setSourceError('')}
    catch{setSourceError('لینک معتبر تصویر با https یا http وارد کنید.')}
  };
  const closeSelection=()=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url);setMobileEditor(false);setFile('');setUrl('');setSource('existing');setSelectedUpload(null);setSku('');setSkuSearch('')};
  const chooseFamily=(code:string)=>{
    setFamilyCode(code);setSku('');
    const assigned=taxonomy.byFamily.get(code);
    if(assigned){
      setCategory(assigned.categorySlug);
      setMenuGroup(approvedGroups.find(group=>group.categorySlugs.includes(assigned.categorySlug))?.id||'');
      setSubmenu(assigned.submenuName||'');
      setSubcategory(assigned.leafName||'');
    }
  };
  const saveSelectedPath=async(code:string)=>{
    if(!code||!category||!submenu) return;
    await saveApprovedFamilyAssignment({familyCode:code,categorySlug:category,submenu,leaf:subcategory});
    taxonomy.refresh();
  };
  const apply=async()=>{
    if(!file||!url||(!directMode&&!familyCode)||((directMode||placement==='sku')&&!sku)||savingUpload)return;
    if(directMode){
      const destination=approvedCategories.find(item=>item.slug===category);
      if(!destination||!submenu){setSourceError('برای کد بدون خانواده، دسته و زیرمنو را انتخاب کنید.');return;}
      setSavingUpload(true);setSourceError('');
      try{
        let imageUrl=url;
        if(source==='upload'){
          if(!selectedUpload)throw new Error('تصویر انتخاب نشده است.');
          const response=await fetch('/api/catalog/category-images/upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':selectedUpload.type},body:selectedUpload});
          const payload=await response.json().catch(()=>({}));
          if(!response.ok||!payload.url)throw new Error(payload.message||'آپلود تصویر ذخیره نشد.');
          imageUrl=payload.url;
        }
        await onAssignDirectSku({skuCode:sku,categorySlug:destination.slug,submenu,subcategory,imageUrl});
        closeSelection();
      }catch(error:any){setSourceError(error.message||'ثبت کد مستقیم انجام نشد.');}
      finally{setSavingUpload(false);}
      return;
    }
    if(placement==='sku'){
      if(!selectedSkuChoice){setSourceError('ابتدا یک کد کالا از فهرست سراسری انتخاب کنید.');return;}
      setSavingUpload(true);setSourceError('');
      try{
        let assignedUrl=url,assignedFile=file,persistedId:string|undefined;
        if(source==='upload'){
          if(!selectedUpload)throw new Error('ابتدا فایل تصویر را انتخاب کنید.');
          // Upload into the destination family first; the transfer endpoint then
          // atomically changes this persisted gallery row to the selected SKU.
          const saved=await uploadProductImage(selectedUpload,{familyCode,title:title||selectedUpload.name});
          assignedUrl=saved.url;assignedFile=saved.fileName;persistedId=saved.id;
        }
        await onAssignSku({
          targetFamilyCode:familyCode,skuCode:sku,imageUrl:assignedUrl,
          fileName:assignedFile,title:title||undefined,persistedId
        });
        await saveSelectedPath(familyCode);
        closeSelection();
      }catch(error:any){setSourceError(error.message||'انتقال کد کالا و اتصال تصویر ذخیره نشد.');}
      finally{setSavingUpload(false);}
      return;
    }
    if(source==='upload'){
      if(!selectedUpload){setSourceError('ابتدا فایل تصویر را انتخاب کنید.');return;}
      setSavingUpload(true);setSourceError('');
      try{
        const saved=await uploadProductImage(selectedUpload,{
          familyCode,title:title||selectedUpload.name
        });
        await saveSelectedPath(familyCode);
        onEdit(familyCode,saved.fileName,undefined,saved.url,title,saved.id);
        closeSelection();
      }catch(error:any){setSourceError(error.message||'ثبت تصویر در Storage ممکن نشد.');}
      finally{setSavingUpload(false);}
      return;
    }
    try {await saveSelectedPath(familyCode);}
    catch(error){setSourceError(error instanceof Error?error.message:'مسیر خانواده در دیتابیس ثبت نشد.');return;}
    onEdit(familyCode,file,undefined,url,title);
    closeSelection();
  };
  const exportAudit=()=>{
    const blob=new Blob([JSON.stringify(audit,null,2)],{type:'application/json;charset=utf-8'});
    const href=URL.createObjectURL(blob),el=document.createElement('a');
    el.href=href;el.download='sanatpish-image-assignments.json';el.click();
    window.setTimeout(()=>URL.revokeObjectURL(href),1000);
  };
  return (
    <section dir="rtl" aria-label="بررسی تصاویر خانواده و کد کالا" className="overflow-hidden rounded-2xl border border-[#E7E8EA] bg-[#F5F7FA]">
      <header className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-4 sm:px-6 sm:py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-black text-[#55565A] sm:text-lg">بررسی تصاویر خانواده و کد کالا</h2>
            <span className="rounded-full bg-[#FFF0E5] px-2.5 py-1 text-xs font-black text-[#C65A16]">{fa(audit.length)} تصویر</span>
          </div>
          <p className="mt-1.5 text-xs leading-6 text-slate-500">تصویر را بررسی کنید و خانواده، کد کالا و مشخصات درست را به آن متصل کنید. هیچ کدی خودکار تأیید نمی‌شود.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={create} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E06518] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#c95814]"><ImagePlus size={16}/> افزودن تصویر</button>
          <button type="button" onClick={exportAudit} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-[#55565A] hover:bg-slate-50"><Download size={15}/> خروجی بررسی</button>
        </div>
      </header>

      <div className="space-y-3 border-b border-slate-200 bg-white p-3 sm:p-4">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1fr)_190px_auto]">
          <div className="relative min-w-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={17}/>
            <input type="search" aria-label="جستجوی تصویر" value={search} onChange={e=>{setSearch(e.target.value);setPage(0)}} placeholder="جستجو با نام فایل، نام محصول یا کد کالا…" className="w-full rounded-xl border border-slate-200 bg-white py-3 pr-10 pl-3 text-sm outline-none focus:border-[#E06518]"/>
          </div>
          <select aria-label="فیلتر وضعیت اتصال" value={filter} onChange={e=>{setFilter(e.target.value as Filter);setPage(0)}} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs text-[#55565A] outline-none focus:border-[#E06518]">
            <option value="all">همه تصاویر</option><option value="unassigned">بدون اتصال</option><option value="family-example">متصل به خانواده</option><option value="sku-linked">متصل به کد کالا</option><option value="catalogue-photo">دارای شاهد کاتالوگ</option>
          </select>
          <button type="button" aria-expanded={moreFilters} onClick={()=>setMoreFilters(v=>!v)} className={moreFilters?"inline-flex items-center justify-center gap-2 rounded-xl border border-[#E06518] bg-[#FFF2E8] px-4 py-3 text-xs font-bold text-[#C65A16]":"inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-[#55565A] hover:bg-slate-50"}><SlidersHorizontal size={15}/> فیلترهای بیشتر</button>
        </div>
        {moreFilters&&<div className="grid grid-cols-1 gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-slate-600">خانواده محصول
            <select value={familyFilter} onChange={e=>{setFamilyFilter(e.target.value);setPage(0)}} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-2.5 font-normal"><option value="all">همه خانواده‌ها</option><option value="none">بدون خانواده</option>{allFamilies.map(p=><option key={p.code} value={p.code}>{p.name} — {p.code}</option>)}</select>
          </label>
          <div className="flex items-end justify-start"><button type="button" className="rounded-lg px-3 py-2 text-xs font-bold text-[#C65A16] hover:bg-white" onClick={()=>{setSearch('');setFilter('all');setFamilyFilter('all');setPage(0)}}>پاک‌کردن همه فیلترها</button></div>
        </div>}
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
          <p>{fa(filtered.length)} تصویر پیدا شد</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span><span className="ml-1 inline-block h-2 w-2 rounded-full bg-rose-400"/>بدون اتصال: {fa(totals.unassigned)}</span>
            <span><span className="ml-1 inline-block h-2 w-2 rounded-full bg-amber-400"/>خانواده: {fa(totals.family)}</span>
            <span><span className="ml-1 inline-block h-2 w-2 rounded-full bg-emerald-500"/>کد کالا: {fa(totals.sku)}</span>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 lg:p-5">
        <div className="grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3 xl:gap-4">
          {visible.map(row=><article key={row.file} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-[#E8B995] hover:shadow-sm">
            <div className="flex h-40 items-center justify-center bg-white p-4 sm:h-44">
              <ProductImage thumbnail loading="lazy" decoding="async" src={getProductImageUrl(row.file)} alt={row.observed||row.file} className="h-full w-full object-contain"/>
            </div>
            <div className="flex flex-1 flex-col gap-3 border-t border-slate-100 p-3.5 sm:p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p dir="ltr" className="truncate text-xs font-black text-[#55565A]">{row.file}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{row.observed||row.research?.visualType||'توضیح فنی تصویر هنوز ثبت نشده است.'}</p>
                </div>
                <span className={"shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold "+statusColor(row)}>{statusLabel(row)}</span>
              </div>
              <div className="min-h-[82px] rounded-xl bg-slate-50 p-3">
                {row.families.length>0?<div className="space-y-2">
                  {row.families.slice(0,2).map(f=><div key={f.code}>
                    <p className="text-[11px] font-bold leading-5 text-[#55565A]">خانواده: {f.name}</p>
                    <p dir="ltr" className="text-[10px] text-slate-500">{f.code}{f.skus.length?" · "+f.skus.length.toLocaleString('fa-IR')+" کد کالا":""}</p>
                  </div>)}
                  {row.families.length>2&&<p className="text-[10px] text-slate-500">و {fa(row.families.length-2)} خانواده دیگر</p>}
                </div>:<p className="text-[11px] leading-6 text-slate-500">خانواده و کد کالا هنوز تأیید نشده است.</p>}
                {row.ownerCatalogue&&<p className="mt-2 border-t border-slate-200 pt-2 text-[10px] leading-5 text-slate-500">شاهد کاتالوگ: {row.ownerCatalogue.catalogueGroup} · صفحه {fa(row.ownerCatalogue.page)}</p>}
              </div>
              <button type="button" onClick={()=>choose(row.file)} className="mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#E06518] bg-white px-3 py-2.5 text-xs font-bold text-[#C65A16] transition hover:bg-[#FFF2E8]"><FileImage size={15}/> بررسی و اتصال به خانواده / کد</button>
            </div>
          </article>)}
        </div>
        {!visible.length&&<div role="status" className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-16 text-center"><FileImage size={34} className="mx-auto text-slate-300"/><p className="mt-3 text-sm font-bold text-[#55565A]">تصویری پیدا نشد</p><p className="mt-1 text-xs text-slate-500">عبارت جستجو یا فیلترها را تغییر دهید.</p></div>}
        <div className="flex items-center justify-center gap-4 pt-5 text-xs">
          <button type="button" disabled={!currentPage} onClick={()=>setPage(currentPage-1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-2.5 disabled:opacity-40"><ChevronRight size={15}/> قبلی</button>
          <span className="text-slate-600">{fa(currentPage+1)} از {fa(pages)}</span>
          <button type="button" disabled={currentPage>=pages-1} onClick={()=>setPage(currentPage+1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-2.5 disabled:opacity-40">بعدی <ChevronLeft size={15}/></button>
        </div>
      </div>

      {mobileEditor&&<div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-2 backdrop-blur-sm sm:p-5" onClick={e=>{if(e.target===e.currentTarget)closeSelection()}}>
        <div role="dialog" aria-modal="true" aria-label="بررسی و اتصال تصویر به محصول" className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-3 bg-[#55565A] px-4 py-3 text-white sm:px-5">
            <div className="min-w-0"><h3 className="text-sm font-black sm:text-base">بررسی و اتصال تصویر</h3><p dir="ltr" className="mt-1 truncate text-[10px] text-slate-200">{file||'تصویر جدید'} · انتخاب دسته، خانواده و کد دقیق</p></div>
            <button type="button" onClick={closeSelection} aria-label="بستن فرم تصویر" className="shrink-0 rounded-lg border border-white/25 p-2 hover:bg-white/10"><X size={18}/></button>
          </header>
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[minmax(230px,0.75fr)_minmax(0,1.5fr)] lg:overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50 p-4 lg:overflow-y-auto lg:border-b-0 lg:border-l">
              <div className="flex min-h-48 items-center justify-center rounded-xl border border-slate-200 bg-white p-3 sm:min-h-56">
                {url?<ProductImage src={url} alt={file} className="max-h-64 w-full object-contain"/>:<div className="py-8 text-center"><FileImage size={34} className="mx-auto text-slate-300"/><p className="mt-2 text-xs text-slate-500">تصویری انتخاب نشده است</p></div>}
              </div>
              <p dir="ltr" className="mt-2 break-all text-center text-xs font-bold text-[#55565A]">{file||'تصویر جدید'}</p>
              {selectedRow&&<div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-600">
                <p className="font-bold text-[#55565A]">اطلاعات فعلی تصویر</p><p>{selectedRow.observed}</p>
                {selectedRow.research&&<><p><b>نوع ظاهری:</b> {selectedRow.research.visualType}</p><p>{selectedRow.research.visibleFeatures}</p><p><b>بررسی لازم:</b> {selectedRow.research.requiredChecks.join('، ')}</p></>}
                {selectedRow.ownerCatalogue&&<p className="border-t border-slate-100 pt-2">کاتالوگ: {selectedRow.ownerCatalogue.catalogueGroup}، صفحه PDF {fa(selectedRow.ownerCatalogue.page)}</p>}
                {!!selectedRow.duplicateFiles.length&&<p className="border-t border-slate-100 pt-2">تصاویر مشابه: {selectedRow.duplicateFiles.join('، ')}</p>}
              </div>}
            </div>
            <div className="min-h-0 space-y-4 p-3 sm:p-5 lg:overflow-y-auto">
              <div className="flex flex-wrap gap-2" role="group" aria-label="منبع تصویر">
                {([['existing','بازگشت به بانک تصاویر'],['upload','بارگذاری تصویر جدید'],['url','استفاده از لینک']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={source===key} onClick={()=>{if(key==='existing'){closeSelection();return;}setSource(key);setSelectedUpload(null);setUrl('');setFile('');setSourceError('')}} className={source===key?"rounded-lg border border-[#E06518] bg-[#FFF2E8] px-3 py-2 text-[11px] font-bold text-[#C65A16]":"rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"}>{label}</button>)}
              </div>
              {source==='upload'&&<label className="block rounded-xl border border-dashed border-[#E7B995] bg-[#FFFAF6] p-4 text-xs font-bold text-[#55565A]">انتخاب تصویر از دستگاه<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>chooseFile(e.target.files?.[0])} className="mt-2 block w-full text-xs"/></label>}
              {source==='url'&&<div className="flex flex-col gap-2 sm:flex-row"><input type="url" value={urlInput} onChange={e=>setUrlInput(e.target.value)} dir="ltr" placeholder="https://example.com/image.png" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-3 text-xs"/><button type="button" onClick={chooseUrl} className="rounded-lg bg-[#55565A] px-4 py-3 text-xs font-bold text-white">بارگذاری لینک</button></div>}
              {sourceError&&<p role="alert" className="text-xs text-rose-600">{sourceError}</p>}
              {url&&<label className="block text-xs font-bold text-[#55565A]">نام یا توضیح تصویر<input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 font-normal" placeholder="نام قطعه یا توضیحی که در تصویر دیده می‌شود"/></label>}
              {url&&<div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h4 className="text-sm font-black text-[#55565A]">۱. دسته‌بندی محصول</h4><p className="mt-1 text-[10px] text-slate-500">مدیریت دسته، زیرمنو، زیرگروه و تصویر بدون خروج از این پنجره</p></div>
                  <div className="flex flex-wrap gap-2">
                    {category&&currentCategory&&<button type="button" onClick={()=>onEditCategory(category,source==='upload'?'':url)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-[#55565A]"><Edit3 size={14}/> ویرایش دسته، تصویر و زیرمنوها</button>}
                    <button type="button" onClick={()=>onCreateCategory(source==='upload'?'':url)} className="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-2 text-[11px] font-bold text-[#C65A16]"><FolderPlus size={14}/> دسته جدید</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-600">دسته اصلی<select value={category} onChange={e=>{setCategory(e.target.value);setSubmenu('');setSubcategory('');setFamilyCode('');setSku('')}} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3"><option value="">انتخاب دسته اصلی</option>{categoryNames.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
                  <label className="text-xs text-slate-600">زیرمنو<select disabled={!category} value={submenu} onChange={e=>{setSubmenu(e.target.value);setSubcategory('');setFamilyCode('');setSku('')}} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-50"><option value="">انتخاب زیرمنو</option>{submenus.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
                  <label className="text-xs text-slate-600">زیرگروه / نوع فنی<select disabled={!category} value={subcategory} onChange={e=>{setSubcategory(e.target.value);setFamilyCode('');setSku('')}} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-50"><option value="">انتخاب زیرگروه</option>{subcategories.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
                  {category&&currentCategory&&<div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/40 p-2.5">
                    {currentCategory.image&&<ProductImage src={currentCategory.image} alt={currentCategory.name} className="h-12 w-14 rounded-md bg-white object-contain"/>}
                    <div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-slate-700">{currentCategory.name}</p><p className="text-[10px] text-slate-500">{fa(currentCategory.children?.length||0)} زیرمنو · تصویر قابل ویرایش</p></div>
                    <button type="button" onClick={()=>onEditCategory(category,source==='upload'?'':url)} className="text-[11px] font-bold text-[#C65A16] underline">مدیریت ساختار</button>
                  </div>}
                </div>
                {category&&currentCategory&&<div className="flex flex-wrap gap-2">
                  <button type="button" onClick={()=>onEditCategory(category,source==='upload'?'':url)} className="rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-600">+ افزودن یا ویرایش زیرمنو و زیرگروه</button>
                </div>}
              </div>}
              {url&&<div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h4 className="text-sm font-black text-[#55565A]">۲. خانواده کالا</h4><p className="mt-1 text-[10px] text-slate-500">افزودن و ویرایش نام، دسته‌بندی، تصویر و کدهای خانواده همین‌جا</p></div>
                  <div className="flex flex-wrap gap-2">
                    {family&&<button type="button" onClick={()=>onEditFamily(family.code,file,source==='upload'?'':url,title,selectedUpload||undefined)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700"><Edit3 size={13}/> ویرایش نام و تصویر خانواده</button>}
                    <button type="button" disabled={!category} onClick={()=>onCreateFamily(file,category,submenu,subcategory,source==='upload'?'':url,title,selectedUpload||undefined)} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold text-[#C65A16] disabled:opacity-40">+ ساخت خانواده جدید</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" aria-pressed={!directMode} onClick={()=>{setDirectMode(false);setPlacement('family')}} className={!directMode?"rounded-xl border border-[#E06518] bg-orange-50 p-3 text-right text-xs font-bold text-slate-800":"rounded-xl border border-slate-200 p-3 text-right text-xs text-slate-600"}>دارای خانواده</button>
                  <button type="button" aria-pressed={directMode} onClick={()=>{setDirectMode(true);setFamilyCode('');setSku('');setPlacement('sku')}} className={directMode?"rounded-xl border border-[#E06518] bg-orange-50 p-3 text-right text-xs font-bold text-slate-800":"rounded-xl border border-slate-200 p-3 text-right text-xs text-slate-600"}>بدون خانواده · کد مستقیم زیرمنو</button>
                </div>
                {!directMode&&<label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={searchAllFamilies} onChange={e=>setSearchAllFamilies(e.target.checked)}/> جستجو در تمام خانواده‌ها، بدون محدودیت دسته‌بندی</label>}
                {!directMode&&<input value={familySearch} onChange={e=>setFamilySearch(e.target.value)} placeholder="جستجو با نام یا کد خانواده…" className="w-full rounded-lg border border-slate-200 p-3 text-xs"/>}
                {!directMode&&<select aria-label="انتخاب خانواده کالا" value={familyCode} onChange={e=>{setFamilyCode(e.target.value);setSku('')}} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs"><option value="">انتخاب خانواده</option>{families.map(p=><option key={p.code} value={p.code}>{p.name} — {p.code}</option>)}</select>}
                {directMode&&<p className="rounded-xl bg-orange-50 p-3 text-[11px] leading-6 text-orange-900">نیازی به ساخت خانواده نیست. کد معتبر را در گام بعد جستجو کنید؛ این ارتباط مستقیماً در زیرمنو ثبت می‌شود.</p>}
                {family&&!directMode&&<div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/50 p-2.5">
                  {(family.images?.[0]||family.galleryImages?.[0]?.url)&&<ProductImage src={family.images?.[0]||family.galleryImages?.[0]?.url} alt={family.name} className="h-16 w-16 rounded-lg bg-white object-contain"/>}
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#55565A]">{family.name}</p><p dir="ltr" className="text-[11px] text-slate-500">{family.code}</p><p className="text-[10px] text-slate-500">{fa(family.variants?.length||0)} کد کالا</p></div>
                  <button type="button" onClick={()=>onEditFamily(family.code,file,source==='upload'?'':url,title,selectedUpload||undefined)} className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-[#C65A16]">مدیریت تصاویر</button>
                </div>}
                {!directMode&&<p className="mt-1 text-[11px] text-slate-500">{fa(families.length)} خانواده قابل انتخاب</p>}
              </div>}
              {url&&(family||directMode)&&<div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-black text-[#55565A]">۳. {directMode?"انتخاب کد مستقیم":"محل اتصال تصویر"}</h4>{!directMode&&<button type="button" onClick={()=>{if(source==='upload'){setSourceError('ابتدا کد جدید را در خانواده ثبت کنید؛ سپس فایل را به آن متصل کنید.');return;}if(family)onCreateSku(family.code,file,url,title);closeSelection()}} className="rounded-lg border border-orange-200 px-3 py-2 text-[11px] font-bold text-[#C65A16]">+ افزودن کد کالا</button>}</div>
                {!directMode&&<div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={placement==='family'} onClick={()=>{setPlacement('family');setSku('')}} className={placement==='family'?"rounded-xl border border-[#E06518] bg-[#FFF2E8] p-3 text-right":"rounded-xl border border-slate-200 p-3 text-right hover:bg-slate-50"}><strong className="block text-xs text-[#55565A]">تصویر خانواده</strong><span className="mt-1 block text-[10px] text-slate-500">برای همه مدل‌های خانواده</span></button>
                  <button type="button" aria-pressed={placement==='sku'} onClick={()=>setPlacement('sku')} className={placement==='sku'?"rounded-xl border border-[#E06518] bg-[#FFF2E8] p-3 text-right":"rounded-xl border border-slate-200 p-3 text-right hover:bg-slate-50"}><strong className="block text-xs text-[#55565A]">کد دقیق کالا</strong><span className="mt-1 block text-[10px] text-slate-500">فقط یک SKU مشخص</span></button>
                </div>}
                {(directMode||placement==='sku')&&<div className="space-y-3">
                  <label className="block text-xs font-bold text-[#55565A]">جستجو در تمام کدهای کالا
                    <input type="search" value={skuSearch} onChange={e=>{setSkuSearch(e.target.value);setSku('')}} placeholder="کد، نام کالا، خانواده یا دسته‌بندی را جستجو کنید…" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-3 font-normal outline-none focus:border-[#E06518]"/>
                  </label>
                  <p className="text-[10px] text-slate-500">جستجو در {fa(allSkuChoices.length)} کد کالای ثبت‌شده در تمام خانواده‌ها؛ حداکثر ۳۰ نتیجه نمایش داده می‌شود.</p>
                  <div role="listbox" aria-label="نتایج جستجوی سراسری کد کالا" className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                    {matchingSkus.map(choice=><button key={choice.variant.code} type="button" role="option" aria-selected={sku===choice.variant.code} onClick={()=>{setSku(choice.variant.code);setSkuSearch(choice.variant.code)}} className={sku===choice.variant.code?"flex w-full items-center gap-3 rounded-lg border border-[#E06518] bg-[#FFF2E8] p-2.5 text-right":"flex w-full items-center gap-3 rounded-lg border border-transparent bg-white p-2.5 text-right hover:border-slate-200 hover:bg-slate-50"}>
                      {choice.imageUrl?<ProductImage src={choice.imageUrl} alt={choice.variant.name} className="h-12 w-12 shrink-0 rounded-md bg-white object-contain"/>:<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100"><FileImage size={17} className="text-slate-400"/></div>}
                      <span className="min-w-0 flex-1">
                        <span dir="ltr" className="block truncate text-xs font-black text-[#55565A]">{choice.variant.code}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-700">{choice.variant.name}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-slate-500">{choice.family.name} · {choice.family.categoryName}</span>
                      </span>
                      <span className={choice.family.code!==familyCode?"shrink-0 rounded-md bg-amber-50 px-2 py-1 text-[9px] font-bold text-amber-700":"shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700"}>{directMode?'کد بدون خانواده':choice.family.code!==familyCode?'انتقال از خانواده دیگر':'همین خانواده'}</span>
                    </button>)}
                    {!matchingSkus.length&&<p className="px-3 py-6 text-center text-xs text-slate-500">کدی با این عبارت پیدا نشد؛ کد یا نام دیگری جستجو کنید.</p>}
                  </div>
                  {selectedSkuChoice&&<div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3">
                    {selectedSkuChoice.imageUrl?<ProductImage src={selectedSkuChoice.imageUrl} alt={selectedSkuChoice.variant.name} className="h-16 w-16 shrink-0 rounded-lg bg-slate-50 object-contain"/>:<div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-50"><FileImage size={20} className="text-slate-400"/></div>}
                    <div className="min-w-0 flex-1">
                      <p dir="ltr" className="text-xs font-black text-[#55565A]">{selectedSkuChoice.variant.code}</p>
                      <p className="mt-1 text-xs text-slate-700">{selectedSkuChoice.variant.name}</p>
                      {directMode?<p className="mt-1.5 text-[10px] leading-5 text-orange-700">این کد مستقیماً زیرمنوی مقصد را دریافت می‌کند؛ تصویر مستقل آن ثبت می‌شود.</p>:selectedSkuChoice.family.code!==familyCode?<p className="mt-1.5 flex items-center gap-1 text-[10px] leading-5 text-amber-700"><ArrowLeftRight size={13}/> از «{selectedSkuChoice.family.name}» در دسته «{selectedSkuChoice.family.categoryName}» به خانواده مقصد منتقل می‌شود؛ قیمت و مشخصات کد حفظ می‌شوند.</p>:<p className="mt-1.5 text-[10px] leading-5 text-emerald-700">این کد از قبل در خانواده مقصد قرار دارد؛ تصویر به همین کد متصل می‌شود.</p>}
                    </div>
                  </div>}
                </div>}
              </div>}
              {url&&<p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-6 text-amber-800">اتصال تصویر به‌تنهایی هویت فنی قطعه را تأیید نمی‌کند. مشخصات فنی کد کالا باید در فرم ویرایش همان محصول بررسی شود. فایل جدید تا ذخیره در فضای دائمی، آماده انتشار نیست.</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeSelection} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-[#55565A]">انصراف</button>
                {url&&<button type="button" disabled={savingUpload||(!directMode&&!familyCode)||((directMode||placement==='sku')&&!sku)|| (directMode&&(!category||!submenu))} onClick={()=>{void apply()}} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E06518] px-5 py-3 text-xs font-bold text-white hover:bg-[#c95814] disabled:cursor-not-allowed disabled:opacity-40"><Check size={16}/> {savingUpload?(directMode?'در حال ثبت کد مستقیم…':placement==='sku'?'در حال انتقال کد و ذخیره تصویر…':'در حال ذخیره روی سرور…'):directMode?'ثبت مستقیم کد در زیرمنو':placement==='sku'?'انتقال کد و اتصال تصویر به خانواده مقصد':source==='upload'?'ذخیره در Storage و اتصال به کالا':'ذخیره اتصال و ادامه تکمیل مشخصات'}</button>}
              </div>
            </div>
          </div>
        </div>
      </div>}
    </section>
  );
}
