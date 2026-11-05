import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Building2, CheckCircle2, ClipboardCheck, ContactRound,
  FileText, KeyRound, LockKeyhole, Mail, MapPin, MessageSquareText, Phone, Save,
  ShieldCheck, ShoppingBag, Sparkles, UserRoundPlus, X
} from 'lucide-react';
import { CustomerNewAccessFields, type NewCustomerAccessDraft } from './CustomerNewAccessFields';

export type CustomerCrmFormValues={
  name:string;company:string;phone:string;email:string;province:string;city:string;notes:string;
  kind:'retail'|'high_volume';
};
type Props={
  form:CustomerCrmFormValues;
  editing:{id:string;has_login:boolean}|null;
  access:NewCustomerAccessDraft;
  canManageAccess:boolean;
  smsConfigured:boolean;
  busy:boolean;
  error:string;
  onChange:(form:CustomerCrmFormValues)=>void;
  onAccessChange:(draft:NewCustomerAccessDraft)=>void;
  onSubmit:(event:React.FormEvent)=>void;
  onClose:()=>void;
  onManageAccess:()=>void;
};
const inputClass='h-12 w-full min-w-0 rounded-2xl border border-[#E5E9EF] bg-white px-4 text-sm text-[#263241] outline-none transition-all duration-200 placeholder:text-[#9CA8B5] focus:border-[#E56B1E] focus:ring-4 focus:ring-[#E56B1E]/10 disabled:bg-[#F5F6F8] disabled:text-slate-400';
const iconWrap='pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#9AA5B2]';
function FormInput({label,value,onChange,Icon,placeholder,required=false,disabled=false,type='text',inputMode}:{
  label:string;value:string;onChange:(next:string)=>void;Icon:React.ElementType;placeholder?:string;
  required?:boolean;disabled?:boolean;type?:string;inputMode?:'tel'|'email';
}){
  return <label className="block min-w-0 space-y-2">
    <span className="flex items-center justify-between text-xs font-bold text-[#586677]">
      {label}{required?<span className="text-[#E56B1E]">ضروری</span>:<span className="font-normal text-slate-400">اختیاری</span>}
    </span>
    <span className="relative block"><Icon className={iconWrap+' h-4 w-4'}/>
      <input className={inputClass+' pr-11'} value={value} onChange={e=>onChange(e.target.value)}
        disabled={disabled} type={type} inputMode={inputMode} placeholder={placeholder} autoComplete="off"/>
    </span>
  </label>;
}
const phoneRule=(text:string)=>/^09\d{9}$/.test(text.replace(/[۰-۹]/g,x=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(x))).replace(/\s|-/g,''));
const emailRule=(value:string)=>!value||/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
export function CustomerCrmFormDialog({form,editing,access,canManageAccess,smsConfigured,busy,error,onChange,onAccessChange,onSubmit,onClose,onManageAccess}:Props){
  const [step,setStep]=useState(0);
  const [stepError,setStepError]=useState('');
  const isHigh=form.kind==='high_volume';
  const panelTitle=isHigh?'مشتری خرید بالا':'مشتری خرید تکی';
  const steps=[
    {label:'مشخصات',subtitle:'هویت و ارتباط',Icon:ContactRound},
    {label:'حساب و پیام',subtitle:editing?'تنظیمات ورود':'دسترسی و قالب‌ها',Icon:KeyRound},
    {label:'بازبینی',subtitle:'تأیید و ثبت',Icon:ClipboardCheck}
  ] as const;
  const update=<K extends keyof CustomerCrmFormValues>(key:K,next:CustomerCrmFormValues[K])=>{
    onChange({...form,[key]:next});setStepError('');
  };
  const validIdentity=()=>{
    if(form.name.trim().length<2)return 'نام و نام خانوادگی مشتری باید حداقل دو نویسه باشد.';
    if(!phoneRule(form.phone))return 'شماره همراه باید ۱۱ رقم و با ۰۹ شروع شود.';
    if(!emailRule(form.email.trim()))return 'نشانی ایمیل معتبر نیست.';
    return '';
  };
  const validAccess=()=>{
    if(editing||!access.enabled)return '';
    if(!canManageAccess)return 'فقط مدیر اصلی مجاز به ساخت حساب ورود است.';
    if(!/^[a-z][a-z0-9_]{3,31}$/.test(access.username))return 'نام کاربری باید ۴ تا ۳۲ نویسه انگلیسی و با حرف آغاز شود.';
    if(access.password.length<12||access.password.length>128)return 'رمز اولیه باید بین ۱۲ تا ۱۲۸ نویسه باشد.';
    if(!access.confirmedPhone)return 'مالکیت شماره موبایل مشتری را تأیید کنید.';
    if(access.sendSms&&(!smsConfigured||!access.messageTemplate.includes('{username}')||!access.messageTemplate.includes('{password}')))
      return 'برای ارسال پیامک، درگاه باید فعال باشد و متن حاوی نام کاربری و رمز اولیه باشد.';
    return '';
  };
  const moveTo=(next:number)=>{
    if(busy)return;
    if(next>step){
      const check=step===0?validIdentity():step===1?validAccess():'';
      if(check){setStepError(check);return;}
    }
    setStepError('');setStep(Math.max(0,Math.min(2,next)));
  };
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!busy)onClose();};
    window.addEventListener('keydown',key);
    return ()=>window.removeEventListener('keydown',key);
  },[busy,onClose]);
  const handleSubmit=(event:React.FormEvent)=>{
    event.preventDefault();
    const problem=validIdentity()||validAccess();
    if(problem){setStepError(problem);return;}
    onSubmit(event);
  };
  return <div dir="rtl" role="dialog" aria-modal="true" aria-label={editing?'ویرایش مشتری':'فرم پویا ثبت مشتری'}
    className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0D1829]/75 p-0 text-right backdrop-blur-[7px] sm:p-5">
    <div className="flex h-[100dvh] w-full max-w-[1180px] overflow-hidden bg-[#F7F8FA] shadow-[0_30px_100px_rgba(10,20,38,.28)] sm:h-[min(92dvh,930px)] sm:rounded-[32px] lg:flex-row">
      <aside className="relative hidden w-[275px] shrink-0 flex-col overflow-hidden bg-[#202B3C] p-6 text-white lg:flex">
        <div className="absolute -right-28 -top-24 h-64 w-64 rounded-full bg-[#E56B1E]/25 blur-3xl"/>
        <div className="absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[#E56B1E]/15 blur-3xl"/>
        <div className="relative flex items-center gap-3"><div className="rounded-2xl bg-[#E56B1E] p-3"><UserRoundPlus className="h-6 w-6"/></div>
          <div><div className="text-sm font-black">صنعت پیش</div><div className="mt-0.5 text-[11px] text-slate-300">مرکز مدیریت مشتریان</div></div></div>
        <div className="relative mt-10"><div className="mb-2 text-[11px] font-semibold tracking-widest text-[#F3AC78]">CRM WORKSPACE</div>
          <h2 className="text-2xl font-black leading-relaxed">{editing?'ویرایش پرونده':'ثبت مشتری جدید'}</h2>
          <p className="mt-3 text-xs leading-7 text-slate-300">تمام مراحل در یک فرم هوشمند، با اطلاعات زنده و بدون خروج از پنل مدیریت.</p></div>
        <div className="relative mt-10 space-y-3">
          {steps.map((item,index)=><button key={item.label} type="button" onClick={()=>moveTo(index)}
            className={'flex w-full items-center gap-3 rounded-2xl p-3 text-right transition-all '+(step===index?'bg-white/15 ring-1 ring-white/15':index<step?'bg-white/[.04] hover:bg-white/10':'hover:bg-white/5')}>
            <span className={'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl '+(step===index?'bg-[#E56B1E] text-white':index<step?'bg-emerald-500/20 text-emerald-200':'bg-white/10 text-slate-300')}>
              {index<step?<CheckCircle2 className="h-5 w-5"/>:<item.Icon className="h-5 w-5"/>}</span>
            <span><span className="block text-sm font-black">{item.label}</span><span className="mt-0.5 block text-[11px] text-slate-300">{item.subtitle}</span></span>
          </button>)}
        </div>
        <div className="relative mt-auto space-y-3 rounded-2xl border border-white/10 bg-white/10 p-4">
          <p className="flex items-center gap-2 text-xs font-bold"><Sparkles className="h-4 w-4 text-orange-300"/>خلاصه زنده پرونده</p>
          <p className="truncate text-sm font-black">{form.name.trim()||'نام مشتری وارد نشده'}</p>
          <p dir="ltr" className="text-right text-xs text-slate-300">{form.phone||'شماره همراه ثبت نشده'}</p>
          <div className="flex flex-wrap gap-2"><span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px]">{panelTitle}</span>
            {!editing&&<span className="rounded-lg bg-white/10 px-2.5 py-1 text-[10px]">{access.enabled?'حساب ورود فعال':'فقط CRM'}</span>}</div>
        </div>
      </aside>
      <form noValidate onSubmit={handleSubmit} className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#EBEDF0] bg-white px-4 py-4 sm:px-7 sm:py-5">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-bold text-[#E56B1E]"><span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#E56B1E]"/>پیشخوان مشتریان صنعت پیش</div>
            <h3 className="mt-1 truncate text-lg font-black text-[#222E3E] sm:text-xl">{editing?'ویرایش اطلاعات مشتری':'ایجاد پرونده '+panelTitle}</h3>
          </div>
          <button type="button" onClick={onClose} disabled={busy} title="بستن فرم" aria-label="بستن فرم"
            className="shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5"/></button>
        </header>
        <div className="shrink-0 bg-white px-4 pb-4 sm:px-7">
          <div className="flex items-center justify-between gap-2 py-3 text-[11px] font-bold text-slate-500">
            <span>گام {step+1} از ۳ · {steps[step].label}</span><span>{Math.round(((step+1)/3)*100)}٪</span></div>
          <div className="flex gap-1.5">{steps.map((item,index)=><button key={item.label} type="button" onClick={()=>moveTo(index)}
            title={item.label} className={'h-2 flex-1 rounded-full transition-all duration-300 '+(index<=step?'bg-[#E56B1E]':'bg-slate-200')}/>)}</div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">{steps.map((item,index)=><button key={item.label} type="button" onClick={()=>moveTo(index)}
            className={'shrink-0 rounded-full px-3 py-1.5 text-xs font-bold '+(step===index?'bg-[#FFF0E5] text-[#AD4B11]':'bg-slate-100 text-slate-500')}>{index+1}. {item.label}</button>)}</div>
        </div>
        <main className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
          <div className="animate-[fadeIn_.25s_ease-out]">
            {step===0&&<div className="space-y-5">
              <div className="rounded-[26px] border border-[#E8EBEF] bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                  <span className="rounded-2xl bg-orange-50 p-3 text-[#E56B1E]"><ContactRound className="h-6 w-6"/></span>
                  <div><h4 className="text-base font-black text-[#293547]">اطلاعات هویتی و تماس</h4>
                    <p className="mt-1 text-xs text-slate-500">مشخصات واقعی مشتری را وارد کنید تا پرونده CRM ایجاد شود.</p></div>
                </div>
                <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
                  <FormInput Icon={ContactRound} label="نام و نام خانوادگی" required value={form.name} onChange={v=>update('name',v)} placeholder="مثلاً محمد رضایی"/>
                  <FormInput Icon={Phone} label="شماره موبایل" required value={form.phone} disabled={!!editing} onChange={v=>update('phone',v)} placeholder="09123456789" inputMode="tel"/>
                  <FormInput Icon={Mail} label="پست الکترونیکی" value={form.email} disabled={!!editing?.has_login}
                    onChange={v=>update('email',v)} type="email" inputMode="email" placeholder="example@company.com"/>
                  <FormInput Icon={Building2} label={isHigh?'نام شرکت یا مجموعه':'نام فروشگاه یا مجموعه'} value={form.company}
                    onChange={v=>update('company',v)} placeholder={isHigh?'نام مجموعه صنعتی':'نام فروشگاه (اختیاری)'}/>
                </div>
              </div>
              <div className="rounded-[26px] border border-[#E8EBEF] bg-white p-5 shadow-sm sm:p-7">
                <h4 className="flex items-center gap-2 text-sm font-black text-[#293547]"><MapPin className="h-5 w-5 text-[#E56B1E]"/>موقعیت و محدوده فعالیت</h4>
                <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <FormInput Icon={MapPin} label="استان" value={form.province} onChange={v=>update('province',v)} placeholder="مثلاً یزد"/>
                  <FormInput Icon={MapPin} label="شهر" value={form.city} onChange={v=>update('city',v)} placeholder="مثلاً میبد"/>
                </div>
              </div>
            </div>}
            {step===1&&<div className="space-y-5">
              {editing?<div className="space-y-4 rounded-[26px] border border-[#E8EBEF] bg-white p-5 sm:p-7">
                <div className="flex items-center gap-3"><span className="rounded-2xl bg-orange-50 p-3 text-[#E56B1E]"><KeyRound className="h-6 w-6"/></span>
                  <div><h4 className="font-black text-slate-800">مدیریت دسترسی مشتری</h4><p className="mt-1 text-xs text-slate-500">حساب قبلی حفظ می‌شود؛ تغییر نام کاربری یا رمز در مدیریت حساب انجام می‌شود.</p></div></div>
                <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-xs font-bold text-slate-600">{editing.has_login?'حساب ورود متصل است':'حساب ورود ساخته نشده'}</span>
                {canManageAccess&&<button type="button" onClick={onManageAccess}
                  className="flex items-center gap-2 rounded-2xl border border-orange-200 bg-[#FFF4E9] px-4 py-3 text-sm font-bold text-orange-700 hover:bg-orange-100"><LockKeyhole className="h-4 w-4"/>{editing.has_login?'مدیریت نام کاربری و بازنشانی رمز':'ساخت حساب ورود واقعی'}</button>}
              </div>:<CustomerNewAccessFields value={access} onChange={onAccessChange} canManage={canManageAccess}
                smsConfigured={smsConfigured} customerName={form.name}/>}
              <div className="flex items-start gap-3 rounded-2xl border border-blue-100 bg-[#F4F8FD] p-4 text-xs leading-7 text-slate-600">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#4679A5]"/>نوع پنل از بخشی که در آن هستید مشخص می‌شود: <b>{panelTitle}</b>. تغییر سطح دسترسی مشتریان موجود فقط از عملیات انتقال در فهرست CRM انجام می‌شود.
              </div>
            </div>}
            {step===2&&<div className="space-y-5">
              <div className="rounded-[26px] border border-[#E8EBEF] bg-white p-5 shadow-sm sm:p-7">
                <div className="flex items-center gap-3"><span className="rounded-2xl bg-[#EAF8F1] p-3 text-emerald-700"><ClipboardCheck className="h-6 w-6"/></span>
                  <div><h4 className="text-base font-black text-slate-800">بازبینی اطلاعات</h4><p className="mt-1 text-xs text-slate-500">قبل از ثبت نهایی، خلاصه پرونده را کنترل کنید.</p></div></div>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {[
                    ['نام مشتری',form.name||'—'],
                    ['موبایل',form.phone||'—'],
                    ['نوع حساب',panelTitle],
                    ['مجموعه',form.company||'شخص حقیقی'],
                    ['شهر',form.city||'تعیین نشده'],
                    ['پنل ورود',editing?(editing.has_login?'دارای حساب':'بدون حساب'):access.enabled?'ساخت حساب واقعی':'فقط ثبت CRM'],
                    ['پیامک',!editing&&access.enabled&&access.sendSms?'ارسال اختیاری فعال':'ارسال نمی‌شود']
                  ].map(([label,value])=><div key={label} className="rounded-2xl border border-slate-100 bg-[#F8FAFC] p-4">
                    <div className="text-[11px] font-bold text-slate-500">{label}</div><div className="mt-2 break-words text-sm font-black text-slate-800">{value}</div></div>)}
                </div>
              </div>
              <label className="block rounded-[26px] border border-[#E8EBEF] bg-white p-5 sm:p-7"><span className="flex items-center gap-2 text-sm font-black text-slate-800"><FileText className="h-5 w-5 text-[#E56B1E]"/>یادداشت داخلی CRM</span>
                <p className="mt-2 text-xs text-slate-500">یادداشت فقط برای مدیریت است و به مشتری نمایش داده نمی‌شود.</p>
                <textarea rows={5} maxLength={4000} className="mt-4 min-h-28 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 outline-none focus:border-orange-400"
                  placeholder="نکته‌های فروش، سابقه گفتگو یا توضیحات مسئول حساب..." value={form.notes} onChange={e=>update('notes',e.target.value)}/></label>
              {!editing&&access.enabled&&<p className="flex items-center gap-2 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-xs leading-7 text-orange-800"><ShieldCheck className="h-5 w-5 shrink-0"/>
                پس از ساخت موفق، رمز اولیه یک‌بار برای تحویل امن نمایش داده می‌شود. ساخت حساب نیازی به ارسال پیامک ندارد.</p>}
            </div>}
          </div>
          {(stepError||error)&&<div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold leading-7 text-rose-700">{stepError||error}</div>}
        </main>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#E9EBEF] bg-white px-4 py-4 sm:px-7 sm:py-5">
          <span className="hidden items-center gap-2 text-xs font-medium text-slate-500 sm:flex"><BadgeCheck className="h-4 w-4 text-emerald-600"/>بدون حذف اطلاعات مشتریان قبلی</span>
          <div className="flex w-full items-center justify-between gap-2 sm:w-auto">
            <button type="button" disabled={busy} onClick={()=>step===0?onClose():moveTo(step-1)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"><ArrowRight className="h-4 w-4"/>{step===0?'انصراف':'مرحله قبل'}</button>
            {step<2?<button type="button" disabled={busy} onClick={()=>moveTo(step+1)}
              className="inline-flex items-center gap-2 rounded-2xl bg-[#E56B1E] px-5 py-3 text-xs font-black text-white shadow-[0_6px_20px_rgba(229,107,30,.24)] transition hover:bg-[#CC5913] disabled:opacity-50">ادامه <ArrowLeft className="h-4 w-4"/></button>
            :<button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-2xl bg-[#E56B1E] px-5 py-3 text-xs font-black text-white shadow-[0_6px_20px_rgba(229,107,30,.24)] transition hover:bg-[#CC5913] disabled:opacity-50">
              <Save className="h-4 w-4"/>{busy?'در حال ثبت اطلاعات...':editing?'ذخیره تغییرات':'ثبت مشتری و ایجاد پرونده'}
            </button>}
          </div>
        </footer>
      </form>
    </div>
  </div>;
}
