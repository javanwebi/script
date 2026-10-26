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
 return <section dir="rtl" className="space-y-4 rounded-2xl border border-orange-100 bg-white p-4 sm:p-6">
   <div><h3 className="text-lg font-black text-[#43474B]">کدهای کالای مستقیم این گروه</h3>
     <p className="mt-1 text-xs text-slate-500">قطعات کم‌تعداد بدون الزام به ساخت خانواده؛ تصویر، کد و مشخصات هر کالا جداگانه ثبت شده‌اند.</p></div>
   <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
     {items.map(item=><Link key={item.skuCode} to={'/direct-product/'+encodeURIComponent(item.skuCode)} className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-[#E06518] hover:shadow-sm">
       <div className="flex aspect-square items-center justify-center bg-slate-50 p-3">{item.imageUrl?<ProductImage src={item.imageUrl} alt={item.name} className="h-full w-full object-contain"/>:<ImageIcon className="text-slate-300" size={34}/>}</div>
       <div className="space-y-1.5 p-3">
         <div dir="ltr" className="text-[11px] font-black text-[#C35D19]">{item.skuCode}</div>
         <h4 className="line-clamp-2 min-h-10 text-xs font-bold text-slate-800">{item.name}</h4>
         <p className="truncate text-[10px] text-slate-500">{item.subcategory||item.submenu}</p>
         <p className="flex items-center gap-1 text-[11px] font-bold text-[#C35D19]">مشاهده مشخصات <ArrowUpLeft size={14}/></p>
       </div>
     </Link>)}
   </div>
 </section>;
}
