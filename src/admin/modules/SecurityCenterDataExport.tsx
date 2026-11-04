import React,{useState} from 'react';
import {Archive,Database,Download,HardDrive,ShieldAlert,ShieldCheck,LockKeyhole,Info,LoaderCircle} from 'lucide-react';
import {panel,primary,field,SectionTitle,securityApi} from './SecurityCenterShared';

export const SecurityCenterDataExport:React.FC=()=>{
 const [password,setPassword]=useState('');
 const [running,setRunning]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 async function authorize(e:React.FormEvent){
  e.preventDefault();
  if(running||!password)return;
  setRunning(true);setError('');setSuccess('');
  try{
   const v=await securityApi<{downloadUrl:string;expiresIn:number}>('/api/admin/security/export/authorize','POST',{password});
   setPassword('');
   // A native, same-origin attachment response streams directly to the browser.
   const link=document.createElement('a');
   link.href=v.downloadUrl;link.rel='noreferrer';document.body.append(link);link.click();link.remove();
   setSuccess('مجوز موقت دانلود صادر شد. تکمیل دانلود را در مرورگر بررسی کنید.');
  }catch(e){setError(e instanceof Error?e.message:'مجوز دریافت صادر نشد.');}
  finally{setPassword('');setRunning(false);}
 }
 return <div className="grid gap-5 lg:grid-cols-2">
  <section className={panel}>
   <SectionTitle icon={Archive} title="دریافت داده‌های پایگاه داده" subtitle="خروجی فشرده با تأیید دوباره هویت مدیر اصلی"/>
   <div className="space-y-3 text-xs leading-7 text-[#626B76]">
    <p>درخواست دانلود، داده‌های جدول‌های PostgreSQL قابل دسترسی به حساب سرور را در قالب NDJSON.gz صادر می‌کند؛ از جمله جدول‌های خصوصی و اطلاعات حساس.</p>
    <p className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 font-bold text-[#975524]">این خروجی ممکن است اطلاعات حساب‌ها و داده‌های محرمانه را شامل شود. فایل را فقط در محل رمزگذاری‌شده نگهداری کن.</p>
   </div>
   {error&&<p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
   {success&&<p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700">{success}</p>}
   <form onSubmit={e=>void authorize(e)} className="mt-5 space-y-3">
    <label className="block text-xs font-bold text-[#626B76]">رمز عبور فعلی مدیر اصلی
     <input className={'mt-2 '+field} type="password" minLength={1} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/>
    </label>
    <button className={primary} type="submit" disabled={!password||running}>
     {running?<LoaderCircle size={16} className="animate-spin"/>:<Download size={16}/>}
     {running?'در حال بررسی هویت…':'تأیید و آغاز دانلود'}
    </button>
   </form>
   <p className="mt-4 text-[11px] leading-6 text-slate-400">مجوز دانلود یک‌بارمصرف و کوتاه‌مدت است. بدون رمز جدید، لینک قابل استفاده مجدد نیست.</p>
  </section>
  <section className={panel}>
   <SectionTitle icon={HardDrive} title="پشتیبان قابل بازیابی" subtitle="برای بازگردانی کل سرویس، تنها خروجی داده‌ها کافی نیست"/>
   <div className="space-y-4">
    <div className="flex items-start gap-3 rounded-2xl bg-[#F8F9FA] p-4">
     <Database size={20} className="shrink-0 text-[#E56B1E]"/>
     <p className="text-xs leading-7 text-slate-600"><strong className="text-slate-800">PostgreSQL:</strong> بکاپ ساختار و داده‌ها، نقش‌های سرور و وضعیت توالی‌ها باید با ابزارهای استاندارد دیتابیس روی VPS تهیه و بازیابی آزمایشی شود.</p>
    </div>
    <div className="flex items-start gap-3 rounded-2xl bg-[#F8F9FA] p-4">
     <Archive size={20} className="shrink-0 text-[#E56B1E]"/>
     <p className="text-xs leading-7 text-slate-600"><strong className="text-slate-800">فایل‌های Storage:</strong> تصاویر واقعی کاتالوگ و پوشه‌های ذخیره‌سازی خارج از جدول‌های PostgreSQL هم به بکاپ جداگانه نیاز دارند.</p>
    </div>
    <div className="flex items-start gap-3 rounded-2xl bg-[#F4FBF7] p-4">
     <ShieldCheck size={20} className="shrink-0 text-emerald-600"/>
     <p className="text-xs leading-7 text-slate-700">در این صفحه هیچ دکمه‌ای برای ریست، پاک‌سازی یا بازنویسی داده‌های فعلی وجود ندارد.</p>
    </div>
   </div>
  </section>
 </div>;
};
