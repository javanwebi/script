import React, {useEffect,useMemo,useState} from 'react';
import { requireAdminApiJson } from '../../utils/adminApiResponse';
import {Check,ChevronLeft,ChevronRight,Download,ImagePlus,Search,SlidersHorizontal,X,FolderPlus,FileImage,ArrowLeft,ArrowLeftRight,Edit3,Info,Trash2,Save} from 'lucide-react';
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
export function ProductImageAudit({products,categories,onEdit,onCreateFamily,onCreateCategory,onEditCategory,onEditFamily,onCreateSku,onAssignSku,onAssignSkus,onAssignDirectSku}:{
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
  onAssignSkus:(input:{skuCodes:string[];imageUrl:string;fileName:string;title?:string})=>Promise<void>;
  onAssignDirectSku:(input:{skuCode:string;categorySlug:string;submenu:string;subcategory:string;imageUrl:string})=>Promise<void>;
}){
  const [records,setRecords]=useState<DbImageAuditRow[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [auditRevision,setAuditRevision]=useState(0);
  useEffect(()=>{
    const controller=new AbortController();
    setLoading(true);setLoadError('');
    fetch('/api/admin/catalog-image-audits',{credentials:'same-origin',cache:'no-store',signal:controller.signal})
      .then(async res=>{
        const data=await requireAdminApiJson<{rows?:DbImageAuditRow[]}>(res,'دریافت تصاویر کاتالوگ');
        if(!Array.isArray(data.rows))throw Error('فهرست تصاویر در پاسخ سرور وجود ندارد.');
        return data.rows;
      })
      .then(rows=>{setRecords(rows);setLoading(false);})
      .catch(error=>{if(!controller.signal.aborted){setLoadError(error.message||'ارتباط با دیتابیس برقرار نشد.');setLoading(false);}});
    return ()=>controller.abort();
  },[auditRevision]);
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
  const [saveNotice,setSaveNotice]=useState('');
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
  const [selectedSkuCodes,setSelectedSkuCodes]=useState<string[]>([]);
  const [bindingEditId,setBindingEditId]=useState('');
  const [bindingEditSku,setBindingEditSku]=useState('');
  const [bindingEditFamily,setBindingEditFamily]=useState('');
  const [bindingEditSearch,setBindingEditSearch]=useState('');
  const [moveSkuCode,setMoveSkuCode]=useState('');
  const [moveTargetFamily,setMoveTargetFamily]=useState('');
  const [directEditSku,setDirectEditSku]=useState('');
  const [bindingActionPending,setBindingActionPending]=useState(false);
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
    const matches=allSkuChoices.filter(({family:owner,variant})=>{
      const matchesFamily=directMode||searchAllFamilies||!familyCode||owner.code===familyCode;
      const matchesQuery=!query||normalizeCatalogueText([
        variant.code,variant.name,variant.size,variant.model,owner.code,owner.name,owner.categoryName,owner.submenu,owner.subcategory
      ].filter(Boolean).join(' ')).includes(query);
      return matchesFamily&&matchesQuery;
    });
    return matches.slice(0,30);
  },[allSkuChoices,skuSearch,familyCode,searchAllFamilies,directMode]);
  const selectedSkuChoice=allSkuChoices.find(choice=>choice.variant.code===sku);
  const selectedSkuChoices=allSkuChoices.filter(choice=>selectedSkuCodes.includes(choice.variant.code));
  const bindingEditChoices=useMemo(()=>{
    const query=normalizeCatalogueText(bindingEditSearch.trim());
    return allSkuChoices.filter(({family:owner,variant})=>!query||normalizeCatalogueText([
      variant.code,variant.name,owner.code,owner.name,owner.categoryName
    ].filter(Boolean).join(' ')).includes(query)).slice(0,20);
  },[allSkuChoices,bindingEditSearch]);
  const filtered=useMemo(()=>audit.filter(r=>{
    if(filter!=='all'&&(filter==='catalogue-photo'?!r.ownerCatalogue:r.status!==filter))return false;
    if(familyFilter==='none'&&r.families.length)return false;
    if(familyFilter!=='all'&&familyFilter!=='none'&&!r.families.some(f=>f.code===familyFilter))return false;
    return normalizeCatalogueText([r.file,r.observed,r.research?.visualType,r.ownerCatalogue?.catalogueGroup,...r.families.flatMap(f=>[f.code,f.name,...f.skus.map(s=>s.code)]),...r.directSkus.map(s=>[s.skuCode,s.skuName||'']).flat()].join(' ')).includes(normalizeCatalogueText(search.trim()));
  }),[audit,filter,familyFilter,search]);
  const totals=useMemo(()=>({unassigned:audit.filter(x=>x.status==='unassigned').length,family:audit.filter(x=>x.status==='family-example').length,sku:audit.filter(x=>x.status==='sku-linked').length,catalogue:audit.filter(x=>!!x.ownerCatalogue).length}),[audit]);
  const pages=Math.max(1,Math.ceil(filtered.length/24));
  const currentPage=Math.min(page,pages-1);
  const visible=filtered.slice(currentPage*24,(currentPage+1)*24);
  const choose=(f:string)=>{
    const found=audit.find(x=>x.file===f);
    setFile(f);setUrl(getProductImageUrl(f));setSource('existing');setSelectedUpload(null);setSourceError('');setSaveNotice('');setTitle(found?.observed||'');
    setFamilySearch('');setMenuGroup('');setCategory('');setSubmenu('');setSubcategory('');setFamilyCode('');setSku('');setSelectedSkuCodes([]);setSkuSearch('');setSelectedSkuCodes([]);setBindingEditId('');setMoveSkuCode('');setDirectEditSku('');setPlacement('family');setDirectMode(false);setShowEvidence(false);setMobileEditor(true);
  };
  const create=()=>{setFile('');setUrl('');setSource('upload');setSelectedUpload(null);setSourceError('');setSaveNotice('');setTitle('');setMenuGroup('');setCategory('');setSubmenu('');setSubcategory('');setFamilyCode('');setFamilySearch('');setSku('');setSkuSearch('');setSelectedSkuCodes([]);setBindingEditId('');setMoveSkuCode('');setDirectEditSku('');setPlacement('family');setShowEvidence(false);setMobileEditor(true)};
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
    const input=urlInput.trim();
    const resolved=getProductImageUrl(input);
    if(!resolved||!resolved.startsWith('/storage/products/')){
      setSourceError('فقط تصویر ثبت‌شده در فضای ذخیره‌سازی صنعت پیش قابل اتصال است. فایل خارجی را از «بارگذاری تصویر جدید» آپلود کنید.');
      return;
    }
    setFile(resolved.split('/').pop()||'تصویر');setUrl(resolved);setTitle('');setSourceError('');
  };
  const closeSelection=()=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url);setMobileEditor(false);setFile('');setUrl('');setSource('existing');setSelectedUpload(null);setSku('');setSkuSearch('');setSelectedSkuCodes([]);setBindingEditId('');setMoveSkuCode('');setDirectEditSku('')};
  const chooseFamily=(code:string)=>{
    setFamilyCode(code);setSku('');setSelectedSkuCodes([]);
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
    const current=taxonomy.byFamily.get(code);
    if(current?.categorySlug===category&&current.submenuName===submenu&&
      (current.leafName||'')===subcategory)return;
    await saveApprovedFamilyAssignment({familyCode:code,categorySlug:category,submenu,leaf:subcategory});
    taxonomy.refresh();
  };
  const apply=async()=>{
    if(!file||!url||(!directMode&&!familyCode)|| (directMode&&!directEditSku&&!sku) ||
      (!directMode&&placement==='sku'&&!selectedSkuCodes.length)||savingUpload)return;
    if(directMode){
      const destination=approvedCategories.find(item=>item.slug===category);
      if(!destination||!submenu){setSourceError('برای کد بدون خانواده، دسته و زیرمنو را انتخاب کنید.');return;}
      setSavingUpload(true);setSourceError('');
      try{
        let imageUrl=url;
        if(source==='upload'){
          if(!selectedUpload)throw new Error('تصویر انتخاب نشده است.');
          const response=await fetch('/api/catalog/category-images/upload',{method:'POST',credentials:'same-origin',headers:{'Content-Type':selectedUpload.type},body:selectedUpload});
          const payload=await requireAdminApiJson<{url?:string}>(response,'آپلود تصویر کد مستقیم');
          if(!payload.url)throw new Error('آپلود تصویر: آدرس فایل در پاسخ سرور وجود ندارد.');
          imageUrl=payload.url;
        }
        if(directEditSku){
          const response=await fetch('/api/catalog/direct-skus/'+encodeURIComponent(directEditSku),{
            method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({categorySlug:destination.slug,submenu,subcategory,imageUrl})
          });
          await requireAdminApiJson(response,'ویرایش کد مستقیم');
          setSaveNotice('مسیر دسته‌بندی کد مستقیم اصلاح شد؛ اطلاعات فنی و تجاری حفظ شدند.');
          setDirectEditSku('');
        }else{
          await onAssignDirectSku({skuCode:sku,categorySlug:destination.slug,submenu,subcategory,imageUrl});
        }
        setAuditRevision(value=>value+1);
        closeSelection();
      }catch(error:any){setSourceError(error.message||'ثبت یا ویرایش کد مستقیم انجام نشد.');}
      finally{setSavingUpload(false);}
      return;
    }
    if(placement==='sku'){
      const chosen=allSkuChoices.filter(choice=>selectedSkuCodes.includes(choice.variant.code));
      if(!chosen.length||chosen.length!==selectedSkuCodes.length){setSourceError('کدهای انتخاب‌شده دیگر در کاتالوگ فعال نیستند؛ فهرست را تازه کنید.');return;}
      setSavingUpload(true);setSourceError('');
      let firstUploadBound=false;
      try{
        let assignedUrl=url,assignedFile=file;
        if(source==='upload'){
          if(!selectedUpload)throw new Error('ابتدا فایل تصویر را انتخاب کنید.');
          // Upload once against the first real SKU. The batch endpoint then
          // idempotently binds the same physical file to every selected SKU.
          const first=chosen[0];
          const saved=await uploadProductImage(selectedUpload,{
            familyCode:first.family.code,variantCode:first.variant.code,title:title||selectedUpload.name
          });
          assignedUrl=saved.url;assignedFile=saved.fileName;firstUploadBound=true;
        }
        await onAssignSkus({
          skuCodes:selectedSkuCodes,imageUrl:assignedUrl,fileName:assignedFile,title:title||undefined
        });
        if(chosen.every(choice=>choice.family.code===familyCode))await saveSelectedPath(familyCode);
        setSaveNotice('تصویر به '+fa(chosen.length)+' کد کالا متصل شد. فایل اصلی مشترک است و هر اتصال جداگانه قابل ویرایش یا حذف است.');
        setAuditRevision(value=>value+1);
        closeSelection();
      }catch(error:any){
        setSourceError((firstUploadBound
          ? 'تصویر بارگذاری شد و حداقل به کد اول متصل است؛ نتیجه سایر اتصال‌ها را قبل از تکرار بررسی کنید. '
          : 'اتصال گروهی تصویر انجام نشد. ') +
          (error instanceof Error ? error.message : 'خطای ارتباط با سرور'));
      }
      finally{setSavingUpload(false);}
      return;
    }
    if(source==='upload'){
      if(!selectedUpload){setSourceError('ابتدا فایل تصویر را انتخاب کنید.');return;}
      setSavingUpload(true);setSourceError('');
      try{
        // Verify the destination before uploading; do not create an orphan
        // image when the user lacks category-assignment permission.
        await saveSelectedPath(familyCode);
        const saved=await uploadProductImage(selectedUpload,{
          familyCode,title:title||selectedUpload.name
        });
        setSaveNotice('تصویر در فضای دائمی و دیتابیس ذخیره شد. ویرایش مشخصات خانواده اختیاری است.');
        setAuditRevision(value=>value+1);
        onEdit(familyCode,saved.fileName,undefined,saved.url,title,saved.id);
        closeSelection();
      }catch(error:any){setSourceError(error.message||'ثبت مسیر یا تصویر در دیتابیس انجام نشد.');}
      finally{setSavingUpload(false);}
      return;
    }
    // Existing images and links must be persisted now, not merely staged in
    // a second, easy-to-close family editor.
    setSavingUpload(true);setSourceError('');
    try{
      const response=await fetch('/api/catalog/product-images/assign',{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},
        signal:AbortSignal.timeout(20000),
        body:JSON.stringify({familyCode,imageUrl:url,title,fileName:file,
          categorySlug:category||undefined,submenu:submenu||undefined,leaf:subcategory||undefined})
      });
      const result=await requireAdminApiJson<{image?:{id:string;url:string;fileName:string}}>(
        response,'ذخیره اتصال تصویر و دسته‌بندی');
      if(!result.image?.id||!result.image.url)throw new Error('تأیید ثبت تصویر از سرور دریافت نشد.');
      taxonomy.refresh();
      setSaveNotice('تصویر و مسیر انتخاب‌شده در PostgreSQL ذخیره شدند. اکنون می‌توانید مشخصات کالا را تکمیل کنید.');
      setAuditRevision(value=>value+1);
      onEdit(familyCode,result.image.fileName||file,undefined,result.image.url,title,result.image.id);
      closeSelection();
    }catch(error){
      setSourceError(error instanceof Error?error.message:'اتصال تصویر ذخیره نشد.');
    }finally{setSavingUpload(false);}
  };
  const removeBinding=async(id:string)=>{
    if(!id||bindingActionPending)return;
    if(!window.confirm('فقط اتصال این تصویر حذف می‌شود؛ خود فایل، کد کالا، قیمت، موجودی و مشخصات فنی باقی می‌مانند. ادامه می‌دهید؟'))return;
    setBindingActionPending(true);setSourceError('');
    try{
      const response=await fetch('/api/catalog/product-images/bindings/'+encodeURIComponent(id),{method:'DELETE',credentials:'same-origin',signal:AbortSignal.timeout(20000)});
      await requireAdminApiJson(response,'حذف اتصال تصویر');
      setBindingEditId('');setAuditRevision(value=>value+1);
    }catch(error){setSourceError(error instanceof Error?error.message:'حذف اتصال انجام نشد.');}
    finally{setBindingActionPending(false);}
  };
  const beginBindingEdit=(binding:NonNullable<AuditRow['bindingRows']>[number])=>{
    setBindingEditId(binding.id);
    if(binding.scope==='variant'){
      setBindingEditSku(binding.skuCode||'');
      setBindingEditSearch(binding.skuCode||'');
      setBindingEditFamily('');
    }else{
      setBindingEditFamily(binding.familyCode);
      setBindingEditSku('');
      setBindingEditSearch('');
    }
  };
  const saveBindingEdit=async(binding:NonNullable<AuditRow['bindingRows']>[number])=>{
    if(bindingActionPending)return;
    const payload=binding.scope==='variant'?{skuCode:bindingEditSku}:{familyCode:bindingEditFamily};
    if(binding.scope==='variant'&&!bindingEditSku){setSourceError('کد مقصد را انتخاب کنید.');return;}
    if(binding.scope!=='variant'&&!bindingEditFamily){setSourceError('خانواده مقصد را انتخاب کنید.');return;}
    setBindingActionPending(true);setSourceError('');
    try{
      const response=await fetch('/api/catalog/product-images/bindings/'+encodeURIComponent(binding.id),{
        method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)
      });
      await requireAdminApiJson(response,'ویرایش اتصال تصویر');
      setBindingEditId('');setAuditRevision(value=>value+1);
    }catch(error){setSourceError(error instanceof Error?error.message:'ویرایش اتصال انجام نشد.');}
    finally{setBindingActionPending(false);}
  };
  const moveBoundSku=async(binding:NonNullable<AuditRow['bindingRows']>[number])=>{
    if(!binding.skuCode||!moveTargetFamily||bindingActionPending)return;
    if(moveTargetFamily===binding.familyCode){setSourceError('خانواده مقصد با خانواده فعلی یکسان است.');return;}
    if(!window.confirm('کد '+binding.skuCode+' به‌صورت واقعی از خانواده فعلی به خانواده مقصد منتقل شود؟ قیمت، موجودی و مشخصات فنی حفظ می‌شوند؛ این کار با تغییر اتصال تصویر فرق دارد.'))return;
    setBindingActionPending(true);setSourceError('');
    try{
      await onAssignSku({
        targetFamilyCode:moveTargetFamily,skuCode:binding.skuCode,
        imageUrl:binding.url||url,fileName:(binding.url||url).split('/').pop()||file,
        title:binding.title||undefined
      });
      setMoveSkuCode('');setMoveTargetFamily('');setAuditRevision(value=>value+1);
    }catch(error){setSourceError(error instanceof Error?error.message:'انتقال کد به خانواده مقصد انجام نشد.');}
    finally{setBindingActionPending(false);}
  };
  const removeDirectImage=async(skuCode:string)=>{
    if(bindingActionPending)return;
    if(!window.confirm('فقط تصویر از این کد مستقیم جدا می‌شود؛ ثبت کد در زیرمنو باقی می‌ماند. ادامه می‌دهید؟'))return;
    setBindingActionPending(true);setSourceError('');
    try{
      const response=await fetch('/api/catalog/direct-skus/'+encodeURIComponent(skuCode)+'/image',{method:'DELETE',credentials:'same-origin'});
      await requireAdminApiJson(response,'حذف تصویر کد مستقیم');
      setAuditRevision(value=>value+1);
    }catch(error){setSourceError(error instanceof Error?error.message:'حذف تصویر کد مستقیم انجام نشد.');}
    finally{setBindingActionPending(false);}
  };
  const deactivateDirectSku=async(skuCode:string)=>{
    if(bindingActionPending)return;
    if(!window.confirm('این کد از زیرمنوی فروشگاه غیرفعال می‌شود؛ رکورد اصلی کالا، سفارش‌ها، قیمت و مشخصات فنی حذف نمی‌شوند. ادامه می‌دهید؟'))return;
    setBindingActionPending(true);setSourceError('');
    try{
      const response=await fetch('/api/catalog/direct-skus/'+encodeURIComponent(skuCode),{method:'DELETE',credentials:'same-origin'});
      await requireAdminApiJson(response,'غیرفعال‌سازی کد مستقیم');
      setAuditRevision(value=>value+1);
    }catch(error){setSourceError(error instanceof Error?error.message:'غیرفعال‌سازی کد مستقیم انجام نشد.');}
    finally{setBindingActionPending(false);}
  };
  const beginDirectEdit=(item:NonNullable<AuditRow['directSkus']>[number])=>{
    setDirectEditSku(item.skuCode);setDirectMode(true);setFamilyCode('');
    setCategory(item.categorySlug||'');
    setMenuGroup(approvedGroups.find(group=>group.categorySlugs.includes(item.categorySlug||''))?.id||'');
    setSubmenu(item.submenu||'');setSubcategory(item.subcategory||'');
    setSku(item.skuCode);setSourceError('');
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
      {saveNotice&&<div role="status" className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-800">{saveNotice}</div>}

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
                </div>:row.directSkus.length>0?<p className="text-[11px] leading-6 font-bold text-emerald-700">اتصال مستقیم به کد کالا (بدون خانواده)</p>:<p className="text-[11px] leading-6 text-slate-500">خانواده و کد کالا هنوز تأیید نشده است.</p>}
                {row.directSkus.length>0&&<div className="mt-2 space-y-1 border-t border-slate-200 pt-2">{row.directSkus.slice(0,3).map(item=><p key={item.skuCode} className="text-[11px] text-emerald-800">کد کالا: <span dir="ltr" className="font-bold">{item.skuCode}</span>{item.skuName?' · '+item.skuName:''}</p>)}</div>}
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
              {selectedRow&&(selectedRow.bindingRows?.length||selectedRow.directSkus.length)>0&&<section className="space-y-3 rounded-xl border border-[#E8C7AE] bg-[#FFFCF9] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h4 className="text-sm font-black text-[#55565A]">مدیریت اتصال‌های فعلی تصویر</h4><p className="mt-1 text-[10px] leading-5 text-slate-500">هر اتصال جداگانه قابل ویرایش یا حذف است؛ حذف اتصال، فایل و اطلاعات اصلی کالا را پاک نمی‌کند.</p></div>
                  <span className="rounded-lg bg-white px-2.5 py-1.5 text-[10px] font-bold text-[#C65A16]">{fa((selectedRow.bindingRows?.length||0)+selectedRow.directSkus.length)} اتصال</span>
                </div>
                {!!selectedRow.bindingRows?.length&&<div className="space-y-2">
                  {selectedRow.bindingRows.map(binding=>{
                    const owner=allFamilies.find(item=>item.code===binding.familyCode);
                    const variant=owner?.variants?.find(item=>item.code===binding.skuCode);
                    return <div key={binding.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#55565A]">{binding.scope==='variant'?'اتصال به کد کالا':'تصویر عمومی خانواده'}</p>
                          <p className="mt-1 text-[11px] text-slate-700">{owner?.name||binding.familyCode}</p>
                          <p dir="ltr" className="mt-1 text-[10px] text-slate-500">{binding.skuCode||binding.familyCode}</p>
                          {variant&&<p className="mt-1 text-[10px] text-slate-500">{variant.name} · {variant.size||'سایز ثبت نشده'}</p>}
                          {binding.title&&<p className="mt-1 text-[10px] text-slate-400">{binding.title}</p>}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" disabled={bindingActionPending} onClick={()=>beginBindingEdit(binding)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-700"><Edit3 size={12}/> ویرایش اتصال</button>
                          <button type="button" disabled={bindingActionPending} onClick={()=>void removeBinding(binding.id)} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700"><Trash2 size={12}/> حذف اتصال</button>
                        </div>
                      </div>
                      {bindingEditId===binding.id&&<div className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3">
                        {binding.scope==='variant'?<>
                          <label className="block text-[11px] font-bold text-slate-700">کد کالای جدید برای همین تصویر
                            <input value={bindingEditSearch} onChange={e=>setBindingEditSearch(e.target.value)} placeholder="جستجوی کد یا نام کالا…" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-normal"/>
                          </label>
                          <div className="max-h-36 space-y-1 overflow-y-auto">
                            {bindingEditChoices.map(choice=><button key={choice.variant.code} type="button" onClick={()=>{setBindingEditSku(choice.variant.code);setBindingEditSearch(choice.variant.code)}} className={bindingEditSku===choice.variant.code?"flex w-full items-center justify-between rounded-md border border-[#E06518] bg-orange-50 p-2 text-right":"flex w-full items-center justify-between rounded-md border border-slate-200 bg-white p-2 text-right"}>
                              <span><b dir="ltr" className="block text-[10px]">{choice.variant.code}</b><span className="text-[10px] text-slate-500">{choice.family.name}</span></span>
                              {bindingEditSku===choice.variant.code&&<Check size={14} className="text-[#E06518]"/>}
                            </button>)}
                          </div>
                        </>:<>
                          <label className="block text-[11px] font-bold text-slate-700">خانواده مقصد
                            <select value={bindingEditFamily} onChange={e=>setBindingEditFamily(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs font-normal">
                              <option value="">انتخاب خانواده</option>{allFamilies.map(item=><option key={item.code} value={item.code}>{item.name} — {item.code}</option>)}
                            </select>
                          </label>
                        </>}
                        <div className="flex flex-wrap gap-2">
                          <button type="button" disabled={bindingActionPending} onClick={()=>void saveBindingEdit(binding)} className="inline-flex items-center gap-1 rounded-lg bg-[#E06518] px-3 py-2 text-[10px] font-bold text-white"><Save size={12}/> ذخیره ویرایش</button>
                          <button type="button" onClick={()=>setBindingEditId('')} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600">انصراف</button>
                        </div>
                      </div>}
                      {binding.scope==='variant'&&binding.skuCode&&<div className="mt-2 border-t border-slate-100 pt-2">
                        <button type="button" onClick={()=>{setMoveSkuCode(moveSkuCode===binding.skuCode?'':binding.skuCode||'');setMoveTargetFamily('')}} className="text-[10px] font-bold text-amber-800">انتقال واقعی کد به خانواده دیگر…</button>
                        {moveSkuCode===binding.skuCode&&<div className="mt-2 space-y-2 rounded-lg bg-amber-50 p-2.5">
                          <p className="text-[10px] leading-5 text-amber-900">این عملیات خود کد کالا را از خانواده فعلی به خانواده جدید منتقل می‌کند؛ برخلاف ویرایش اتصال تصویر.</p>
                          <select value={moveTargetFamily} onChange={e=>setMoveTargetFamily(e.target.value)} className="w-full rounded-lg border border-amber-200 bg-white p-2.5 text-xs">
                            <option value="">انتخاب خانواده مقصد</option>{allFamilies.filter(item=>item.code!==binding.familyCode).map(item=><option key={item.code} value={item.code}>{item.name} — {item.code}</option>)}
                          </select>
                          <button type="button" disabled={!moveTargetFamily||bindingActionPending} onClick={()=>void moveBoundSku(binding)} className="rounded-lg bg-amber-700 px-3 py-2 text-[10px] font-bold text-white disabled:opacity-40">تأیید انتقال کد و حفظ اطلاعات</button>
                        </div>}
                      </div>}
                    </div>;
                  })}
                </div>}
                {!!selectedRow.directSkus.length&&<div className="space-y-2">
                  {selectedRow.directSkus.map(item=><div key={item.skuCode} className="rounded-lg border border-emerald-100 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p dir="ltr" className="text-xs font-black text-emerald-800">{item.skuCode}</p><p className="mt-1 text-[10px] text-slate-600">{item.skuName||'کد مستقیم'} · {item.categoryName||''}</p><p className="mt-1 text-[10px] text-slate-500">{item.submenu||''}{item.subcategory?' · '+item.subcategory:''}</p></div>
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={()=>beginDirectEdit(item)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-700"><Edit3 size={12} className="inline"/> ویرایش مسیر</button>
                        <button type="button" disabled={bindingActionPending} onClick={()=>void removeDirectImage(item.skuCode)} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] font-bold text-amber-800">حذف تصویر</button>
                        <button type="button" disabled={bindingActionPending} onClick={()=>void deactivateDirectSku(item.skuCode)} className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[10px] font-bold text-rose-700">حذف از زیرمنو</button>
                      </div>
                    </div>
                  </div>)}
                </div>}
                {!selectedRow.bindingRows?.length&&selectedRow.families.length>0&&<p className="text-[10px] leading-5 text-amber-800">بعضی اتصال‌های قدیمی از آرایه‌های تاریخی کالا خوانده شده‌اند و شناسه گالری ندارند؛ برای تغییر آن‌ها ابتدا از مسیر اتصال جدید استفاده کنید.</p>}
              </section>}
              <div className="flex flex-wrap gap-2" role="group" aria-label="منبع تصویر">
                {([['existing','بازگشت به بانک تصاویر'],['upload','بارگذاری تصویر جدید'],['url','لینک تصویر ذخیره‌شده']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={source===key} onClick={()=>{if(key==='existing'){closeSelection();return;}setSource(key);setSelectedUpload(null);setUrl('');setFile('');setSourceError('')}} className={source===key?"rounded-lg border border-[#E06518] bg-[#FFF2E8] px-3 py-2 text-[11px] font-bold text-[#C65A16]":"rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 hover:bg-slate-50"}>{label}</button>)}
              </div>
              {source==='upload'&&<label className="block rounded-xl border border-dashed border-[#E7B995] bg-[#FFFAF6] p-4 text-xs font-bold text-[#55565A]">انتخاب تصویر از دستگاه<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>chooseFile(e.target.files?.[0])} className="mt-2 block w-full text-xs"/></label>}
              {source==='url'&&<div className="flex flex-col gap-2 sm:flex-row"><input type="url" value={urlInput} onChange={e=>setUrlInput(e.target.value)} dir="ltr" placeholder="/storage/products/catalog/e(1).png" className="min-w-0 flex-1 rounded-lg border border-slate-200 p-3 text-xs"/><button type="button" onClick={chooseUrl} className="rounded-lg bg-[#55565A] px-4 py-3 text-xs font-bold text-white">بارگذاری لینک</button></div>}
              {sourceError&&<p role="alert" className="text-xs text-rose-600">{sourceError}</p>}
              {url&&<label className="block text-xs font-bold text-[#55565A]">نام یا توضیح تصویر<input value={title} onChange={e=>setTitle(e.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 p-3 font-normal" placeholder="نام قطعه یا توضیحی که در تصویر دیده می‌شود"/></label>}
              {url&&<div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h4 className="text-sm font-black text-[#55565A]">۱. دسته‌بندی محصول</h4><p className="mt-1 text-[10px] text-slate-500">مدیریت دسته، زیرمنو، زیرگروه و تصویر بدون خروج از این پنجره</p></div>
                  <div className="flex flex-wrap gap-2">
                    {category&&currentCategory&&categories.some(item=>item.slug===category)&&<button type="button" onClick={()=>onEditCategory(currentCategory.name,source==='upload'?'':url)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-bold text-[#55565A]"><Edit3 size={14}/> ویرایش دسته و تصویر</button>}
                    <span className="rounded-lg bg-orange-50 px-2.5 py-2 text-[11px] font-bold text-[#C65A16]">مدیریت نام‌ها از بخش دسته‌بندی‌های کاتالوگ</span>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <label className="text-xs text-slate-600">گروه‌بندی مگامنو (سطح ۱)
                    <select value={menuGroup} onChange={e=>{setMenuGroup(e.target.value);setCategory('');setSubmenu('');setSubcategory('');setFamilyCode('');setSku('')}} className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3">
                      <option value="">انتخاب سرگروه</option>
                      {approvedGroups.map(group=><option key={group.id} value={group.id}>{group.title}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600">دسته محصولات (سطح ۲)
                    <select value={category} disabled={!menuGroup} onChange={e=>{setCategory(e.target.value);setSubmenu('');setSubcategory('');setFamilyCode('');setSku('')}}
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-50">
                      <option value="">انتخاب دسته</option>
                      {approvedCategories.filter(cat=>approvedGroups.find(group=>group.id===menuGroup)?.categorySlugs.includes(cat.slug)).map(cat=>
                        <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600">زیرمنو (سطح ۳)
                    <select value={submenu} disabled={!category} onChange={e=>{setSubmenu(e.target.value);setSubcategory('');setFamilyCode('');setSku('')}}
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-50">
                      <option value="">انتخاب زیرمنو</option>
                      {menuSubmenus.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-slate-600">ریزاقلام و مشخصات (سطح ۴)
                    <select value={subcategory} disabled={!submenu} onChange={e=>{setSubcategory(e.target.value);setFamilyCode('');setSku('')}}
                      className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-white p-3 disabled:opacity-50">
                      <option value="">تمام ریزاقلام زیرمنو</option>
                      {menuLeaves.map(item=><option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  {category&&currentCategory&&<div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/40 p-2.5 sm:col-span-2">
                    {currentCategory.image&&<ProductImage src={currentCategory.image} alt={currentCategory.name} className="h-12 w-14 rounded-md bg-white object-contain"/>}
                    <div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-slate-700">{currentCategory.name}</p>
                      <p className="text-[10px] text-slate-500">{fa(currentCategory.children?.length||0)} زیرمنو از فایل مصوب</p>
                    </div>
                  </div>}
                </div>
                {!taxonomy.assignmentsLoaded&&<p role="status" className="text-[11px] text-amber-700">ارتباط خانواده‌ها با دیتابیس بارگذاری نشد. {taxonomy.loadError||'در حال بارگذاری…'}؛ فهرست مجاز دسته‌ها همچنان قابل انتخاب است.</p>}
                
              </div>}
              {url&&<div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><h4 className="text-sm font-black text-[#55565A]">۲. خانواده کالا</h4><p className="mt-1 text-[10px] text-slate-500">افزودن و ویرایش نام، دسته‌بندی، تصویر و کدهای خانواده همین‌جا</p></div>
                  <div className="flex flex-wrap gap-2">
                    {family&&<button type="button" onClick={()=>onEditFamily(family.code,file,source==='upload'?'':url,title,selectedUpload||undefined)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-bold text-slate-700"><Edit3 size={13}/> ویرایش نام و تصویر خانواده</button>}
                    <button type="button" disabled={!category||!submenu} onClick={()=>onCreateFamily(file,currentCategory?.name||'',submenu,subcategory,source==='upload'?'':url,title,selectedUpload||undefined,
                    {categorySlug:category,submenu,leaf:subcategory})} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-[11px] font-bold text-[#C65A16] disabled:opacity-40">+ ساخت خانواده جدید</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button type="button" aria-pressed={!directMode} onClick={()=>{setDirectMode(false);setPlacement('family')}} className={!directMode?"rounded-xl border border-[#E06518] bg-orange-50 p-3 text-right text-xs font-bold text-slate-800":"rounded-xl border border-slate-200 p-3 text-right text-xs text-slate-600"}>دارای خانواده</button>
                  <button type="button" aria-pressed={directMode} onClick={()=>{setDirectMode(true);setFamilyCode('');setSku('');setPlacement('sku')}} className={directMode?"rounded-xl border border-[#E06518] bg-orange-50 p-3 text-right text-xs font-bold text-slate-800":"rounded-xl border border-slate-200 p-3 text-right text-xs text-slate-600"}>بدون خانواده · کد مستقیم زیرمنو</button>
                </div>
                {!directMode&&<label className="flex items-center gap-2 text-xs text-slate-600"><input type="checkbox" checked={searchAllFamilies} onChange={e=>setSearchAllFamilies(e.target.checked)}/> نمایش تمام خانواده‌ها (خارج از مسیر انتخاب‌شده نیز)</label>}
                {!directMode&&<input value={familySearch} onChange={e=>setFamilySearch(e.target.value)} placeholder="جستجو با نام یا کد خانواده…" className="w-full rounded-lg border border-slate-200 p-3 text-xs"/>}
                {!directMode&&<select aria-label="انتخاب خانواده کالا" value={familyCode} onChange={e=>chooseFamily(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white p-3 text-xs"><option value="">انتخاب خانواده</option>{families.map(p=><option key={p.code} value={p.code}>{p.name} — {p.code}</option>)}</select>}
                {directMode&&<p className="rounded-xl bg-orange-50 p-3 text-[11px] leading-6 text-orange-900">نیازی به ساخت خانواده نیست. کد معتبر را در گام بعد جستجو کنید؛ این ارتباط مستقیماً در زیرمنو ثبت می‌شود.</p>}
                {family&&!directMode&&category&&submenu&&<button type="button" onClick={()=>void saveSelectedPath(family.code).catch(error=>setSourceError(error instanceof Error?error.message:'ثبت مسیر ناموفق بود.'))}
                  className="w-full rounded-lg border border-orange-300 bg-white px-3 py-2 text-xs font-bold text-[#C65A16]">
                  ثبت یا اصلاح مسیر این خانواده در دیتابیس
                </button>}
                {family&&!directMode&&<div className="flex flex-wrap items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/50 p-2.5">
                  {(family.images?.[0]||family.galleryImages?.[0]?.url)&&<ProductImage src={family.images?.[0]||family.galleryImages?.[0]?.url} alt={family.name} className="h-16 w-16 rounded-lg bg-white object-contain"/>}
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold text-[#55565A]">{family.name}</p><p dir="ltr" className="text-[11px] text-slate-500">{family.code}</p><p className="text-[10px] text-slate-500">{fa(family.variants?.length||0)} کد کالا</p></div>
                  <button type="button" onClick={()=>onEditFamily(family.code,file,source==='upload'?'':url,title,selectedUpload||undefined)} className="rounded-lg bg-white px-3 py-2 text-[11px] font-bold text-[#C65A16]">مدیریت تصاویر</button>
                </div>}
                {!directMode&&<p className="mt-1 text-[11px] text-slate-500">{fa(families.length)} خانواده قابل انتخاب در این مسیر</p>}
              </div>}
              {url&&(family||directMode)&&<div className="space-y-3 rounded-xl border border-slate-200 p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-black text-[#55565A]">۳. {directMode?"انتخاب کد مستقیم":"محل اتصال تصویر"}</h4>{!directMode&&<button type="button" onClick={()=>{if(source==='upload'){setSourceError('ابتدا کد جدید را در خانواده ثبت کنید؛ سپس فایل را به آن متصل کنید.');return;}if(family)onCreateSku(family.code,file,url,title);closeSelection()}} className="rounded-lg border border-orange-200 px-3 py-2 text-[11px] font-bold text-[#C65A16]">+ افزودن کد کالا</button>}</div>
                {!directMode&&<div className="grid grid-cols-2 gap-2">
                  <button type="button" aria-pressed={placement==='family'} onClick={()=>{setPlacement('family');setSku('')}} className={placement==='family'?"rounded-xl border border-[#E06518] bg-[#FFF2E8] p-3 text-right":"rounded-xl border border-slate-200 p-3 text-right hover:bg-slate-50"}><strong className="block text-xs text-[#55565A]">تصویر خانواده</strong><span className="mt-1 block text-[10px] text-slate-500">برای همه مدل‌های خانواده</span></button>
                  <button type="button" aria-pressed={placement==='sku'} onClick={()=>setPlacement('sku')} className={placement==='sku'?"rounded-xl border border-[#E06518] bg-[#FFF2E8] p-3 text-right":"rounded-xl border border-slate-200 p-3 text-right hover:bg-slate-50"}><strong className="block text-xs text-[#55565A]">کد دقیق کالا</strong><span className="mt-1 block text-[10px] text-slate-500">فقط یک SKU مشخص</span></button>
                </div>}
                {(directMode||placement==='sku')&&<div className="space-y-3">
                  <label className="block text-xs font-bold text-[#55565A]">جستجو در کدهای کالا
                    <input type="search" value={skuSearch} onChange={e=>{setSkuSearch(e.target.value);setSku('')}} placeholder="کد، نام کالا، خانواده یا دسته‌بندی را جستجو کنید…" className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white p-3 font-normal outline-none focus:border-[#E06518]"/>
                  </label>
                  <p className="text-[10px] text-slate-500">{searchAllFamilies||directMode?'جستجو در همه خانواده‌ها':'نمایش کدهای خانواده انتخاب‌شده'} · {fa(allSkuChoices.length)} کد فعال؛ حداکثر ۳۰ نتیجه نمایش داده می‌شود.</p>
                  <div role="listbox" aria-multiselectable={!directMode} aria-label="نتایج جستجوی کد کالا" className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5">
                    {matchingSkus.map(choice=>{
                      const isSelected=directMode?sku===choice.variant.code:selectedSkuCodes.includes(choice.variant.code);
                      return <button key={choice.variant.code} type="button" role="option" aria-selected={isSelected} onClick={()=>{
                        if(directMode){setSku(choice.variant.code);setSkuSearch(choice.variant.code);}
                        else setSelectedSkuCodes(previous=>previous.includes(choice.variant.code)?previous.filter(code=>code!==choice.variant.code):[...previous,choice.variant.code]);
                      }} className={isSelected?"flex w-full items-center gap-3 rounded-lg border border-[#E06518] bg-[#FFF2E8] p-2.5 text-right":"flex w-full items-center gap-3 rounded-lg border border-transparent bg-white p-2.5 text-right hover:border-slate-200 hover:bg-slate-50"}>
                        {choice.imageUrl?<ProductImage src={choice.imageUrl} alt={choice.variant.name} className="h-12 w-12 shrink-0 rounded-md bg-white object-contain"/>:<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-slate-100"><FileImage size={17} className="text-slate-400"/></div>}
                        <span className="min-w-0 flex-1">
                          <span dir="ltr" className="block truncate text-xs font-black text-[#55565A]">{choice.variant.code}</span>
                          <span className="mt-0.5 block truncate text-[11px] text-slate-700">{choice.variant.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-slate-500">{choice.family.name} · {choice.family.categoryName}</span>
                        </span>
                        <span className={isSelected?"shrink-0 rounded-md bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700":"shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600"}>{directMode?'انتخاب کد مستقیم':isSelected?'انتخاب شده':'اتصال در خانواده فعلی'}</span>
                      </button>;
                    })}
                    {!matchingSkus.length&&<p className="px-3 py-6 text-center text-xs text-slate-500">کدی با این عبارت پیدا نشد؛ کد یا نام دیگری جستجو کنید.</p>}
                  </div>
                  {directMode&&selectedSkuChoice&&<div className="rounded-xl border border-slate-200 bg-white p-3">
                    <p dir="ltr" className="text-xs font-black text-[#55565A]">{selectedSkuChoice.variant.code}</p>
                    <p className="mt-1 text-xs text-slate-700">{selectedSkuChoice.variant.name}</p>
                    <p className="mt-1.5 text-[10px] leading-5 text-orange-700">این کد مستقیماً زیرمنوی مقصد را دریافت می‌کند؛ رکورد اصلی کالا و خانواده آن حذف یا جابه‌جا نمی‌شود.</p>
                  </div>}
                  {!directMode&&selectedSkuChoices.length>0&&<div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2"><p className="text-xs font-black text-emerald-900">{fa(selectedSkuChoices.length)} کد برای اتصال انتخاب شده</p><button type="button" onClick={()=>setSelectedSkuCodes([])} className="text-[10px] font-bold text-rose-700">پاک‌کردن انتخاب‌ها</button></div>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSkuChoices.map(choice=><button key={choice.variant.code} type="button" onClick={()=>setSelectedSkuCodes(previous=>previous.filter(code=>code!==choice.variant.code))} className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 py-1.5 text-[10px] text-emerald-900"><span dir="ltr" className="font-bold">{choice.variant.code}</span><X size={11}/></button>)}
                    </div>
                    <p className="mt-2 text-[10px] leading-5 text-emerald-800">هر کد در خانواده فعلی خودش متصل می‌شود؛ انتخاب کد از خانواده دیگر آن را جابه‌جا نمی‌کند.</p>
                  </div>}
                </div>}
              </div>}
              {url&&<p className="rounded-xl bg-amber-50 p-3 text-[11px] leading-6 text-amber-800">اتصال تصویر به‌تنهایی هویت فنی قطعه را تأیید نمی‌کند. مشخصات فنی کد کالا باید در فرم ویرایش همان محصول بررسی شود. فایل جدید تا ذخیره در فضای دائمی، آماده انتشار نیست.</p>}
              <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:justify-end">
                <button type="button" onClick={closeSelection} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-bold text-[#55565A]">انصراف</button>
                {url&&<button type="button" disabled={savingUpload||(!directMode&&!familyCode)||(directMode&&!directEditSku&&!sku)||(!directMode&&placement==='sku'&&!selectedSkuCodes.length)||(directMode&&(!category||!submenu))} onClick={()=>{void apply()}} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E06518] px-5 py-3 text-xs font-bold text-white hover:bg-[#c95814] disabled:cursor-not-allowed disabled:opacity-40"><Check size={16}/> {savingUpload?(directMode?(directEditSku?'در حال ذخیره ویرایش کد…':'در حال ثبت کد مستقیم…'):placement==='sku'?'در حال اتصال تصویر به کدها…':'در حال ذخیره روی سرور…'):directMode?(directEditSku?'ذخیره ویرایش مسیر کد مستقیم':'ثبت مستقیم کد در زیرمنو'):placement==='sku'?'اتصال تصویر به '+fa(selectedSkuCodes.length)+' کد کالا':source==='upload'?'ذخیره در Storage و اتصال به کالا':'ذخیره اتصال و ادامه تکمیل مشخصات'}</button>}
              </div>
            </div>
          </div>
        </div>
      </div>}
    </section>
  );
}
