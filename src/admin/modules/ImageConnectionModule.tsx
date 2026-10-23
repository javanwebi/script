import React,{useCallback,useEffect,useState} from 'react';
import {ImagePlus,RefreshCw,ShieldCheck} from 'lucide-react';
import {ProductImageAudit} from './ProductImageAudit';
import {adminService} from '../../services/adminService';
import {subscribeCatalogChanges} from '../../data/mockGenerator';
import type {Category,Product} from '../../types';

export function ImageConnectionModule(){
  const [products,setProducts]=useState<Product[]>(()=>adminService.getProducts());
  const [categories,setCategories]=useState<Category[]>(()=>adminService.getCategories());
  const [savedAt,setSavedAt]=useState('');
  useEffect(()=>{
    const refresh=()=>{setProducts(adminService.getProducts());setCategories(adminService.getCategories());};
    const unsubscribe=subscribeCatalogChanges(refresh);
    window.addEventListener('atlas-categories-updated',refresh);
    window.addEventListener('atlas-catalog-updated',refresh);
    return ()=>{unsubscribe();window.removeEventListener('atlas-categories-updated',refresh);window.removeEventListener('atlas-catalog-updated',refresh);};
  },[]);
  const saveProduct=useCallback((product:Product)=>{
    adminService.saveProduct(product);
    setProducts(adminService.getProducts());
    setSavedAt(new Date().toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}));
  },[]);
  const saveCategory=useCallback((name:string,subcategory:string)=>{
    const cleanName=name.trim();
    if(!cleanName)return;
    const list=adminService.getCategories();
    const existing=list.find(c=>c.name.trim()===cleanName);
    const subs=[...new Set([...(existing?.subcategories||[]),subcategory.trim()].filter(Boolean))];
    const slug=(existing?.slug||cleanName).trim().toLowerCase().replace(/[\s\u200c]+/g,'-');
    const next:Category=existing
      ? {...existing,subcategories:subs}
      : {id:Date.now(),slug,name:cleanName,nameEn:'',description:'',subcategories:subs,icon:'Package',count:0,active:true};
    adminService.saveCategory(next);
    setCategories(adminService.getCategories());
    window.dispatchEvent(new CustomEvent('atlas-categories-updated'));
  },[]);
  const categoryOptions=categories.map(c=>({name:c.name,subcategories:c.subcategories||[]}));
  return <section dir="rtl" className="space-y-4">
    <header className="rounded-2xl border border-[#E7E8EA] bg-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        <span className="rounded-xl bg-[#FFF0E5] text-[#E06518] p-3"><ImagePlus size={22}/></span>
        <div><h2 className="text-lg font-black text-[#55565A]">تصاویر و اتصال کالا</h2><p className="mt-1 text-xs leading-6 text-slate-500">کتابخانه تصویر، دسته‌بندی، خانواده، کد SKU و مشخصات فنی را در یک میزکار مستقل مدیریت کنید.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]"><span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{products.length.toLocaleString('fa-IR')} خانواده در کاتالوگ</span><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700 flex items-center gap-1"><ShieldCheck size={12}/> ذخیره از مسیر مدیریت کاتالوگ</span>{savedAt&&<span role="status" className="text-emerald-700">آخرین ذخیره: {savedAt}</span>}</div>
        </div>
      </div>
      <button type="button" onClick={()=>{setProducts(adminService.getProducts());setCategories(adminService.getCategories());}} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-[#55565A] flex items-center justify-center gap-2"><RefreshCw size={14}/> تازه‌سازی اطلاعات</button>
    </header>
    <ProductImageAudit products={products} categories={categoryOptions} onSaveProduct={saveProduct} onCreateCategory={saveCategory}/>
  </section>;
}
