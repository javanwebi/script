import React,{useEffect,useState} from 'react';
import {CreditCard,MessageSquare,Truck,Globe2,Save,LoaderCircle,ShieldCheck,Database,AlertCircle} from 'lucide-react';
import {field,panel,primary,secondary,SectionTitle,securityApi,SecuritySettings,SecurityTab} from './SecurityCenterShared';

type Editable='payments'|'messaging'|'shipping'|'website';
type Props={tab:Editable;settings:SecuritySettings|null;onSaved:(v:SecuritySettings)=>void;notify:(message:string,failed?:boolean)=>void};
export const SecurityCenterConfig:React.FC<Props>=({tab,settings,onSaved,notify})=>{
 const [draft,setDraft]=useState<SecuritySettings|null>(settings);
 const [saving,setSaving]=useState(false);
 useEffect(()=>{setDraft(settings);},[settings?.updatedAt,settings?.id]);
 async function createBase(){
  setSaving(true);
  try{const v=await securityApi<{settings:SecuritySettings}>('/api/admin/security/settings/initialize','POST');
   onSaved(v.settings);notify('سند تنظیمات پایه در دیتابیس بررسی و آماده شد.');}
  catch(e){notify(e instanceof Error?e.message:'خطا در ایجاد سند تنظیمات',true);}
  finally{setSaving(false);}
 }
 async function save(section:string,payload:unknown){
  if(!draft||saving)return;
  setSaving(true);
  try{
   const v=await securityApi<{settings:SecuritySettings}>('/api/admin/security/settings','PUT',{
    section,data:payload,expectedUpdatedAt:draft.updatedAt
   });
   onSaved(v.settings);notify('تنظیمات در PostgreSQL ذخیره شد.');
  }catch(e){notify(e instanceof Error?e.message:'ذخیره انجام نشد',true);}
  finally{setSaving(false);}
 }
 const changed=(update:(v:SecuritySettings)=>SecuritySettings)=>setDraft(prev=>prev?update(prev):prev);
 if(!draft)return <section className={panel}><SectionTitle icon={Database} title="سند تنظیمات عمومی موجود نیست" subtitle="برای جلوگیری از ساخت داده نمایشی، فقط یک سند پایه بدون اطلاعات محرمانه ایجاد می‌شود."/>
  <button className={primary} disabled={saving} onClick={()=>void createBase()}>{saving?'در حال بررسی...':'ایجاد امن سند تنظیمات پایه'}</button></section>;
 const payment=draft.paymentGateway,shipping=draft.shippingMethods,seo=draft.seo;
 return <div className="space-y-5">
 {tab==='payments'&&<section className={panel}>
  <SectionTitle icon={CreditCard} title="درگاه‌های پرداخت" subtitle="پیکربندی ثبت‌شده در دیتابیس؛ اتصال واقعی هر بانک نیازمند API همان درگاه است."/>
  <div className="grid gap-4 md:grid-cols-2">
   <label className="text-xs font-bold text-slate-600">درگاه پیش‌فرض
    <select className={'mt-2 '+field} value={payment.provider} onChange={e=>changed(v=>({...v,paymentGateway:{...v.paymentGateway,provider:e.target.value as typeof payment.provider}}))}>
     <option value="mellat">به‌پرداخت ملت</option><option value="saman">سامان (SEP)</option><option value="zarinpal">زرین‌پال</option>
    </select></label>
   <label className="text-xs font-bold text-slate-600">شناسه پذیرنده
    <input dir="ltr" className={'mt-2 '+field} maxLength={120} value={payment.merchantId} onChange={e=>changed(v=>({...v,paymentGateway:{...v.paymentGateway,merchantId:e.target.value}}))}/></label>
   <label className="text-xs font-bold text-slate-600">شماره ترمینال
    <input dir="ltr" className={'mt-2 '+field} maxLength={120} value={payment.terminalId} onChange={e=>changed(v=>({...v,paymentGateway:{...v.paymentGateway,terminalId:e.target.value}}))}/></label>
   <label className="flex items-center gap-3 rounded-xl border border-slate-100 bg-[#FAFBFC] p-4 text-xs font-bold text-slate-600">
    <input type="checkbox" className="h-5 w-5 accent-[#E56B1E]" checked={payment.sandbox} onChange={e=>changed(v=>({...v,paymentGateway:{...v.paymentGateway,sandbox:e.target.checked}}))}/> حالت آزمایشی
   </label>
  </div>
  <button className={'mt-5 '+primary} disabled={saving} onClick={()=>void save('payment',payment)}><Save size={16}/> ذخیره تغییرات پرداخت</button>
 </section>}
 {tab==='messaging'&&<section className={panel}>
  <SectionTitle icon={MessageSquare} title="پیامک و سرویس OTP" subtitle="وضعیت ارائه‌دهنده واقعی؛ کلید API از سرور به مرورگر منتقل نمی‌شود."/>
  <div className="grid gap-3 sm:grid-cols-2">
   <div className="rounded-2xl bg-[#F8F9FA] p-4 text-xs"><p className="text-slate-400">ارائه‌دهنده</p><strong className="mt-2 block text-sm text-slate-700">{draft.smsProvider.provider==='smsir'?'SMS.ir':'کاوه‌نگار'}</strong></div>
   <div className="rounded-2xl bg-[#F8F9FA] p-4 text-xs"><p className="text-slate-400">وضعیت سرور</p><strong className={'mt-2 block text-sm '+(draft.smsProvider.ready?'text-emerald-700':'text-amber-700')}>{draft.smsProvider.ready?'پیکربندی آماده است':'نیاز به تنظیمات سرور دارد'}</strong></div>
  </div>
  <label className="mt-5 block text-xs font-bold text-slate-600">سرشماره ثبت‌شده
   <input dir="ltr" className={'mt-2 '+field} maxLength={32} value={draft.smsProvider.senderNumber} onChange={e=>changed(v=>({...v,smsProvider:{...v.smsProvider,senderNumber:e.target.value}}))}/></label>
  <p className="mt-3 text-xs leading-6 text-slate-500">ارسال تست نمایشی حذف شده است. تست واقعی OTP باید از مسیر احراز هویت و سرویس پیامک انجام شود.</p>
  <button className={'mt-5 '+primary} disabled={saving} onClick={()=>void save('sms',{senderNumber:draft.smsProvider.senderNumber})}><Save size={16}/> ذخیره سرشماره</button>
 </section>}
 {tab==='shipping'&&<section className={panel}>
  <SectionTitle icon={Truck} title="ارسال و لجستیک" subtitle="روش‌های ثبت‌شده در تنظیمات مرکزی فروشگاه"/>
  <div className="grid gap-3 sm:grid-cols-2">
   {([['barbari','باربری'],['tipax','تیپاکس'],['expressPost','پست پیشتاز'],['dedicatedFleet','ناوگان اختصاصی']] as const).map(([id,label])=>
    <label key={id} className="flex cursor-pointer items-center justify-between rounded-xl border border-slate-200 p-4 text-sm font-bold text-slate-600">{label}
     <input type="checkbox" className="h-5 w-5 accent-[#E56B1E]" checked={shipping[id]} onChange={e=>changed(v=>({...v,shippingMethods:{...v.shippingMethods,[id]:e.target.checked}}))}/>
    </label>)}
  </div>
  <button className={'mt-5 '+primary} disabled={saving} onClick={()=>void save('shipping',shipping)}><Save size={16}/> ذخیره روش‌های ارسال</button>
 </section>}
 {tab==='website'&&<section className={panel}>
  <SectionTitle icon={Globe2} title="هویت، سئو و تنظیمات عمومی" subtitle="تنظیمات ذخیره‌شده در جدول system_settings"/>
  <div className="grid gap-4 lg:grid-cols-2">
   {([['metaTitle','عنوان صفحه'],['metaDescription','توضیحات سئو'],['keywords','کلیدواژه‌ها'],['canonicalBase','آدرس کانونیکال HTTPS']] as const).map(([id,label])=>
    <label key={id} className="text-xs font-bold text-slate-600">{label}
     <textarea rows={2} maxLength={id==='metaTitle'?160:500} className={'mt-2 '+field} dir={id==='canonicalBase'?'ltr':'rtl'} value={seo[id]} onChange={e=>changed(v=>({...v,seo:{...v.seo,[id]:e.target.value}}))}/>
    </label>)}
  </div>
  <div className="mt-5 flex flex-wrap items-center gap-3">
   <button className={primary} disabled={saving} onClick={()=>void save('seo',seo)}><Save size={16}/> ذخیره سئو</button>
   <label className="text-xs font-bold text-slate-600">واحد پول
    <select className={'mt-2 '+field} value={draft.currency} onChange={e=>changed(v=>({...v,currency:e.target.value as SecuritySettings['currency']}))}>
     <option value="toman">تومان</option><option value="rial">ریال</option>
    </select></label>
   <button className={secondary} disabled={saving} onClick={()=>void save('currency',{currency:draft.currency})}>ذخیره واحد پول</button>
  </div>
  <p className="mt-4 text-xs leading-6 text-slate-400">ذخیره این تنظیمات به‌تنهایی مسیر پرداخت، روش محاسبه حمل و متاتگ‌های فعلی سایت را تغییر نمی‌دهد؛ اتصال مصرف‌کننده باید جداگانه آزموده شود.</p>
 </section>}
 </div>;
};
