import React, { useEffect, useState } from 'react';
import { Wallet, X, Loader2, Save } from 'lucide-react';

type Option = { id?:string; name?:string; currency?:string; grade_code?:string; title?:string; discount_percent?:number };
type Subject = { id:string; grade_code:string|null; assigned_price_list_id:string|null; credit_limit:string|number|null; credit_used:string|number|null; approved_b2b:boolean; name:string };
type Props = { customer:Subject; onClose:()=>void; onSaved:()=>void };
export const RealCrmCommercialEditor:React.FC<Props> = ({customer,onClose,onSaved}) => {
  const [grades,setGrades]=useState<Option[]>([]);
  const [prices,setPrices]=useState<Option[]>([]);
  const [grade,setGrade]=useState(customer.grade_code||'');
  const [price,setPrice]=useState(customer.assigned_price_list_id||'');
  const [limit,setLimit]=useState(String(customer.credit_limit??0));
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    const controller=new AbortController();
    const load=async()=>{
      try{
        const response=await fetch('/api/admin/crm/commercial-options',{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        const data=await response.json().catch(()=>({success:false,message:'پاسخ سرور نامعتبر است.'}));
        if(!response.ok||!data.success)throw new Error(data.message||'دسترسی به گریدبندی ممکن نشد.');
        setGrades(data.grades||[]);setPrices(data.priceLists||[]);
      }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'خطای اتصال');}
      finally{if(!controller.signal.aborted)setLoading(false);}
    };
    void load();
    return ()=>controller.abort();
  },[]);
  const submit=async(e:React.FormEvent)=>{
    e.preventDefault();
    const numeric=Number(limit);
    if(!Number.isSafeInteger(numeric)||numeric<0){setError('سقف اعتبار باید عدد صحیح غیرمنفی باشد.');return;}
    if(numeric<Number(customer.credit_used||0)){setError('سقف اعتبار کمتر از میزان مصرف‌شده است.');return;}
    try{
      setBusy(true);setError('');
      const response=await fetch('/api/admin/crm/customers/'+encodeURIComponent(customer.id)+'/commercial',{
        method:'PATCH',credentials:'same-origin',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({grade_code:grade||null,assigned_price_list_id:price||null,credit_limit:numeric})});
      const result=await response.json().catch(()=>({success:false,message:'پاسخ سرور نامعتبر است.'}));
      if(!response.ok||!result.success)throw new Error(result.message||'تغییرات ذخیره نشد.');
      onSaved();
    }catch(e){setError(e instanceof Error?e.message:'ذخیره ناموفق بود.');}
    finally{setBusy(false);}
  };
  return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 p-3" dir="rtl" role="dialog" aria-modal="true">
    <form onSubmit={submit} className="max-h-[95dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
      <div className="flex justify-between gap-3 border-b border-slate-100 pb-4">
        <div><div className="flex items-center gap-2"><Wallet className="h-5 w-5 text-[#E56B1E]"/><h3 className="font-black text-slate-800">گرید، قیمت‌نامه و اعتبار</h3></div>
          <p className="mt-2 text-xs text-slate-500">{customer.name} · اطلاعات واقعی دیتابیس</p></div>
        <button type="button" onClick={onClose} aria-label="بستن"><X className="h-5 w-5"/></button>
      </div>
      {loading?<div className="flex items-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/>دریافت قیمت‌نامه‌های فعال...</div>:<>
        <div className="mt-5 space-y-4">
          <label className="block space-y-1.5 text-xs font-bold text-slate-600">گرید مشتری
            <select className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={grade} onChange={e=>setGrade(e.target.value)}>
              <option value="">بدون گرید</option>{grades.map(g=><option key={g.grade_code} value={g.grade_code}>{g.title||g.grade_code}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs font-bold text-slate-600">قیمت‌نامه اختصاص‌یافته
            <select className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm" value={price} onChange={e=>setPrice(e.target.value)}>
              <option value="">بدون قیمت‌نامه</option>{prices.map(p=><option key={p.id} value={p.id}>{p.name||p.id}</option>)}
            </select>
          </label>
          <label className="block space-y-1.5 text-xs font-bold text-slate-600">سقف اعتبار ثبت‌شده (تومان)
            <input className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm" type="number" min="0" step="1" required value={limit} onChange={e=>setLimit(e.target.value)}/>
          </label>
        </div>
        <p className="mt-3 text-xs leading-6 text-slate-500">این تغییر فقط سقف مجاز و شرایط تجاری را تنظیم می‌کند؛ اعتبار مصرف‌شده، بدهی و مبلغ خرید دست‌کاری نمی‌شوند.</p>
      </>}
      {error&&<div role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm">انصراف</button>
        <button disabled={busy||loading||!customer.approved_b2b} className="flex items-center gap-2 rounded-xl bg-[#E56B1E] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>{busy?'در حال ذخیره...':'ذخیره شرایط تجاری'}</button>
      </div>
    </form>
  </div>;
};
