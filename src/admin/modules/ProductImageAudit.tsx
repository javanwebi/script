import React, {useMemo,useState} from 'react';
import {Check,ChevronLeft,ChevronRight,Download,ImagePlus,Search,SlidersHorizontal,X,FolderPlus,FileImage,ArrowLeft,Info} from 'lucide-react';
import type {Product,TechnicalSpec,ProductGalleryImage,ProductVariant} from '../../types';
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
export function ProductImageAudit({products,categories,onSaveProduct,onCreateCategory}:{
  products:Product[];
  categories:{name:string;subcategories?:string[]}[];
  onSaveProduct:(product:Product)=>void;
  onCreateCategory:(categoryName:string,subcategoryName:string)=>void;
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
  const [createNewFamily,setCreateNewFamily]=useState(false);
  const [createNewSku,setCreateNewSku]=useState(false);
  const [familyCodeInput,setFamilyCodeInput]=useState('');
  const [familyName,setFamilyName]=useState('');
  const [familyNameEn,setFamilyNameEn]=useState('');
  const [familyDescription,setFamilyDescription]=useState('');
  const [familySpecs,setFamilySpecs]=useState<TechnicalSpec[]>([{key:'',value:''}]);
  const [submenu,setSubmenu]=useState('');
  const [brand,setBrand]=useState('ATLAS');
  const [unit,setUnit]=useState('عدد');
  const [skuCodeInput,setSkuCodeInput]=useState('');
  const [skuName,setSkuName]=useState('');
  const [skuSize,setSkuSize]=useState('');
  const [skuModel,setSkuModel]=useState('');
  const [retail,setRetail]=useState('0');
  const [wholesale,setWholesale]=useState('0');
  const [dealer,setDealer]=useState('0');
  const [stock,setStock]=useState('0');
  const [inquiryOnly,setInquiryOnly]=useState(true);
  const [description,setDescription]=useState('');
  const [specs,setSpecs]=useState<TechnicalSpec[]>([{key:'',value:''}]);
  const [showTaxonomyEditor,setShowTaxonomyEditor]=useState(false);
  const [newCategoryName,setNewCategoryName]=useState('');
  const [newSubcategoryName,setNewSubcategoryName]=useState('');
  const [formError,setFormError]=useState('');
  const [saveMessage,setSaveMessage]=useState('');
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
    setFamilySearch('');setCategory('');setSubcategory('');setFamilyCode('');setFamilyCodeInput('');setSku('');setPlacement('family');setCreateNewFamily(false);setCreateNewSku(false);setFormError('');setSaveMessage('');setShowEvidence(false);setMobileEditor(true);
  };
  const create=()=>{setFile('');setUrl('');setSource('upload');setSourceError('');setTitle('');setCategory('');setSubcategory('');setFamilyCode('');setFamilyCodeInput('');setFamilySearch('');setSku('');setPlacement('family');setCreateNewFamily(false);setCreateNewSku(false);setFormError('');setSaveMessage('');setShowEvidence(false);setMobileEditor(true)};
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
  const loadFamily=(p?:Product)=>{
    setFamilyCode(p?.code||'');setFamilyCodeInput(p?.code||'');setFamilyName(p?.name||'');setFamilyNameEn(p?.nameEn||'');setFamilyDescription(p?.description||'');setFamilySpecs(p?.technicalSpecs?.length?p.technicalSpecs.map(s=>({...s})):[{key:'',value:''}]);
    setCategory(p?.categoryName||category);setSubcategory(p?.subcategory||'');setSubmenu(p?.submenu||'');setBrand(p?.brand||'ATLAS');setUnit(p?.unit||'عدد');
    setRetail(String(p?.prices?.retail??0));setWholesale(String(p?.prices?.wholesale??0));setDealer(String(p?.prices?.dealer??0));
    setStock(String(p?.stock??0));setInquiryOnly(p?.inquiryOnly??true);setDescription(p?.description||'');
    setSpecs(p?.technicalSpecs?.length?p.technicalSpecs.map(s=>({...s})):[{key:'',value:''}]);
    setSku('');setSkuCodeInput('');setSkuName('');setSkuSize('');setSkuModel('');setCreateNewFamily(false);setCreateNewSku(false);
  };
  const loadSku=(code:string)=>{
    setSku(code);setCreateNewSku(false);
    const v=family?.variants?.find(item=>item.code===code);
    if(!v){setSkuCodeInput('');setSkuName('');setSkuSize('');setSkuModel('');setSpecs([{key:'',value:''}]);return;}
    setSkuCodeInput(v.code);setSkuName(v.name||'');setSkuSize(v.size||'');setSkuModel(v.model||'');
    setRetail(String(v.prices?.retail??v.price??family?.prices?.retail??0));setWholesale(String(v.prices?.wholesale??family?.prices?.wholesale??0));
    setDealer(String(v.prices?.dealer??family?.prices?.dealer??0));setStock(String(v.stock??0));setInquiryOnly(v.inquiryOnly??(Number(v.price||0)<=0));
    setDescription(v.description||family?.description||'');setSpecs(v.technicalSpecs?.length?v.technicalSpecs.map(s=>({...s})):[{key:'',value:''}]);
  };
  const apply=()=>{
    setFormError('');setSaveMessage('');
    const selectedFamily=createNewFamily?undefined:products.find(p=>p.code===familyCode);
    const finalFamilyCode=createNewFamily?familyCodeInput.trim():familyCode;
    if(!file||!url){setFormError('ابتدا یک تصویر انتخاب کنید.');return;}
    if(!category.trim()||!subcategory.trim()){setFormError('دسته و زیردسته محصول را مشخص کنید.');return;}
    if(!finalFamilyCode||!familyName.trim()){setFormError('کد و نام خانواده کالا الزامی است.');return;}
    if(createNewFamily&&(!skuCodeInput.trim()||!skuName.trim())){setFormError('برای خانواده جدید، کد و نام اولین کالا را نیز وارد کنید.');return;}
    if(placement==='sku'&&(!createNewSku&&!sku||createNewSku&&!skuCodeInput.trim()||!skuName.trim())){setFormError('کد و نام SKU را کامل کنید.');return;}
    if(createNewFamily&&products.some(p=>p.code.toLowerCase()===finalFamilyCode.toLowerCase())){setFormError('این کد خانواده قبلاً ثبت شده است.');return;}
    if((createNewFamily||createNewSku)&&skuCodeInput.trim()&&products.some(p=>(p.variants||[]).some(v=>v.code.toLowerCase()===skuCodeInput.trim().toLowerCase()))){setFormError('این کد SKU در کاتالوگ استفاده شده است؛ کد واقعی و یکتا وارد کنید.');return;}
    const cleanSpecs=specs.filter(s=>s.key.trim()).map(s=>({key:s.key.trim(),value:s.value.trim()}));
    const priceTiers={...(selectedFamily?.prices||{base:0,retail:0,wholesale:0,dealer:0}),base:selectedFamily?.prices?.base??((Number(retail)>0)?Math.round(Number(retail)*0.8):0),retail:Number(retail)||0,wholesale:Number(wholesale)||0,dealer:Number(dealer)||0};
    const nowId=`image-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const gallery:ProductGalleryImage={id:nowId,url,fileName:file,scope:placement==='family'?'family':'variant',variantCode:placement==='sku'?(createNewSku?skuCodeInput.trim():sku):undefined,identityVerified:false,title:title.trim()||file,order:(selectedFamily?.galleryImages?.length||0)+1};
    const alreadyLinked=(selectedFamily?.galleryImages||[]).some(img=>img.url===url&&img.scope===gallery.scope&&(img.variantCode||'')===(gallery.variantCode||''));
    const nextGallery=alreadyLinked?[...(selectedFamily?.galleryImages||[])]:[...(selectedFamily?.galleryImages||[]),gallery];
    let variants:ProductVariant[]=[...(selectedFamily?.variants||[])];
    if(createNewFamily){
      variants=[{code:skuCodeInput.trim(),name:skuName.trim(),size:skuSize.trim(),model:skuModel.trim(),brand,unit,price:Number(retail)||0,prices:priceTiers,inquiryOnly,stock:Number(stock)||0,stockKnown:true,active:true,images:placement==='sku'?[url]:[],description,technicalSpecs:cleanSpecs}];
    }else if(placement==='sku'){
      const skuCode=createNewSku?skuCodeInput.trim():sku;
      const idx=variants.findIndex(v=>v.code===skuCode);
      const next:ProductVariant={...(idx>=0?variants[idx]:{} as ProductVariant),code:skuCode,name:skuName.trim(),size:skuSize.trim(),model:skuModel.trim(),brand,unit,price:Number(retail)||0,prices:priceTiers,inquiryOnly,stock:Number(stock)||0,stockKnown:true,active:true,images:[...new Set([...(idx>=0?variants[idx].images||[]:[]),url])],description,technicalSpecs:cleanSpecs};
      if(idx>=0)variants[idx]=next;else variants.push(next);
    }
    const next:Product={
      ...(selectedFamily||{} as Product),code:finalFamilyCode,name:familyName.trim(),nameEn:familyNameEn.trim()||undefined,
      brand,categoryName:category,categorySlug:category.trim().replace(/[\s\u200c]+/g,'-'),subcategory,submenu,unit,
      technicalSpecs:createNewFamily?familySpecs.filter(s=>s.key.trim()).map(s=>({key:s.key.trim(),value:s.value.trim()})):placement==='family'?cleanSpecs:(selectedFamily?.technicalSpecs||[]),
      prices:(createNewFamily||placement==='family')?priceTiers:(selectedFamily?.prices||priceTiers),stock:(createNewFamily||placement==='family')?(Number(stock)||0):(selectedFamily?.stock??0),inquiryOnly:(createNewFamily||placement==='family')?inquiryOnly:(selectedFamily?.inquiryOnly??true),description:createNewFamily?familyDescription.trim():placement==='family'?description:(selectedFamily?.description||''),
      tags:selectedFamily?.tags||['قطعه صنعتی'],active:selectedFamily?.active??true,
      images:[...new Set([...nextGallery.map(img=>img.url),...(selectedFamily?.images||[]),url])],
      galleryImages:nextGallery,variants
    };
    onSaveProduct(next);
    setSaveMessage('اطلاعات کالا و اتصال تصویر ذخیره شد. مشخصات فنی به همان خانواده/کد متصل شد.');
    setCreateNewFamily(false);setCreateNewSku(false);setFamilyCode(finalFamilyCode);setFamilyCodeInput(finalFamilyCode);
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
        <p className="text-xs text-slate-500 mt-1">تصویر، خانواده، کد دقیق کالا و تمام مشخصات فنی را در یک فرم کامل بررسی و ذخیره کنید.</p>
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
              <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-black text-[#55565A]">دسته‌بندی کالا</h4><button type="button" onClick={()=>setShowTaxonomyEditor(v=>!v)} className="text-[#C65A16] text-[11px] font-bold"><FolderPlus size={14} className="inline"/> افزودن دسته/زیردسته</button></div>
              {showTaxonomyEditor&&<div className="rounded-xl border border-orange-200 bg-orange-50 p-3 space-y-2">
                <input value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} className="w-full rounded-lg border bg-white p-2.5 text-xs" placeholder="نام دسته اصلی"/>
                <input value={newSubcategoryName} onChange={e=>setNewSubcategoryName(e.target.value)} className="w-full rounded-lg border bg-white p-2.5 text-xs" placeholder="نام زیردسته (اختیاری)"/>
                <button type="button" onClick={()=>{if(!newCategoryName.trim()){setFormError('نام دسته را وارد کنید.');return;}onCreateCategory(newCategoryName.trim(),newSubcategoryName.trim());setCategory(newCategoryName.trim());setSubcategory(newSubcategoryName.trim());setNewCategoryName('');setNewSubcategoryName('');setShowTaxonomyEditor(false);setFormError('');}} className="w-full rounded-lg bg-[#55565A] py-2 text-xs font-bold text-white">ثبت دسته‌بندی</button>
              </div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <label className="text-[11px] text-slate-600">دسته اصلی<select value={category} onChange={e=>{setCategory(e.target.value);setSubcategory('');setFamilyCode('');setCreateNewFamily(false);setSku('')}} className="mt-1 w-full border rounded-lg bg-white p-2.5"><option value="">انتخاب دسته</option>{categoryNames.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
                <label className="text-[11px] text-slate-600">زیردسته<select disabled={!category} value={subcategory} onChange={e=>{setSubcategory(e.target.value);setFamilyCode('');setCreateNewFamily(false);setSku('')}} className="mt-1 w-full border rounded-lg bg-white p-2.5 disabled:opacity-50"><option value="">انتخاب زیردسته</option>{subcategories.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
              </div>
              <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-black text-[#55565A]">خانواده کالا</h4><button type="button" disabled={!file} onClick={()=>{setCreateNewFamily(true);setCreateNewSku(false);setFamilyCode('');setFamilyCodeInput('');setFamilyName('');setFamilyNameEn('');setFamilyDescription('');setFamilySpecs([{key:'',value:''}]);setSku('');setSkuCodeInput('');setSkuName('');setSkuSize('');setSkuModel('');setBrand('ATLAS');setUnit('عدد');setRetail('0');setWholesale('0');setDealer('0');setStock('0');setInquiryOnly(true);setDescription('');setSpecs([{key:'',value:''}]);setPlacement('family');setFormError('');}} className="text-[#C65A16] text-[11px] font-bold disabled:opacity-50">+ خانواده جدید</button></div>
              <input value={familySearch} onChange={e=>setFamilySearch(e.target.value)} placeholder="جستجوی نام یا کد خانواده…" className="w-full border rounded-lg p-2.5 text-xs"/>
              {!createNewFamily&&<select aria-label="انتخاب خانواده کالا" value={familyCode} onChange={e=>loadFamily(products.find(p=>p.code===e.target.value))} className="w-full border rounded-lg bg-white p-3 text-xs"><option value="">انتخاب خانواده</option>{families.map(p=><option key={p.code} value={p.code}>{p.name} — {p.code}</option>)}</select>}
              {createNewFamily&&<label className="block text-[11px] font-bold text-slate-600">کد خانواده (کد واقعی)<input value={familyCodeInput} onChange={e=>setFamilyCodeInput(e.target.value)} dir="ltr" className="mt-1 w-full rounded-lg border p-2.5" placeholder="کد خانواده"/></label>}
              {(createNewFamily||family)&&<div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3">
                <label className="text-[11px] font-bold text-slate-600">نام فارسی خانواده<input value={familyName} onChange={e=>setFamilyName(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder="نام دقیق محصول"/></label>
                <label className="text-[11px] font-bold text-slate-600">نام انگلیسی<input value={familyNameEn} onChange={e=>setFamilyNameEn(e.target.value)} dir="ltr" className="mt-1 w-full rounded-lg border p-2.5" placeholder="Product name"/></label>
                <label className="text-[11px] font-bold text-slate-600">زیرمنو / گروه<input value={submenu} onChange={e=>setSubmenu(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder="نام زیرمنو"/></label>
                <label className="text-[11px] font-bold text-slate-600">برند<input value={brand} onChange={e=>setBrand(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder="برند"/></label>
                <label className="text-[11px] font-bold text-slate-600">واحد فروش<input value={unit} onChange={e=>setUnit(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder="عدد، متر، رول…"/></label>
                {createNewFamily&&<label className="text-[11px] font-bold text-slate-600 sm:col-span-2">توضیحات خانواده<input value={familyDescription} onChange={e=>setFamilyDescription(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder="کاربرد کلی، جنس یا توضیح خانواده"/></label>}
              </div>
              {createNewFamily&&<div className="space-y-2 rounded-xl border border-slate-200 p-3">
                <div className="flex justify-between items-center gap-2"><h5 className="text-xs font-black text-[#55565A]">مشخصات فنی خانواده</h5><button type="button" onClick={()=>setFamilySpecs(v=>[...v,{key:'',value:''}])} className="text-[11px] font-bold text-[#C65A16]">+ افزودن مشخصه</button></div>
                {familySpecs.map((sp,idx)=><div key={idx} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center"><input aria-label="عنوان مشخصه فنی خانواده جدید" value={sp.key} onChange={e=>setFamilySpecs(v=>v.map((x,i)=>i===idx?{...x,key:e.target.value}:x))} className="min-w-0 rounded-lg border p-2 text-xs" placeholder="مشخصه خانواده"/><input aria-label="مقدار مشخصه فنی خانواده جدید" value={sp.value} onChange={e=>setFamilySpecs(v=>v.map((x,i)=>i===idx?{...x,value:e.target.value}:x))} className="min-w-0 rounded-lg border p-2 text-xs" placeholder="مقدار"/><button type="button" aria-label="حذف مشخصه خانواده جدید" onClick={()=>setFamilySpecs(v=>v.filter((_,i)=>i!==idx))} className="rounded-lg border p-2 text-rose-600"><X size={14}/></button></div>)}
              </div>}
            </div>}
            {url&&(createNewFamily||family)&&<div className="space-y-3 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between gap-2"><h4 className="text-xs font-black text-[#55565A]">محل اتصال تصویر</h4><button type="button" onClick={()=>{setCreateNewSku(true);setPlacement('sku');setSku('');setSkuCodeInput('');setSkuName('');setSkuSize('');setSkuModel('');setRetail(String(family?.prices?.retail??0));setWholesale(String(family?.prices?.wholesale??0));setDealer(String(family?.prices?.dealer??0));setStock('0');setInquiryOnly(true);setDescription('');setSpecs([{key:'',value:''}]);setFormError('');}} className="text-[11px] font-bold text-[#C65A16]">+ کد کالای جدید</button></div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" aria-pressed={placement==='family'} onClick={()=>{setPlacement('family');setCreateNewSku(false);setSku('');setFormError('');}} className={"p-3 rounded-xl border text-xs text-right "+(placement==='family'?'border-[#E06518] bg-[#FFF2E8]':'border-slate-200')}><strong className="block">خانواده</strong><span className="block text-[10px] text-slate-500 mt-1">تصویر عمومی خانواده</span></button>
                <button type="button" aria-pressed={placement==='sku'} onClick={()=>{setPlacement('sku');setFormError('');if(family&&!sku&&!createNewSku){const v=family.variants?.[0];if(v)loadSku(v.code);}}} className={"p-3 rounded-xl border text-xs text-right "+(placement==='sku'?'border-[#E06518] bg-[#FFF2E8]':'border-slate-200')}><strong className="block">کد کالا (SKU)</strong><span className="block text-[10px] text-slate-500 mt-1">فقط همین مدل</span></button>
              </div>
              {placement==='sku'&&family&&!createNewSku&&<label className="block text-xs text-[#55565A]">انتخاب کد SKU<select value={sku} onChange={e=>loadSku(e.target.value)} className="mt-1 w-full border rounded-lg p-3 bg-white"><option value="">انتخاب کد کالا</option>{(family.variants||[]).map(v=><option key={v.code} value={v.code}>{v.code} — {v.name}</option>)}</select></label>}
              {(placement==='sku'||createNewFamily)&&<div className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/40 p-3">
                <h5 className="text-xs font-black text-[#55565A]">فرم کامل کد کالا</h5>
                {(createNewSku||createNewFamily)&&<label className="block text-[11px] font-bold text-slate-600">کد SKU واقعی<input value={skuCodeInput} onChange={e=>setSkuCodeInput(e.target.value)} dir="ltr" className="mt-1 w-full rounded-lg border p-2.5 bg-white" placeholder="کد درج‌شده در کاتالوگ"/></label>}
                {!(createNewSku||createNewFamily)&&<p className="text-[11px] text-slate-500">کد انتخاب‌شده: <b dir="ltr">{sku}</b></p>}
                <label className="block text-[11px] font-bold text-slate-600">نام دقیق کد کالا<input value={skuName} onChange={e=>setSkuName(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 bg-white" placeholder="نام همین مدل"/></label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <label className="text-[11px] font-bold text-slate-600">سایز / ابعاد<input value={skuSize} onChange={e=>setSkuSize(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 bg-white" placeholder="سایز دقیق"/></label>
                  <label className="text-[11px] font-bold text-slate-600">مدل / پروفیل<input value={skuModel} onChange={e=>setSkuModel(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 bg-white" placeholder="مدل"/></label>
                  <label className="text-[11px] font-bold text-slate-600">قیمت خرده‌فروشی<input type="number" min="0" value={retail} onChange={e=>setRetail(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 bg-white"/></label>
                  <label className="text-[11px] font-bold text-slate-600">قیمت همکار<input type="number" min="0" value={wholesale} onChange={e=>setWholesale(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 bg-white"/></label>
                  <label className="text-[11px] font-bold text-slate-600">قیمت نمایندگی<input type="number" min="0" value={dealer} onChange={e=>setDealer(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 bg-white"/></label>
                  <label className="text-[11px] font-bold text-slate-600">موجودی<input type="number" min="0" value={stock} onChange={e=>setStock(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 bg-white"/></label>
                </div>
                <label className="flex items-center gap-2 text-xs text-slate-700"><input type="checkbox" checked={inquiryOnly} onChange={e=>setInquiryOnly(e.target.checked)} className="accent-[#E06518]"/> قیمت فقط با استعلام اعلام شود</label>
                <label className="block text-[11px] font-bold text-slate-600">توضیحات فنی و کاربرد<input value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5 bg-white" placeholder="کاربرد، جنس، استاندارد…"/></label>
                <div className="space-y-2">
                  <div className="flex justify-between items-center gap-2"><h6 className="text-[11px] font-black text-[#55565A]">مشخصات فنی این کد</h6><button type="button" onClick={()=>setSpecs(v=>[...v,{key:'',value:''}])} className="text-[11px] font-bold text-[#C65A16]">+ افزودن مشخصه</button></div>
                  {specs.map((sp,idx)=><div key={idx} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center"><input aria-label="عنوان مشخصه فنی" value={sp.key} onChange={e=>setSpecs(v=>v.map((x,i)=>i===idx?{...x,key:e.target.value}:x))} className="min-w-0 rounded-lg border p-2 text-xs bg-white" placeholder="مشخصه"/><input aria-label="مقدار مشخصه فنی" value={sp.value} onChange={e=>setSpecs(v=>v.map((x,i)=>i===idx?{...x,value:e.target.value}:x))} className="min-w-0 rounded-lg border p-2 text-xs bg-white" placeholder="مقدار"/><button type="button" aria-label="حذف مشخصه فنی" onClick={()=>setSpecs(v=>v.filter((_,i)=>i!==idx))} className="rounded-lg border p-2 text-rose-600"><X size={14}/></button></div>)}
                </div>
              </div>}
              {placement==='family'&&!createNewFamily&&<div className="space-y-3 rounded-xl border border-slate-200 p-3">
                <h5 className="text-xs font-black text-[#55565A]">مشخصات فنی مشترک خانواده</h5>
                <label className="block text-[11px] font-bold text-slate-600">توضیحات خانواده<input value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" placeholder="توضیحات کلی خانواده"/></label>
                <div className="flex justify-between items-center gap-2"><h6 className="text-[11px] font-black text-[#55565A]">مشخصات فنی خانواده</h6><button type="button" onClick={()=>setSpecs(v=>[...v,{key:'',value:''}])} className="text-[11px] font-bold text-[#C65A16]">+ افزودن مشخصه</button></div>
                {specs.map((sp,idx)=><div key={idx} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 items-center"><input aria-label="عنوان مشخصه فنی خانواده" value={sp.key} onChange={e=>setSpecs(v=>v.map((x,i)=>i===idx?{...x,key:e.target.value}:x))} className="min-w-0 rounded-lg border p-2 text-xs" placeholder="مشخصه"/><input aria-label="مقدار مشخصه فنی خانواده" value={sp.value} onChange={e=>setSpecs(v=>v.map((x,i)=>i===idx?{...x,value:e.target.value}:x))} className="min-w-0 rounded-lg border p-2 text-xs" placeholder="مقدار"/><button type="button" aria-label="حذف مشخصه فنی خانواده" onClick={()=>setSpecs(v=>v.filter((_,i)=>i!==idx))} className="rounded-lg border p-2 text-rose-600"><X size={14}/></button></div>)}
              </div>}
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
            {url&&<p className="text-[11px] leading-5 text-amber-700">اتصال تصویر به‌تنهایی هویت فنی قطعه را اثبات نمی‌کند. کدها و مشخصات را با کاتالوگ واقعی تطبیق دهید. فایل جدید باید در فضای ذخیره دائمی پروژه قرار گیرد.</p>}
            {formError&&<p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">{formError}</p>}
            {saveMessage&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{saveMessage}</p>}
            {url&&<button type="button" onClick={apply} className="w-full rounded-xl bg-[#E06518] text-white py-3.5 font-bold text-xs flex justify-center items-center gap-2"><Check size={17}/> ذخیره مشخصات و اتصال تصویر</button>}
          </div>}
        </aside>
      </div>
    </div>
  </section>;
}
