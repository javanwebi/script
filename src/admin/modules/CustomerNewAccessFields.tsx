import React, { useEffect, useMemo, useState } from 'react';
import {
  Check, CheckCircle2, ChevronDown, Copy, Eye, EyeOff, KeyRound, LoaderCircle,
  LockKeyhole, MessageSquarePlus, MessageSquareText, Pencil, RefreshCw, Save,
  Send, ShieldCheck, Sparkles, WandSparkles, X
} from 'lucide-react';

// Temporary passwords exist only in browser memory until sent directly to Supabase Auth.
export type NewCustomerAccessDraft = {
  enabled:boolean; username:string; password:string; confirmedPhone:boolean;
  sendSms:boolean; messageTemplate:string;
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
type SmsTemplate = {id:string;event_key:string;title:string;text:string;updated_at?:string};
type Editor = {id:string|null;title:string;text:string};
const builtIn:SmsTemplate[]=[
  {id:'builtin-formal',event_key:'crm_credentials',title:'خوشامدگویی رسمی',text:welcomeSmsTemplate},
  {id:'builtin-short',event_key:'crm_credentials',title:'اطلاعات ورود کوتاه',text:welcomeSmsShort}
];
const control='w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-[#E56B1E] focus:ring-4 focus:ring-orange-100';
const safeText=(text:string, values:Record<string,string>)=>text.replace(/\{(smsName|username|password|loginUrl)\}/g,(_,token:string)=>values[token]||'');
function generateUsername(){
  const digits=Array.from(crypto.getRandomValues(new Uint8Array(5)),n=>String(n%10)).join('');
  return 'sp_'+digits;
}
export function CustomerNewAccessFields({value,onChange,canManage,smsConfigured,customerName}:{
  value:NewCustomerAccessDraft;onChange:(next:NewCustomerAccessDraft)=>void;
  canManage:boolean;smsConfigured:boolean;customerName:string;
}){
  const [showPassword,setShowPassword]=useState(false);
  const [selected,setSelected]=useState('builtin-formal');
  const [stored,setStored]=useState<SmsTemplate[]>([]);
  const [loading,setLoading]=useState(false);
  const [editor,setEditor]=useState<Editor|null>(null);
  const [saving,setSaving]=useState(false);
  const [templateError,setTemplateError]=useState('');
  const [templateNotice,setTemplateNotice]=useState('');
  const [smsExpanded,setSmsExpanded]=useState(false);
  const [copyDone,setCopyDone]=useState(false);
  const change=(patch:Partial<NewCustomerAccessDraft>)=>onChange({...value,...patch});
  const templates=useMemo(()=>[...builtIn,...stored], [stored]);
  const chosen=templates.find(item=>item.id===selected);
  const preview=safeText(value.messageTemplate,{
    username:value.username||'نام کاربری',password:value.password||'رمز اولیه',
    smsName:customerName||'مشتری',loginUrl:'https://www.sanatpish.com/login'
  });
  const readyToSend=value.messageTemplate.includes('{username}')&&value.messageTemplate.includes('{password}')
    &&!/[{][^{}]+[}]/.test(preview);
  const passwordScore=[
    value.password.length>=12,
    /[a-z]/.test(value.password)&&/[A-Z]/.test(value.password),
    /[0-9]/.test(value.password),
    /[^a-zA-Z0-9]/.test(value.password)
  ].filter(Boolean).length;
  useEffect(()=>{
    if(!canManage)return;
    const ctrl=new AbortController();
    setLoading(true);
    fetch('/api/admin/crm/credentials/templates',{credentials:'same-origin',cache:'no-store',signal:ctrl.signal})
      .then(async response=>{
        const json=await response.json();
        if(!response.ok||!json.success)throw new Error(json.message||'قالب‌ها دریافت نشدند.');
        if(!ctrl.signal.aborted)setStored(Array.isArray(json.templates)?json.templates:[]);
      })
      .catch(error=>{if(!ctrl.signal.aborted)setTemplateError(error instanceof Error?error.message:'خطا در دریافت قالب‌ها');})
      .finally(()=>{if(!ctrl.signal.aborted)setLoading(false);});
    return ()=>ctrl.abort();
  },[canManage]);
  const selectTemplate=(id:string)=>{
    setSelected(id);setTemplateNotice('');setTemplateError('');
    const found=templates.find(template=>template.id===id);
    if(found)change({messageTemplate:found.text,sendSms:false});
  };
  const saveTemplate=async()=>{
    if(!editor)return;
    const title=editor.title.trim(),text=editor.text.trim();
    if(title.length<3||text.length<15){setTemplateError('عنوان حداقل ۳ و متن حداقل ۱۵ نویسه باشد.');return;}
    setSaving(true);setTemplateError('');setTemplateNotice('');
    try{
      const updating=Boolean(editor.id);
      const response=await fetch('/api/admin/crm/credentials/templates'+(updating?'/'+encodeURIComponent(editor.id!):''),{
        method:updating?'PUT':'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({title,text})
      });
      const json=await response.json().catch(()=>({success:false,message:'پاسخ سرور معتبر نیست.'}));
      if(!response.ok||!json.success)throw new Error(json.message||'ذخیره قالب ممکن نشد.');
      const item=json.template as SmsTemplate;
      setStored(previous=>[item,...previous.filter(old=>old.id!==item.id)]);
      setSelected(item.id);change({messageTemplate:item.text,sendSms:false});
      setEditor(null);setTemplateNotice(updating?'قالب پیام ویرایش شد.':'قالب جدید در دیتابیس ذخیره شد.');
    }catch(error){setTemplateError(error instanceof Error?error.message:'ثبت قالب انجام نشد.');}
    finally{setSaving(false);}
  };
  const switchOn=(enabled:boolean)=>{
    change({enabled,sendSms:enabled?value.sendSms:false});
    if(enabled&&!value.username)change({enabled,username:generateUsername()});
  };
  return <section aria-label="دسترسی مشتری و مرکز پیام" className="space-y-5">
    <div className={'relative overflow-hidden rounded-[26px] border p-4 transition-all duration-300 sm:p-5 '+(value.enabled?'border-[#F2C5A1] bg-gradient-to-br from-[#FFF5EC] via-white to-white shadow-[0_14px_38px_rgba(229,107,30,.08)]':'border-slate-200 bg-white')}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={'rounded-2xl p-3 '+(value.enabled?'bg-[#E56B1E] text-white':'bg-slate-100 text-slate-500')}><LockKeyhole className="h-5 w-5"/></div>
          <div><h4 className="font-black text-slate-800">ساخت حساب ورود واقعی</h4>
            <p className="mt-1 text-xs leading-5 text-slate-500">نام کاربری و رمز اختصاصی در Supabase Auth ثبت می‌شوند.</p></div>
        </div>
        {canManage&&<button type="button" role="switch" aria-checked={value.enabled} onClick={()=>switchOn(!value.enabled)}
          className={'relative h-8 w-14 shrink-0 rounded-full transition-colors '+(value.enabled?'bg-[#E56B1E]':'bg-slate-300')}
          aria-label="ساخت هم‌زمان حساب ورود"><span className={'absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all '+(value.enabled?'right-7':'right-1')}/></button>}
      </div>
      {!canManage&&<p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">ساخت حساب و مدیریت رمز فقط برای مدیر اصلی فعال است؛ مشتری بدون حساب ورود قابل ثبت است.</p>}
      {canManage&&!value.enabled&&<div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
        <ShieldCheck className="h-4 w-4 text-slate-400"/>فعلاً فقط پرونده CRM ثبت می‌شود. برای ایجاد حساب، کلید بالا را روشن کنید.
      </div>}
      {canManage&&value.enabled&&<div className="mt-5 space-y-4 border-t border-orange-100 pt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2"><span className="text-xs font-bold text-slate-700">نام کاربری انگلیسی <span className="text-orange-600">*</span></span>
            <div className="flex gap-2"><input dir="ltr" aria-label="نام کاربری مشتری" className={control+' font-mono tracking-wide'} autoComplete="off" spellCheck={false}
              value={value.username} onChange={e=>change({username:e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,'')})} placeholder="sp_12345"/>
              <button type="button" aria-label="پیشنهاد نام کاربری" title="پیشنهاد نام کاربری" onClick={()=>change({username:generateUsername()})}
                className="shrink-0 rounded-2xl border border-orange-200 bg-white px-3 text-orange-700 transition hover:bg-orange-50"><WandSparkles className="h-5 w-5"/></button></div>
            <p className="text-[11px] leading-5 text-slate-500">۴ تا ۳۲ نویسه؛ حرف اول باید انگلیسی باشد.</p>
          </label>
          <label className="block space-y-2"><span className="text-xs font-bold text-slate-700">رمز اولیه <span className="text-orange-600">*</span></span>
            <div className="flex gap-2"><input dir="ltr" aria-label="رمز اولیه مشتری" className={control+' font-mono'} type={showPassword?'text':'password'} autoComplete="new-password"
              value={value.password} onChange={e=>change({password:e.target.value})} minLength={12} maxLength={128}/>
              <button type="button" aria-label={showPassword?'مخفی کردن رمز':'نمایش رمز'} onClick={()=>setShowPassword(v=>!v)}
                className="shrink-0 rounded-2xl border border-slate-200 bg-white px-3 text-slate-700">{showPassword?<EyeOff className="h-5 w-5"/>:<Eye className="h-5 w-5"/>}</button>
              <button type="button" title="ایجاد رمز امن" aria-label="تولید رمز امن" onClick={()=>change({password:randomCustomerPassword()})}
                className="shrink-0 rounded-2xl border border-orange-200 bg-orange-50 px-3 text-orange-700"><RefreshCw className="h-5 w-5"/></button></div>
            <div className="flex gap-1.5">{[0,1,2,3].map(n=><span key={n} className={'h-1.5 flex-1 rounded-full '+(passwordScore>n?'bg-[#E56B1E]':'bg-slate-200')}/>)}</div>
          </label>
        </div>
        <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-6 text-slate-700">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[#E56B1E]" checked={value.confirmedPhone} onChange={e=>change({confirmedPhone:e.target.checked})}/>
          تأیید می‌کنم شماره موبایل متعلق به این مشتری است و اجازه ایجاد حساب برای او وجود دارد.
        </label>
        <p className="flex items-center gap-2 text-[11px] leading-6 text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600"/>رمز در پرونده CRM ذخیره نمی‌شود و در پایان فقط یک‌بار برای تحویل امن نمایش داده خواهد شد.</p>
      </div>}
    </div>
    {value.enabled&&canManage&&<div className="overflow-hidden rounded-[26px] border border-slate-200 bg-white">
      <button type="button" onClick={()=>setSmsExpanded(v=>!v)} aria-expanded={smsExpanded}
        className="flex w-full items-center justify-between gap-3 p-4 text-right transition hover:bg-slate-50 sm:p-5">
        <span className="flex items-center gap-3"><span className="rounded-2xl bg-orange-50 p-3 text-[#E56B1E]"><MessageSquareText className="h-5 w-5"/></span>
          <span><b className="block text-sm text-slate-800">مرکز پیام و قالب‌های آماده</b>
            <span className="mt-1 block text-xs leading-5 text-slate-500">انتخاب، ویرایش و ذخیره قالب؛ ارسال پیامک کاملاً اختیاری است.</span></span></span>
        <ChevronDown className={'h-5 w-5 shrink-0 text-slate-500 transition-transform '+(smsExpanded?'rotate-180':'')}/>
      </button>
      <div className="border-t border-slate-100 px-4 pb-4 pt-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
            <input type="checkbox" className="h-4 w-4 accent-[#E56B1E]" disabled={!smsConfigured||!readyToSend}
              checked={value.sendSms&&smsConfigured&&readyToSend} onChange={e=>{change({sendSms:e.target.checked});if(e.target.checked)setSmsExpanded(true);}}/>
            ارسال پیامک پس از ساخت حساب
          </label>
          <span className={'rounded-full px-3 py-1.5 text-[11px] font-bold '+(smsConfigured?'bg-emerald-50 text-emerald-700':'bg-slate-100 text-slate-500')}>
            {smsConfigured?'درگاه SMS.ir متصل است':'ارسال پیامک غیرفعال — ساخت حساب مستقل است'}
          </span>
        </div>
        {(smsExpanded||value.sendSms)&&<div className="mt-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <label className="min-w-0 flex-1 space-y-1.5"><span className="text-xs font-bold text-slate-700">انتخاب قالب از سیستم {loading?'(در حال دریافت...)':''}</span>
              <select aria-label="انتخاب قالب پیام" className={control} value={selected} onChange={e=>selectTemplate(e.target.value)}>
                <optgroup label="قالب‌های پیش‌فرض">{builtIn.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>
                {stored.some(item=>item.event_key==='crm_credentials')&&<optgroup label="قالب‌های ذخیره‌شده CRM">{stored.filter(item=>item.event_key==='crm_credentials').map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>}
                {stored.some(item=>item.event_key!=='crm_credentials')&&<optgroup label="قالب‌های دیگر سامانه">{stored.filter(item=>item.event_key!=='crm_credentials').map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</optgroup>}
                <option value="custom">متن دلخواه همین مشتری</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={()=>{setEditor({id:null,title:'قالب جدید CRM',text:value.messageTemplate});setTemplateError('');}}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-orange-200 bg-orange-50 px-3 py-3 text-xs font-bold text-orange-700 hover:bg-orange-100"><MessageSquarePlus className="h-4 w-4"/>ذخیره قالب جدید</button>
              {chosen?.event_key==='crm_credentials'&&chosen.id.startsWith('crm-credential-')&&<button type="button" title="ویرایش قالب انتخابی"
                onClick={()=>{setEditor({id:chosen.id,title:chosen.title,text:chosen.text});setTemplateError('');}}
                className="rounded-2xl border border-slate-200 px-3 text-slate-600"><Pencil className="h-4 w-4"/></button>}
            </div>
          </div>
          <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">متن پیام و پیش‌نمایش</span>
            <textarea rows={4} maxLength={800} dir="rtl" className={control+' min-h-28 resize-y leading-7'}
              value={value.messageTemplate} onChange={e=>{setSelected('custom');change({messageTemplate:e.target.value,sendSms:false});}}/>
          </label>
          <div className="flex flex-wrap gap-1.5">{['{smsName}','{username}','{password}','{loginUrl}'].map(token=>
            <button type="button" key={token} onClick={()=>{setSelected('custom');change({messageTemplate:value.messageTemplate+' '+token,sendSms:false});}}
              className="rounded-full border border-orange-100 bg-orange-50 px-2.5 py-1.5 font-mono text-[11px] text-orange-700">{token}</button>)}</div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between gap-2"><b className="text-xs text-slate-700">پیش‌نمایش با اطلاعات مشتری</b><Send className="h-4 w-4 text-slate-400"/></div>
            <pre dir="rtl" className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words font-sans text-xs leading-7 text-slate-700">{preview}</pre>
          </div>
          {!readyToSend&&<p className="text-[11px] leading-6 text-amber-700">برای ارسال اطلاعات ورود، متن باید متغیرهای {'{username}'} و {'{password}'} را داشته باشد و متغیر ناشناخته نداشته باشد.</p>}
          {templateNotice&&<p role="status" className="flex items-center gap-1.5 text-xs text-emerald-700"><CheckCircle2 className="h-4 w-4"/>{templateNotice}</p>}
        </div>}
        {!smsExpanded&&!value.sendSms&&<p className="mt-3 text-xs leading-5 text-slate-500">حساب بدون پیامک ساخته می‌شود. برای انتخاب یا مدیریت قالب‌ها، این بخش را باز کنید.</p>}
        {templateError&&!editor&&<p role="alert" className="mt-2 text-xs text-rose-700">{templateError}</p>}
      </div>
    </div>}
    {editor&&<div className="rounded-[26px] border border-orange-200 bg-gradient-to-br from-[#FFF9F3] to-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2"><h4 className="flex items-center gap-2 text-sm font-black text-slate-800"><Sparkles className="h-4 w-4 text-orange-600"/>{editor.id?'ویرایش قالب CRM':'افزودن قالب اختصاصی CRM'}</h4>
        <button type="button" onClick={()=>{setEditor(null);setTemplateError('');}} aria-label="بستن ویرایشگر قالب"><X className="h-4 w-4"/></button></div>
      <div className="mt-4 space-y-3">
        <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">عنوان قالب</span><input className={control} maxLength={90} value={editor.title} onChange={e=>setEditor(prev=>prev?{...prev,title:e.target.value}:prev)}/></label>
        <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-700">متن قابل استفاده مجدد</span>
          <textarea rows={5} maxLength={800} className={control+' resize-y leading-7'} value={editor.text}
            onChange={e=>setEditor(prev=>prev?{...prev,text:e.target.value}:prev)}/></label>
        {templateError&&<p role="alert" className="text-xs leading-6 text-rose-700">{templateError}</p>}
        <button type="button" disabled={saving} onClick={()=>void saveTemplate()}
          className="inline-flex items-center gap-2 rounded-xl bg-[#E56B1E] px-5 py-3 text-xs font-black text-white disabled:opacity-50">
          {saving?<LoaderCircle className="h-4 w-4 animate-spin"/>:<Save className="h-4 w-4"/>}ذخیره در قالب‌های سیستم
        </button>
      </div>
    </div>}
  </section>;
}
