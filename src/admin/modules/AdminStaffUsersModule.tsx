import React,{useCallback,useEffect,useMemo,useState} from 'react';
import { requireAdminApiJson } from '../../utils/adminApiResponse';
import {
  Activity,AlertTriangle,Check,CheckCheck,ChevronLeft,CircleCheck,Clock3,
  KeyRound,LoaderCircle,LockKeyhole,Plus,RefreshCcw,Save,Search,ShieldCheck,
  ShieldOff,SlidersHorizontal,UserRoundPlus,Users,Wifi,WifiOff,X
} from 'lucide-react';

export type StaffPermissionMap=Record<string,string[]>;
interface StaffAccount {
 id:string;username:string;name:string;email:string;
 permissions:StaffPermissionMap;active:boolean;createdAt:string;
 updatedAt?:string;lastLogin?:string|null;
}
interface StaffDraft {
 id:string;username:string;name:string;email:string;password:string;
 active:boolean;permissions:StaffPermissionMap;
}
const MODULES=[
 {id:'dashboard',label:'داشبورد و گزارش‌ها',description:'نمای کلی و شاخص‌های فروش',actions:[['view','مشاهده']]},
 {id:'products',label:'کاتالوگ و کالاها',description:'محصولات، خانواده‌ها و تصاویر',actions:[['view','مشاهده'],['create','افزودن کالا'],['edit','ویرایش کالا'],['delete','حذف کالا'],['images','تصاویر'],['categories','دسته‌بندی‌ها'],['sku_move','انتقال SKU'],['prices','قیمت و موجودی']]},
 {id:'bulk_import',label:'ورود گروهی کالا',description:'ورود فایل‌های اکسل',actions:[['view','مشاهده'],['import','ایمپورت اکسل']]},
 {id:'announcements',label:'اطلاعیه‌ها',description:'اطلاع‌رسانی به مشتریان',actions:[['view','مشاهده'],['create','ایجاد'],['edit','ویرایش'],['delete','حذف']]},
 {id:'content_studio',label:'مدیریت محتوا',description:'صفحات و بنرهای سایت',actions:[['view','مشاهده'],['create','ایجاد'],['edit','ویرایش'],['delete','حذف']]},
 {id:'crm',label:'مشتریان و CRM',description:'مدیریت روابط مشتریان',actions:[['view','مشاهده'],['create','افزودن'],['edit','ویرایش'],['delete','حذف']]},
 {id:'customer_grading',label:'اعتبار و قیمت‌ها',description:'اعتبارسنجی و قیمت‌نامه',actions:[['view','مشاهده'],['edit','ویرایش']]},
 {id:'agencies',label:'نمایندگی‌ها',description:'شبکه نمایندگان',actions:[['view','مشاهده'],['edit','ویرایش']]},
 {id:'inquiries',label:'استعلام و پیش‌فاکتور',description:'مدیریت درخواست قیمت',actions:[['view','مشاهده'],['create','ایجاد'],['edit','ویرایش']]},
 {id:'orders',label:'سفارش‌ها و لجستیک',description:'ثبت و پیگیری سفارش',actions:[['view','مشاهده'],['edit','ویرایش']]},
 {id:'clients',label:'مشتریان ما',description:'لوگو و فهرست مشتریان',actions:[['view','مشاهده'],['create','افزودن'],['edit','ویرایش'],['delete','حذف']]},
 {id:'reports',label:'گزارش‌های مدیریتی',description:'رتبه‌بندی و گزارش فروش',actions:[['view','مشاهده']]},
] as const;

type StaffFilter='all'|'active'|'inactive';
const emptyDraft=():StaffDraft=>({id:'',username:'',name:'',email:'',password:'',active:true,permissions:{}});
const clone=(permissions:StaffPermissionMap):StaffPermissionMap=>Object.fromEntries(
 Object.entries(permissions||{}).map(([key,value])=>[key,Array.isArray(value)?[...value]:[]])
);
const allowedCount=(permissions:StaffPermissionMap)=>Object.values(permissions||{}).filter(
 value=>Array.isArray(value)&&value.includes('view')
).length;
function humanDate(value?:string|null){
 if(!value)return 'ثبت نشده';
 const date=new Date(value);
 return Number.isNaN(date.getTime())?'ثبت نشده':date.toLocaleString('fa-IR',{dateStyle:'medium',timeStyle:'short'});
}
async function api(path:string,init?:RequestInit){
 const response=await fetch(path,{
  ...init,credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json',...(init?.headers||{})}
 });
 const data=await requireAdminApiJson<any>(response,'مدیریت کاربران و دسترسی');
 return data;
}
function Stat({label,value,note,icon:Icon}:{label:string;value:string|number;note:string;icon:React.ElementType}){
 return <div className="min-w-0 rounded-2xl border border-[#EAECF0] bg-white p-4 shadow-[0_5px_24px_rgba(24,33,48,.025)] sm:p-5">
  <div className="flex items-start justify-between gap-3">
   <div><p className="text-[11px] font-bold text-[#7A7F89]">{label}</p>
    <div className="mt-2 text-3xl font-black tracking-tight text-[#2F343C]">{value}</div></div>
   <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#FFF0E5] text-[#E56B1E]"><Icon size={21}/></div>
  </div>
  <p className="mt-3 text-[11px] text-[#9297A0]">{note}</p>
 </div>;
}
const inputClass='mt-2 w-full rounded-xl border border-[#E2E5EA] bg-white px-4 py-3 text-sm text-[#2E333B] outline-none transition placeholder:text-[#ACB1B9] focus:border-[#E56B1E] focus:ring-4 focus:ring-orange-500/10 disabled:bg-[#F4F5F7] disabled:text-[#A1A5AD]';

export const AdminStaffUsersModule:React.FC=()=>{
 const [users,setUsers]=useState<StaffAccount[]>([]);
 const [draft,setDraft]=useState<StaffDraft>(emptyDraft);
 const [loading,setLoading]=useState(true);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [passwordMode,setPasswordMode]=useState(false);
 const [filter,setFilter]=useState<StaffFilter>('all');
 const [query,setQuery]=useState('');
 const [lastSync,setLastSync]=useState<Date|null>(null);
 const [connected,setConnected]=useState(false);
 const [refreshing,setRefreshing]=useState(false);

 const reload=useCallback(async(silent=false)=>{
  if(silent)setRefreshing(true);
  try{
   const data=await api('/api/admin/staff');
   setUsers(Array.isArray(data.users)?data.users:[]);
   setLastSync(new Date());
   setError('');
  }catch(e){
   setError(e instanceof Error?e.message:'دریافت اطلاعات کارکنان ممکن نشد.');
  }finally{setLoading(false);if(silent)setRefreshing(false);}
 },[]);

 useEffect(()=>{
  void reload();
  const source=new EventSource('/api/admin/staff/events',{withCredentials:true});
  source.addEventListener('staff-updated',()=>{void reload(true);});
  source.onopen=()=>setConnected(true);
  source.onerror=()=>setConnected(false);
  // Network disconnects and multi-instance deployments always recover with a read-only refresh.
  const interval=window.setInterval(()=>{if(document.visibilityState==='visible')void reload(true);},12000);
  const focus=()=>{void reload(true);};
  window.addEventListener('focus',focus);
  return ()=>{source.close();window.clearInterval(interval);window.removeEventListener('focus',focus);};
 },[reload]);

 const filtered=useMemo(()=>users.filter(user=>{
  if(filter==='active'&&!user.active)return false;
  if(filter==='inactive'&&user.active)return false;
  const term=query.trim().toLocaleLowerCase();
  return !term || [user.name,user.username,user.email].some(v=>String(v||'').toLocaleLowerCase().includes(term));
 }),[users,filter,query]);
 const activeCount=users.filter(user=>user.active).length;
 const selected=users.find(user=>user.id===draft.id);

 const clear=()=>{setDraft(emptyDraft());setPasswordMode(false);setSuccess('');setError('');};
 const select=(account:StaffAccount)=>{
  setDraft({id:account.id,username:account.username,name:account.name,email:account.email||'',
   password:'',active:account.active,permissions:clone(account.permissions)});
  setPasswordMode(false);setSuccess('');setError('');
  document.getElementById('staff-editor')?.scrollIntoView({behavior:'smooth',block:'start'});
 };
 const toggle=(moduleId:string,action:string)=>{
  setDraft(previous=>{
   const permissions=clone(previous.permissions);
   const list=new Set(permissions[moduleId]||[]);
   if(action==='view'){
    if(list.has('view'))delete permissions[moduleId];
    else permissions[moduleId]=['view'];
   }else{
    if(list.has(action))list.delete(action);else list.add(action);
    list.add('view');
    permissions[moduleId]=[...list];
   }
   return {...previous,permissions};
  });
 };
 const viewAll=(enabled:boolean)=>{
  setDraft(previous=>({...previous,permissions:enabled?Object.fromEntries(
   MODULES.map(module=>[module.id,['view']])):{}}));
 };
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();
  if(pending)return;
  setPending(true);setSuccess('');setError('');
  try{
   const payload=draft.id
    ? {name:draft.name.trim(),active:draft.active,permissions:draft.permissions}
    : {name:draft.name.trim(),username:draft.username.trim(),email:draft.email.trim(),
       password:draft.password,permissions:draft.permissions};
   await api(draft.id?'/api/admin/staff/'+draft.id:'/api/admin/staff',{
    method:draft.id?'PATCH':'POST',body:JSON.stringify(payload)
   });
   await reload(true);
   setSuccess(draft.id?'سطح دسترسی و وضعیت حساب در سرور ذخیره شد.':'کاربر جدید در سیستم احراز هویت ایجاد شد.');
   setDraft(emptyDraft());setPasswordMode(false);
  }catch(e){setError(e instanceof Error?e.message:'ذخیره انجام نشد.');}
  finally{setPending(false);}
 };
 const resetPassword=async()=>{
  if(!draft.id||draft.password.length<12){setError('رمز جدید باید حداقل ۱۲ نویسه باشد.');return;}
  if(pending)return;
  setPending(true);setError('');setSuccess('');
  try{
   await api('/api/admin/staff/'+draft.id+'/reset-password',{
    method:'POST',body:JSON.stringify({password:draft.password})
   });
   setDraft(old=>({...old,password:''}));setPasswordMode(false);
   setSuccess('رمز ورود کارمند در سرویس احراز هویت تغییر کرد.');
  }catch(e){setError(e instanceof Error?e.message:'تغییر رمز انجام نشد.');}
  finally{setPending(false);}
 };

 return <div className="space-y-5 text-right" dir="rtl">
  <section className="relative isolate overflow-hidden rounded-[26px] bg-[#252932] px-5 py-6 text-white shadow-[0_12px_35px_rgba(23,32,43,.12)] sm:px-7 sm:py-8">
   <div className="pointer-events-none absolute -left-14 -top-24 h-64 w-64 rounded-full bg-[#E56B1E]/25 blur-3xl"/>
   <div className="pointer-events-none absolute bottom-0 left-1/3 h-20 w-40 rounded-full bg-orange-500/10 blur-2xl"/>
   <div className="relative flex flex-wrap items-center justify-between gap-5">
    <div className="flex items-start gap-4">
     <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10"><ShieldCheck size={28} className="text-orange-300"/></div>
     <div>
      <p dir="ltr" className="mb-2 text-left text-[10px] font-bold uppercase tracking-[.24em] text-orange-300">STAFF ACCESS CONTROL</p>
      <h3 className="text-xl font-black tracking-tight sm:text-2xl">کاربران و دسترسی‌های سازمانی</h3>
      <p className="mt-2 max-w-xl text-xs leading-7 text-white/65 sm:text-sm">حساب واقعی بسازید، دسترسی هر منو و عملیات را تعیین کنید و تغییرات را با دیتابیس اصلی همگام نگه دارید.</p>
     </div>
    </div>
    <button type="button" onClick={clear} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-5 py-3.5 text-sm font-black text-white shadow-[0_6px_16px_rgba(229,107,30,.24)] transition hover:bg-[#F57B2D] sm:w-auto">
     <UserRoundPlus size={19}/> ایجاد کاربر جدید <Plus size={16}/>
    </button>
   </div>
   <div className="relative mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4 text-[11px] text-white/70">
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
     {connected?<Wifi size={14} className="text-emerald-400"/>:<WifiOff size={14} className="text-amber-300"/>}
     {connected?'همگام‌سازی لحظه‌ای متصل':'بازبینی خودکار هر ۱۲ ثانیه'}
    </span>
    <span className="inline-flex items-center gap-1.5"><Clock3 size={13}/> آخرین دریافت: {lastSync?lastSync.toLocaleTimeString('fa-IR'):'—'}</span>
    <span className="inline-flex items-center gap-1.5"><LockKeyhole size={13}/> مجوزها در سرور بررسی می‌شوند</span>
   </div>
  </section>

  <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
   <Stat label="کل حساب‌های کارمندی" value={loading?'—':users.length.toLocaleString('fa-IR')} note="از دیتابیس اصلی" icon={Users}/>
   <Stat label="کاربران فعال" value={loading?'—':activeCount.toLocaleString('fa-IR')} note="مجاز به ورود طبق مجوزها" icon={ShieldCheck}/>
   <Stat label="حساب‌های غیرفعال" value={loading?'—':(users.length-activeCount).toLocaleString('fa-IR')} note="دسترسی تعلیق‌شده" icon={ShieldOff}/>
   <Stat label="بخش‌های قابل واگذاری" value={MODULES.length.toLocaleString('fa-IR')} note="با کنترل عملیات هر بخش" icon={SlidersHorizontal}/>
  </div>

  {error&&<div role="alert" className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-800">
   <AlertTriangle className="mt-0.5 shrink-0" size={18}/><span className="flex-1">{error}</span>
   <button type="button" aria-label="بستن خطا" onClick={()=>setError('')}><X size={16}/></button>
  </div>}
  {success&&<div role="status" className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-bold text-emerald-800">
   <CircleCheck size={19}/>{success}
  </div>}

  <div className="grid items-start gap-5 2xl:grid-cols-[minmax(300px,.75fr)_minmax(0,1.25fr)]">
   <section aria-label="فهرست کارکنان" className="min-w-0 rounded-[24px] border border-[#E8EAF0] bg-white p-4 shadow-sm sm:p-5">
    <div className="flex items-center justify-between gap-2">
     <div><h4 className="text-base font-black text-[#333840]">کارکنان سازمان</h4><p className="mt-1 text-xs text-[#9398A1]">لیست واقعی حساب‌های ثبت‌شده</p></div>
     <button type="button" aria-label="به‌روزرسانی لیست" onClick={()=>void reload(true)} disabled={refreshing} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 text-[#6F7681] transition hover:border-[#E56B1E] hover:text-[#E56B1E] disabled:opacity-50">
      <RefreshCcw size={18} className={refreshing?'animate-spin':''}/>
     </button>
    </div>
    <div className="relative mt-5">
     <Search size={17} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
     <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی نام، نام کاربری یا ایمیل…" className="w-full rounded-xl border border-[#E5E7EC] bg-[#F9FAFB] py-3.5 pr-11 pl-4 text-xs outline-none focus:border-[#E56B1E]"/>
    </div>
    <div className="mt-3 flex gap-2" role="group" aria-label="فیلتر وضعیت کارکنان">
     {([['all','همه'],['active','فعال'],['inactive','غیرفعال']] as const).map(([key,label])=>
      <button key={key} type="button" onClick={()=>setFilter(key)} className={'flex-1 rounded-xl px-3 py-2.5 text-xs font-bold transition '+(filter===key?'bg-[#333840] text-white':'bg-[#F5F6F8] text-[#777E88] hover:bg-[#EBEDF0]')}>{label}</button>
     )}
    </div>
    <div className="mt-4 max-h-[640px] space-y-2 overflow-y-auto pl-1">
     {loading?<div role="status" className="flex items-center justify-center gap-3 py-16 text-sm text-slate-500"><LoaderCircle size={20} className="animate-spin"/>دریافت اطلاعات…</div>
      :filtered.length===0?<div className="rounded-2xl border border-dashed border-slate-200 bg-[#FAFBFC] px-5 py-14 text-center">
       <Users size={32} className="mx-auto mb-3 text-slate-300"/>
       <p className="text-sm font-bold text-[#606773]">{users.length?'کاربری مطابق جست‌وجو پیدا نشد.':'هنوز کارمند جدیدی ثبت نشده است.'}</p>
       <p className="mt-2 text-xs text-[#9399A2]">برای شروع روی «ایجاد کاربر جدید» بزنید.</p>
      </div>:filtered.map(user=>
       <button type="button" key={user.id} onClick={()=>select(user)} aria-pressed={draft.id===user.id} className={'flex w-full items-center gap-3 rounded-2xl border p-3.5 text-right transition '+(draft.id===user.id?'border-[#F3B486] bg-[#FFF8F2] shadow-[0_3px_12px_rgba(229,107,30,.07)]':'border-[#ECEEF2] bg-white hover:border-[#EFC4A4] hover:bg-[#FFFCF9]')}>
        <span className={'grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black '+(user.active?'bg-[#FFF0E4] text-[#D25D14]':'bg-slate-100 text-slate-500')}>{user.name?.slice(0,1)||'؟'}</span>
        <span className="min-w-0 flex-1">
         <span className="block truncate text-[13px] font-black text-[#3A414B]">{user.name}</span>
         <span dir="ltr" className="mt-1 block truncate text-left text-[11px] text-[#8A929D]">{user.username}</span>
         <span className="mt-1.5 block text-[10px] text-[#9098A3]">{allowedCount(user.permissions).toLocaleString('fa-IR')} منوی مجاز</span>
        </span>
        <span className="flex shrink-0 flex-col items-end gap-2">
         <span className={'rounded-full px-2.5 py-1 text-[10px] font-bold '+(user.active?'bg-emerald-50 text-emerald-700':'bg-red-50 text-red-700')}>{user.active?'فعال':'تعلیق'}</span>
         <ChevronLeft size={16} className="text-slate-400"/>
        </span>
       </button>
      )}
    </div>
    {selected&&<div className="mt-4 rounded-2xl bg-[#F7F8FA] p-4 text-xs leading-7 text-[#737B86]">
      <span className="font-bold text-[#49515B]">آخرین ورود: </span>{humanDate(selected.lastLogin)}
      <div><span className="font-bold text-[#49515B]">آخرین تغییر: </span>{humanDate(selected.updatedAt)}</div>
    </div>}
   </section>

   <section id="staff-editor" aria-label="فرم اطلاعات و مجوزهای کارمند" className="min-w-0 scroll-mt-24 overflow-hidden rounded-[24px] border border-[#E8EAF0] bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EFF0F3] bg-[#FCFCFD] px-5 py-5 sm:px-6">
     <div className="flex items-center gap-3">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#FFF0E5] text-[#E56B1E]">{draft.id?<ShieldCheck size={20}/>:<UserRoundPlus size={20}/>}</span>
      <div><h4 className="text-base font-black text-[#353B44]">{draft.id?'ویرایش حساب کارمند':'تعریف کارمند جدید'}</h4>
       <p className="mt-1 text-[11px] text-[#9A9FA7]">{draft.id?'مجوزهای اختصاصی در سمت سرور اعمال می‌شوند.':'ساخت هویت امن در Supabase Auth'}</p></div>
     </div>
     {draft.id&&<button type="button" onClick={clear} className="inline-flex items-center gap-2 rounded-xl border border-[#ECEEF2] px-3.5 py-2.5 text-xs font-bold text-slate-600 hover:border-[#E56B1E]"><Plus className="rotate-45" size={16}/> ایجاد حساب دیگر</button>}
    </div>
    <form onSubmit={submit} className="space-y-6 p-5 sm:p-6">
     <div>
      <div className="mb-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-[#F2F4F7] text-[#6C7380] text-xs font-black">۱</span><h5 className="text-sm font-black text-[#49515B]">اطلاعات هویتی</h5></div>
      <div className="grid gap-4 sm:grid-cols-2">
       <label className="text-xs font-bold text-[#646C77]">نام و نام خانوادگی
        <input required minLength={2} maxLength={160} autoComplete="name" value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} className={inputClass} placeholder="نام کامل کارمند"/>
       </label>
       <label className="text-xs font-bold text-[#646C77]">نام کاربری
        <input required dir="ltr" autoComplete="off" disabled={Boolean(draft.id)} pattern="[a-z][a-z0-9_]{3,31}" maxLength={32} value={draft.username} onChange={e=>setDraft(v=>({...v,username:e.target.value.toLowerCase()}))} className={inputClass} placeholder="catalog_editor"/>
       </label>
       <label className="text-xs font-bold text-[#646C77]">ایمیل <span className="font-medium text-[#A4A9B1]">(اختیاری)</span>
        <input dir="ltr" autoComplete="off" type="email" disabled={Boolean(draft.id)} value={draft.email} onChange={e=>setDraft(v=>({...v,email:e.target.value}))} className={inputClass} placeholder="staff@example.com"/>
       </label>
       {!draft.id?<label className="text-xs font-bold text-[#646C77]">رمز عبور اختصاصی
        <input required type="password" autoComplete="new-password" minLength={12} maxLength={128} value={draft.password} onChange={e=>setDraft(v=>({...v,password:e.target.value}))} className={inputClass} placeholder="حداقل ۱۲ کاراکتر"/>
       </label>:
       <div className="flex flex-col justify-end"><label className="flex items-center justify-between gap-3 rounded-xl border border-[#E7EAEE] bg-[#FAFBFC] px-4 py-3">
        <span className="flex items-center gap-2 text-xs font-bold text-[#505762]">{draft.active?<ShieldCheck size={18} className="text-emerald-600"/>:<ShieldOff size={18} className="text-rose-600"/>}{draft.active?'حساب فعال':'حساب غیرفعال'}</span>
        <input aria-label="فعال بودن حساب" type="checkbox" checked={draft.active} onChange={e=>setDraft(v=>({...v,active:e.target.checked}))} className="h-5 w-5 accent-[#E56B1E]"/>
       </label></div>}
      </div>
      <p className="mt-3 text-[11px] leading-6 text-[#939AA4]">نام کاربری پس از ساخت ثابت است. رمز عبور در مرورگر یا جدول کارکنان ذخیره نمی‌شود.</p>
     </div>

     <div className="border-t border-[#EFF0F3] pt-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
       <div className="flex items-start gap-2"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#F2F4F7] text-xs font-black text-[#6C7380]">۲</span>
        <div><h5 className="text-sm font-black text-[#49515B]">مجوز دسترسی به بخش‌ها</h5>
         <p className="mt-1 text-[11px] leading-6 text-[#979DA6]">مشاهده هر منو را فعال کنید و عملیات مجاز را جداگانه انتخاب کنید.</p></div>
       </div>
       <div className="flex gap-2">
        <button type="button" onClick={()=>viewAll(true)} className="rounded-lg border border-[#E9D7C8] bg-[#FFF9F5] px-3 py-2 text-[11px] font-bold text-[#B75516] hover:bg-orange-50">فقط مشاهده همه</button>
        <button type="button" onClick={()=>viewAll(false)} className="rounded-lg border border-[#E7E9ED] px-3 py-2 text-[11px] font-bold text-[#777E88] hover:bg-slate-50">لغو همه</button>
       </div>
      </div>
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-orange-100 bg-[#FFF9F4] px-3.5 py-3 text-[11px] font-bold text-[#A55A26]">
       <CheckCheck size={16}/> {allowedCount(draft.permissions).toLocaleString('fa-IR')} بخش از {MODULES.length.toLocaleString('fa-IR')} بخش انتخاب شده
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
       {MODULES.map(module=>{
        const actions=draft.permissions[module.id]||[];
        const enabled=actions.includes('view');
        return <div key={module.id} className={'overflow-hidden rounded-2xl border transition '+(enabled?'border-[#F2C6A3] bg-[#FFFDFB]':'border-[#E9EBEF] bg-[#FBFCFD]')}>
         <label className="flex cursor-pointer items-center gap-3 p-3.5">
          <input type="checkbox" aria-label={'مشاهده '+module.label} checked={enabled} onChange={()=>toggle(module.id,'view')} className="h-[18px] w-[18px] shrink-0 accent-[#E56B1E]"/>
          <span className="min-w-0 flex-1"><span className="block text-[12px] font-black text-[#424953]">{module.label}</span>
           <span className="mt-1 block text-[10px] text-[#9EA4AC]">{module.description}</span></span>
          {enabled?<Check size={16} className="text-[#E56B1E]"/>:<LockKeyhole size={15} className="text-[#B4B9C0]"/>}
         </label>
         {enabled&&<div className="grid grid-cols-2 gap-x-2 gap-y-3 border-t border-orange-100 px-4 py-3">
          {module.actions.filter(([action])=>action!=='view').map(([action,title])=>
           <label key={action} className="flex cursor-pointer items-start gap-2 text-[11px] font-medium text-[#5F6875]">
            <input type="checkbox" checked={actions.includes(action)} onChange={()=>toggle(module.id,action)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#E56B1E]"/>{title}
           </label>
          )}
          {module.actions.length===1&&<span className="col-span-2 text-[11px] text-[#A3A8B0]">این بخش فقط مجوز مشاهده دارد.</span>}
         </div>}
        </div>;
       })}
      </div>
     </div>
     <div className="flex flex-wrap items-center gap-3 border-t border-[#EFF0F3] pt-5">
      <button type="submit" disabled={pending} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-6 py-3 text-sm font-black text-white transition hover:bg-[#CF5C14] disabled:opacity-50 sm:flex-none">
       {pending?<LoaderCircle size={18} className="animate-spin"/>:<Save size={18}/>}
       {pending?'در حال ذخیره روی سرور…':draft.id?'ذخیره تغییرات':'ایجاد حساب واقعی'}
      </button>
      {draft.id&&<button type="button" onClick={()=>setPasswordMode(v=>!v)} className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#DDE0E5] px-5 py-3 text-xs font-bold text-[#59616C] hover:bg-slate-50"><KeyRound size={17}/> تغییر رمز عبور</button>}
      <p className="w-full text-[10px] leading-5 text-[#A1A6AE]">ذخیره فقط در صورت پاسخ موفق API انجام‌شده اعلام می‌شود.</p>
     </div>
     {draft.id&&passwordMode&&<div className="rounded-2xl border border-[#E4E7ED] bg-[#F8F9FB] p-4">
      <label className="block text-xs font-bold text-[#5E6671]">رمز عبور جدید
       <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={draft.password} onChange={e=>setDraft(v=>({...v,password:e.target.value}))} className={inputClass} placeholder="حداقل ۱۲ کاراکتر"/>
      </label>
      <div className="mt-3 flex gap-2">
       <button type="button" onClick={()=>void resetPassword()} disabled={pending||draft.password.length<12} className="rounded-xl bg-[#353C47] px-5 py-3 text-xs font-bold text-white disabled:opacity-50">ثبت رمز جدید</button>
       <button type="button" onClick={()=>{setPasswordMode(false);setDraft(v=>({...v,password:''}));}} className="rounded-xl border border-slate-200 px-4 py-3 text-xs text-slate-600">انصراف</button>
      </div>
     </div>}
    </form>
   </section>
  </div>
  <div className="flex items-center gap-2 px-2 text-[11px] text-[#8E96A1]"><Activity size={14}/> اطلاعات کارکنان از API محافظت‌شده سرور دریافت می‌شود؛ این صفحه هیچ کاربر ساختگی یا داده نمونه‌ای نمایش نمی‌دهد.</div>
 </div>;
};
