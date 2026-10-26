import React from 'react';
import {Link,useParams} from 'react-router-dom';
import {ArrowRight,Image as ImageIcon} from 'lucide-react';
import {ProductImage} from '../components/product/ProductImage';
import {useDirectSkus} from '../components/catalog/DirectSkuProducts';
export default function DirectSkuDetailPage(){
 const {code}=useParams<{code:string}>();
 const items=useDirectSkus();
 const item=items.find(row=>row.skuCode===code);
 if(!item)return <main dir="rtl" className="mx-auto max-w-5xl space-y-4 px-5 py-16 text-right"><h1 className="text-xl font-black text-slate-800">کد کالا در حال بارگذاری است یا پیدا نشد.</h1><Link to="/products" className="text-[#E06518]">بازگشت به کالاها</Link></main>;
 return <main dir="rtl" className="mx-auto max-w-6xl space-y-6 px-4 py-12">
  <Link className="inline-flex items-center gap-2 text-xs font-bold text-[#E06518]" to={'/category/'+encodeURIComponent(item.categorySlug)+'?sub='+encodeURIComponent(item.submenu)}><ArrowRight size={15}/> بازگشت به دسته {item.categoryName}</Link>
  <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-8 md:grid-cols-2">
   <div className="flex min-h-64 items-center justify-center rounded-xl bg-slate-50">{item.imageUrl?<ProductImage src={item.imageUrl} alt={item.name} className="h-full max-h-96 w-full object-contain p-5"/>:<ImageIcon size={54} className="text-slate-300"/>}</div>
   <div className="space-y-4 text-right">
     <h1 className="text-xl font-black text-slate-800 md:text-2xl">{item.name}</h1>
     <p dir="ltr" className="text-lg font-black text-[#C45D15]">{item.skuCode}</p>
     <p className="text-xs text-slate-600">{item.categoryName} / {item.submenu}{item.subcategory?' / '+item.subcategory:''}</p>
     {item.brand&&<p className="text-xs text-slate-600">برند: {item.brand}</p>}
     <p className="rounded-xl bg-orange-50 p-3 text-xs leading-6 text-slate-700">این قطعه مستقیماً زیر گروه فنی ثبت شده است و نیازی به خانواده کالایی ندارد. برای استعلام قیمت و موجودی با پشتیبانی صنعت پیش تماس بگیرید.</p>
     {!!item.technicalSpecs?.length&&<div className="overflow-hidden rounded-xl border border-slate-200"><h2 className="border-b border-slate-200 bg-slate-50 p-3 text-sm font-black">مشخصات فنی</h2>{item.technicalSpecs.map((spec,i)=><div key={i} className="grid grid-cols-2 gap-3 border-b border-slate-100 p-3 text-xs"><span className="text-slate-500">{spec.key}</span><span className="font-bold text-slate-800">{spec.value}</span></div>)}</div>}
   </div>
  </div>
 </main>;
}
