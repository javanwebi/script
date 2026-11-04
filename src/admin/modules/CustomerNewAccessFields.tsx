import React from 'react';
import { Eye, EyeOff, KeyRound, RefreshCw, Send } from 'lucide-react';

// Draft credentials exist only in the browser until the contact is created.
// The API stores the password solely in Supabase Auth, never in CRM.
export type NewCustomerAccessDraft = {
  enabled:boolean;username:string;password:string;confirmedPhone:boolean;
  sendSms:boolean;messageTemplate:string;
};
export const welcomeSmsTemplate='صنعت پیش\n{smsName} عزیز، پنل شما فعال شد.\nنام کاربری: {username}\nرمز اولیه: {password}\nورود: {loginUrl}\nپس از اولین ورود رمز خود را تغییر دهید.';
export const welcomeSmsShort='صنعت پیش\nنام کاربری: {username}\nرمز اولیه: {password}\nورود: {loginUrl}';
export function randomCustomerPassword(){
  const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#%';
  const bytes=crypto.getRandomValues(new Uint32Array(18));
  return Array.from(bytes,n=>alphabet[n%alphabet.length]).join('');
}
export const emptyCustomerAccess=():NewCustomerAccessDraft=>({
  enabled:false,username:'',password:randomCustomerPassword(),
  confirmedPhone:false,sendSms:false,messageTemplate:welcomeSmsTemplate
});
const field='mt-1.5 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E56B1E]';
export function CustomerNewAccessFields({value,onChange,canManage,smsConfigured,customerName}:{
  value:NewCustomerAccessDraft;onChange:(next:NewCustomerAccessDraft)=>void;
  canManage:boolean;smsConfigured:boolean;customerName:string;
}){
  const [showPassword,setShowPassword]=React.useState(false);
  const [preset,setPreset]=React.useState<'formal'|'short'|'custom'>('formal');
  const change=(patch:Partial<NewCustomerAccessDraft>)=>onChange({...value,...patch});
  const preview=value.messageTemplate.replace(/\{(username|password|smsName|loginUrl)\}/g,(_match,key)=>
    ({username:value.username,password:value.password,smsName:customerName,loginUrl:'https://www.sanatpish.com/login'} as Record<string,string>)[key]||'');
  return <section className="mt-5 space-y-4 rounded-2xl border border-orange-200 bg-[#FFFAF6] p-4" aria-label="ساخت پنل ورود مشتری">
    <div className="flex items-center gap-2 text-sm font-black text-slate-800"><KeyRound className="h-5 w-5 text-[#E56B1E]"/>ساخت نام کاربری و رمز عبور مشتری</div>
    {canManage ? <>
      <label className="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
        <input type="checkbox" className="h-4 w-4 accent-[#E56B1E]" checked={value.enabled} onChange={e=>change({enabled:e.target.checked})}/>
        هم‌زمان با ثبت مشتری، پنل واقعی او ساخته شود
      </label>
      {value.enabled && <>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-bold text-slate-600">نام کاربری انگلیسی *
            <input className={field} dir="ltr" required autoComplete="off" pattern="[a-z][a-z0-9_]{3,31}" placeholder="customer_1234" value={value.username} onChange={e=>change({username:e.target.value.toLowerCase()})}/>
          </label>
          <label className="block text-xs font-bold text-slate-600">رمز عبور اولیه *
            <span className="mt-1.5 flex gap-1.5">
              <input className="h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm" dir="ltr" required autoComplete="new-password" type={showPassword?'text':'password'} minLength={12} maxLength={128} value={value.password} onChange={e=>change({password:e.target.value})}/>
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-2" title="نمایش یا مخفی کردن رمز" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff className="h-4 w-4"/>:<Eye className="h-4 w-4"/>}</button>
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-2" title="رمز تصادفی امن" onClick={()=>change({password:randomCustomerPassword()})}><RefreshCw className="h-4 w-4"/></button>
            </span>
          </label>
        </div>
        <p className="text-[11px] leading-6 text-amber-800">رمز موقت است و پس از اولین ورود باید تغییر کند. رمز خام در دیتابیس CRM ذخیره نمی‌شود.</p>
        <label className="flex cursor-pointer items-start gap-2 text-xs leading-6 text-slate-700">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#E56B1E]" required checked={value.confirmedPhone} onChange={e=>change({confirmedPhone:e.target.checked})}/>
          تأیید می‌کنم این شماره متعلق به مشتری است و اجازه ساخت حساب برای او را دارم.
        </label>
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800"><Send className="h-4 w-4 text-[#E56B1E]"/>اطلاعات پیامک مشتری</div>
            <span className="text-[11px] text-slate-500">{smsConfigured?'SMS.ir آماده':'ارسال پیامک هنوز فعال نیست'}</span>
          </div>
          <select className={field} value={preset} aria-label="انتخاب متن پیامک" onChange={e=>{
            const next=e.target.value as 'formal'|'short'|'custom';
            setPreset(next);
            if(next==='formal')change({messageTemplate:welcomeSmsTemplate});
            if(next==='short')change({messageTemplate:welcomeSmsShort});
          }}>
            <option value="formal">رسمی</option><option value="short">کوتاه</option><option value="custom">متن دلخواه</option>
          </select>
          <textarea rows={4} maxLength={800} className="w-full resize-y rounded-xl border border-slate-200 p-3 text-xs leading-6" value={value.messageTemplate} onChange={e=>{setPreset('custom');change({messageTemplate:e.target.value});}}/>
          <p className="text-[11px] leading-5 text-slate-500">متغیرها: {'{smsName}'}، {'{username}'}، {'{password}'}، {'{loginUrl}'}</p>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-50 p-3 font-sans text-xs leading-6" dir="rtl">{preview}</pre>
          <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-[#E56B1E]" disabled={!smsConfigured} checked={value.sendSms&&smsConfigured} onChange={e=>change({sendSms:e.target.checked})}/>
            ارسال پیامک پس از ساخت موفق حساب
          </label>
        </div>
      </>}
    </>:<p className="text-xs leading-6 text-slate-600">ساخت حساب ورود مخصوص مدیر اصلی است. مدیر مجاز پس از ذخیره مشتری می‌تواند از پرونده، نام کاربری و رمز تعیین کند.</p>}
  </section>;
}
