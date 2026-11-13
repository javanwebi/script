import React,{useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import {Image as ImageIcon,ArrowUpLeft} from 'lucide-react';
import {ProductImage} from '../product/ProductImage';

export type DirectSku={
 skuCode:string;name:string;categorySlug:string;categoryName:string;submenu:string;subcategory:string;
 brand:string;imageUrl:string|null;technicalSpecs:Array<{key:string;value:string}>;priceSnapshot:Record<string,unknown>;active:boolean;
};
export function useDirectSkus(){
 const [items,setItems]=useState<DirectSku[]>([]);
 useEffect(()=>{
   let alive=true;
   const refresh=()=>fetch('/api/catalog/direct-skus',{cache:'no-store'})
     .then(response=>response.ok?response.json():null)
     .then(data=>{if(alive&&data?.success&&Array.isArray(data.items))setItems(data.items)})
     .catch(()=>{/* Leave the existing family catalogue visible on a transient network failure. */});
   void refresh();
   window.addEventListener('catalog-direct-skus-updated',refresh);
   return ()=>{alive=false;window.removeEventListener('catalog-direct-skus-updated',refresh);};
 },[]);
 return items;
}
export function DirectSkuProducts({categorySlug,selectedSub='all'}:{categorySlug:string;selectedSub?:string}){
 const all=useDirectSkus();
 const items=useMemo(()=>all.filter(item=>item.categorySlug===categorySlug&&
   (selectedSub==='all'||selectedSub===item.submenu||selectedSub===item.subcategory)),[all,categorySlug,selectedSub]);
 if(!items.length)return null;
 return <section dir="rtl" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs">
   <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
     <div>
       <span className="text-[10px] font-black text-[#E06518]">ثبت مستقیم در زیرگروه</span>
       <h3 className="text-base sm:text-lg font-black text-[#373d43]">کدهای کالای مستقیم این گروه</h3>
       <p className="mt-1 text-xs text-slate-500">قطعات کم‌تعداد بدون الزام به ساخت خانواده؛ تصویر، کد و مشخصات هر کالا جداگانه ثبت شده‌اند.</p>
     </div>
     <span className="inline-flex items-center gap-1.5 rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-black text-[#c55817]">
       {items.length.toLocaleString('fa-IR')} کد مستقیم
     </span>
   </div>
   <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
     {items.map(item=><Link key={item.skuCode} to={'/direct-product/'+encodeURIComponent(item.skuCode)} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-all hover:-translate-y-0.5 hover:border-[#E06518] hover:shadow-md">
       <div className="relative flex aspect-[4/3] items-center justify-center bg-[#f8fafc] p-4 border-b border-slate-100">
         {item.imageUrl?<ProductImage src={item.imageUrl} alt={item.name} className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"/>:<ImageIcon className="text-slate-300" size={38}/>}
         {item.brand && (
           <span className="absolute top-2.5 right-2.5 rounded-lg border border-slate-200/80 bg-white/90 px-2 py-0.5 text-[10px] font-extrabold text-slate-700">
             {item.brand}
           </span>
         )}
       </div>
       <div className="flex flex-1 flex-col justify-between space-y-2.5 p-3.5">
         <div className="space-y-1.5">
           <div className="flex items-center justify-between gap-2">
             <span dir="ltr" className="rounded-md bg-orange-50 px-2 py-0.5 font-mono text-[11px] font-black text-[#C35D19]">{item.skuCode}</span>
             <span className="truncate text-[10px] font-semibold text-slate-500">{item.subcategory||item.submenu}</span>
           </div>
           <h4 className="line-clamp-2 min-h-10 text-xs font-extrabold text-slate-800 group-hover:text-[#E06518] transition-colors">{item.name}</h4>
           {item.technicalSpecs?.length > 0 && (
             <div className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-600 space-y-0.5">
               {item.technicalSpecs.slice(0, 2).map((spec, idx) => (
                 <div key={idx} className="flex items-center justify-between gap-2 truncate">
                   <span className="text-slate-400">{spec.key}:</span>
                   <strong className="font-bold text-slate-700 truncate">{spec.value}</strong>
                 </div>
               ))}
             </div>
           )}
         </div>
         <p className="flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-black text-[#C35D19]">
           <span>مشاهده مشخصات و استعلام</span>
           <ArrowUpLeft size={14} className="transition-transform group-hover:-translate-x-0.5" />
         </p>
       </div>
     </Link>)}
   </div>
 </section>;
}
