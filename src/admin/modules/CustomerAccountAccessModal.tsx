import React, { useEffect, useMemo, useState } from 'react';
import { KeyRound, Send, Copy, Eye, EyeOff, RefreshCw, LockKeyhole, ShieldCheck, X, Loader2 } from 'lucide-react';

export type CrmAccessCustomer = {
  id:string;name:string;phone:string|null;username?:string|null;approved_b2b:boolean;has_login:boolean;
};
type Config = { smsConfigured:boolean; loginUrl:string; defaultTemplate:string };
type Response = {success:boolean;username:string;phone:string;hasLogin:boolean;smsSent:boolean;smsWarning?:string;message:string};
const presetShort='صنعت پیش\nنام کاربری: {username}\nرمز اولیه: {password}\nلینک ورود: {loginUrl}\nلطفاً بعد از اولین ورود رمز را عوض کنید.';
const presetFormal='{smsName} گرامی\nحساب شما در سامانه صنعت پیش فعال گردید.\nنام کاربری: {username}\nرمز اولیه: {password}\nآدرس ورود: {loginUrl}\nخواهشمندیم در اولین ورود، رمز خود را تغییر دهید.';
const generatePassword=()=>{
 const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%';
 const values=crypto.getRandomValues(new Uint32Array(18));
 return Array.from(values,v=>chars[v%chars.length]).join('');
};
const input='h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E56B1E] focus:ring-2 focus:ring-orange-100';
async function getJSON(url:string,init?:RequestInit){
 const response=await fetch(url,{...init,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...(init?.headers||{})}});
 const result=await response.json().catch(()=>({success:false,message:'پاسخ سرور معتبر نیست.'}));
 if(!response.ok||!result.success)throw new Error(result.message||'درخواست ناموفق بود.');
 return result;
}
export const CustomerAccountAccessModal:React.FC<{
 customer:CrmAccessCustomer;onClose:()=>void;onSaved:()=>void;
}> = ({customer,onClose,onSaved})=>{
 const [config,setConfig]=useState<Config|null>(null);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [result,setResult]=useState<Response|null>(null);
 const [username,setUsername]=useState(customer.username || '');
 const [password,setPassword]=useState(()=>generatePassword());
 const [visible,setVisible]=useState(false);
 const [template,setTemplate]=useState(presetFormal);
 const [preset,setPreset]=useState<'formal'|'short'|'custom'>('formal');
 const [sendSms,setSendSms]=useState(false);
 const [confirmedPhone,setConfirmedPhone]=useState(false);
 const isReset=customer.has_login;
 useEffect(()=>{
  const controller=new AbortController();
  (async()=>{
   try{
    const data:Config=await getJSON('/api/admin/crm/credentials/config',{signal:controller.signal});
    if(controller.signal.aborted)return;
    setConfig(data);
   }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'اطلاعات سامانه دریافت نشد.');}
   finally{if(!controller.signal.aborted)setLoading(false);}
  })();
  return ()=>controller.abort();
 },[]);
 const smsText=useMemo(()=>{
  const url=config?.loginUrl||'https://www.sanatpish.com/login';
  return template.replace(/\{(smsName|username|password|loginUrl)\}/g,(_m,key)=>
   ({smsName:customer.name,username,password,loginUrl:url} as Record<string,string>)[key]||'');
 },[template,username,password,customer.name,config]);
 const choose=(p:'formal'|'short'|'custom')=>{
  setPreset(p);
  if(p==='formal')setTemplate(presetFormal);
  if(p==='short')setTemplate(presetShort);
 };
 const copy=async(value:string)=>{
  try{await navigator.clipboard.writeText(value);}
  catch{setError('کپی خودکار ممکن نیست؛ متن را انتخاب و کپی کنید.');}
 };
 const submit=async(e:React.FormEvent)=>{
  e.preventDefault();setError('');
  if(!confirmedPhone){setError('ابتدا تأیید کنید که شماره موبایل متعلق به مشتری است.');return;}
  if(!/^[a-z][a-z0-9_]{3,31}$/.test(username.trim().toLowerCase())){setError('نام کاربری باید ۴ تا ۳۲ نویسه انگلیسی و با حرف شروع شود.');return;}
  if(password.length<12){setError('رمز اولیه باید حداقل ۱۲ نویسه باشد.');return;}
  if(sendSms && (!template.includes('{username}')||!template.includes('{password}'))){
   setError('متن پیامک باید شامل {username} و {password} باشد.');return;
  }
  setBusy(true);
  try{
   const data:Response=await getJSON('/api/admin/crm/customers/'+encodeURIComponent(customer.id)+'/credentials',{
    method:'POST',body:JSON.stringify({
      operation:isReset?'reset':'create',username:username.trim().toLowerCase(),password,
      sendSms,messageTemplate:template
    })
   });
   setResult(data);
   onSaved();
  }catch(e){setError(e instanceof Error?e.message:'ایجاد حساب ممکن نشد.');}
  finally{setBusy(false);}
 };
 return <div dir="rtl" className="fixed inset-0 z-[130] flex items-center justify-center bg-[#18202B]/65 p-3" role="dialog" aria-modal="true" aria-label="مدیریت دسترسی مشتری">
  <div className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-[#F8F9FB] p-4 shadow-2xl sm:p-6">
   <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4">
    <div className="flex items-center gap-3">
     <div className="rounded-2xl bg-orange-100 p-3 text-[#E56B1E]"><KeyRound className="h-6 w-6"/></div>
     <div><h3 className="text-lg font-black text-slate-800">{isReset?'بازنشانی اطلاعات ورود':'ایجاد پنل واقعی مشتری'}</h3>
      <p className="mt-1 text-xs text-slate-500">{customer.name} · {customer.approved_b2b?'پنل خرید بالا':'پنل خرید تکی'}</p>
     </div>
    </div>
    <button type="button" aria-label="بستن" onClick={onClose} className="rounded-xl border border-slate-200 bg-white p-2"><X className="h-5 w-5"/></button>
   </div>
   {loading?<div className="flex items-center gap-2 py-12 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin"/>بررسی اتصال سامانه ورود...</div>:
    result? <div className="space-y-4 py-5">
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
       <ShieldCheck className="ml-2 inline h-5 w-5"/>{result.message}
       {result.smsSent&&<p className="mt-2 font-bold">درخواست پیامک توسط SMS.ir پذیرفته شد؛ تحویل قطعی نیازمند گزارش اپراتور است.</p>}
       {result.smsWarning&&<p className="mt-2 text-amber-800">{result.smsWarning}</p>}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
       <div>نام کاربری: <b className="select-all" dir="ltr">{username}</b></div>
       <div className="mt-3">رمز اولیه (فقط در همین صفحه): <b className="select-all" dir="ltr">{password}</b></div>
       <p className="mt-2 text-xs leading-6 text-slate-500">این رمز در CRM ذخیره نشده و پس از بستن پنجره قابل بازیابی نیست. مشتری در اولین ورود باید آن را تغییر دهد.</p>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
       <div className="mb-2 text-xs font-bold text-slate-600">متن قابل تحویل به مشتری</div>
       <pre dir="rtl" className="whitespace-pre-wrap break-words font-sans text-sm leading-7">{smsText}</pre>
       <button type="button" onClick={()=>void copy(smsText)} className="mt-3 flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-xs font-bold text-orange-700"><Copy className="h-4 w-4"/>کپی متن</button>
      </div>
      <button type="button" onClick={onClose} className="w-full rounded-xl bg-[#E56B1E] px-4 py-3 text-sm font-bold text-white">پایان</button>
    </div>:<form onSubmit={submit} className="space-y-4 pt-5">
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
       شماره گیرنده: <b className="ml-2 text-slate-900" dir="ltr">{customer.phone||'ثبت نشده'}</b>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
       <label className="space-y-1.5 text-xs font-bold text-slate-700">نام کاربری
        <input required className={input+' mt-2'} dir="ltr" autoComplete="off" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} placeholder="factory_customer01" pattern="[a-z][a-z0-9_]{3,31}"/>
       </label>
       <label className="space-y-1.5 text-xs font-bold text-slate-700">رمز عبور اولیه
        <div className="mt-2 flex gap-2">
         <input required className={input+' min-w-0 flex-1'} dir="ltr" type={visible?'text':'password'} minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/>
         <button type="button" onClick={()=>setVisible(v=>!v)} title={visible?'مخفی کردن':'نمایش رمز'} className="rounded-xl border border-slate-200 bg-white p-2.5">{visible?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button>
         <button type="button" onClick={()=>setPassword(generatePassword())} title="تولید رمز امن" className="rounded-xl border border-slate-200 bg-white p-2.5"><RefreshCw className="h-5 w-5"/></button>
        </div>
       </label>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
       <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800"><Send className="h-4 w-4 text-[#E56B1E]"/>پیامک اطلاعات ورود</div>
        <span className={'rounded-full px-2.5 py-1 text-[11px] font-bold '+(config?.smsConfigured?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>
         {config?.smsConfigured?'SMS.ir آماده ارسال':'ارسال پیامک هنوز متصل نیست'}</span>
       </div>
       <label className="mb-2 block text-xs font-bold text-slate-600">انتخاب متن پیامک
        <select className={input+' mt-2'} value={preset} onChange={e=>choose(e.target.value as 'formal'|'short'|'custom')}>
         <option value="formal">متن رسمی</option><option value="short">متن کوتاه</option><option value="custom">متن دلخواه</option>
        </select>
       </label>
       <textarea rows={5} value={template} onChange={e=>{setPreset('custom');setTemplate(e.target.value);}} className="w-full resize-y rounded-xl border border-slate-200 p-3 text-xs leading-6 outline-none focus:border-[#E56B1E]"/>
       <p className="mt-2 text-[11px] leading-6 text-slate-500">متغیرهای مجاز: {'{smsName}'}، {'{username}'}، {'{password}'} و {'{loginUrl}'}.</p>
       <div className="mt-3 rounded-xl bg-[#F8F9FB] p-3">
        <span className="text-[11px] font-bold text-slate-600">پیش‌نمایش متن نهایی</span>
        <pre dir="rtl" className="mt-2 whitespace-pre-wrap break-words font-sans text-xs leading-6 text-slate-700">{smsText}</pre>
       </div>
       <label className="mt-4 flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
        <input type="checkbox" checked={sendSms} disabled={!config?.smsConfigured} onChange={e=>setSendSms(e.target.checked)} className="h-4 w-4 accent-[#E56B1E]"/>
        ارسال پیامک به شماره ثبت‌شده هم‌زمان با {isReset?'بازنشانی':'ساخت حساب'}
       </label>
       <p className="mt-2 text-[11px] leading-5 text-amber-700">ارسال رمز در پیامک امنیت کمتری از لینک تنظیم رمز دارد؛ این رمز اولیه است و تغییر آن در اولین ورود الزامی خواهد بود.</p>
      </div>
      <label className="flex items-start gap-2 text-xs leading-6 text-slate-700">
       <input required type="checkbox" checked={confirmedPhone} onChange={e=>setConfirmedPhone(e.target.checked)} className="mt-1 h-4 w-4 accent-[#E56B1E]"/>
       تأیید می‌کنم شماره ثبت‌شده متعلق به این مشتری است و مجوز ایجاد یا بازنشانی حساب او را دارم.
      </label>
      {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2">
       <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm">انصراف</button>
       <button type="submit" disabled={busy||!confirmedPhone||!customer.phone} className="flex items-center gap-2 rounded-xl bg-[#E56B1E] px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
        {busy?<Loader2 className="h-4 w-4 animate-spin"/>:<LockKeyhole className="h-4 w-4"/>}
        {busy?'در حال ثبت امن...':isReset?'بازنشانی رمز مشتری':'ساخت حساب و فعال‌سازی پنل'}
       </button>
      </div>
    </form>}
  </div>
 </div>;
};
