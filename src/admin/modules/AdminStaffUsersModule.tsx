import React,{useCallback,useEffect,useState} from 'react';
import {UserPlus,Users,ShieldCheck,ShieldOff,KeyRound,Save,RotateCcw,Check,LockKeyhole} from 'lucide-react';

export type StaffPermissionMap=Record<string,string[]>;
interface StaffAccount{id:string;username:string;name:string;email:string;permissions:StaffPermissionMap;active:boolean;createdAt:string;lastLogin?:string}
const MODULES=[
 {id:'dashboard',label:'داشبورد',actions:[['view','مشاهده']]},
 {id:'products',label:'کاتالوگ و کالاها',actions:[['view','مشاهده'],['create','افزودن کالا'],['edit','ویرایش کالا'],['delete','حذف کالا'],['images','تصاویر'],['categories','دسته‌بندی‌ها'],['sku_move','انتقال کد کالا'],['prices','قیمت‌ها']]},
 {id:'bulk_import',label:'ورود گروهی کالا',actions:[['view','مشاهده'],['import','ورود فایل اکسل']]},
 {id:'announcements',label:'اطلاعیه‌ها',actions:[['view','مشاهده'],['create','ایجاد'],['edit','ویرایش'],['delete','حذف']]},
 {id:'content_studio',label:'مدیریت محتوا',actions:[['view','مشاهده'],['create','ایجاد'],['edit','ویرایش'],['delete','حذف']]},
 {id:'crm',label:'مشتریان و CRM',actions:[['view','مشاهده'],['create','افزودن'],['edit','ویرایش'],['delete','حذف']]},
 {id:'customer_grading',label:'اعتبار و قیمت‌ها',actions:[['view','مشاهده'],['edit','ویرایش']]},
 {id:'agencies',label:'نمایندگی‌ها',actions:[['view','مشاهده'],['edit','ویرایش']]},
 {id:'inquiries',label:'استعلام و پیش‌فاکتور',actions:[['view','مشاهده'],['create','ایجاد'],['edit','ویرایش']]},
 {id:'orders',label:'سفارش‌ها',actions:[['view','مشاهده'],['edit','ویرایش']]},
 {id:'clients',label:'مشتریان ما',actions:[['view','مشاهده'],['create','افزودن'],['edit','ویرایش'],['delete','حذف']]},
 {id:'reports',label:'گزارش‌ها',actions:[['view','مشاهده']]},
 {id:'settings',label:'تنظیمات سامانه',actions:[['view','مشاهده'],['edit','ویرایش']]},
] as const;

const emptyDraft=()=>({id:'',username:'',name:'',email:'',password:'',active:true,permissions:{} as StaffPermissionMap});
async function request(path:string,init?:RequestInit){
 const response=await fetch(path,{credentials:'same-origin',...init,headers:{'Content-Type':'application/json',...(init?.headers||{})}});
 const value=await response.json().catch(()=>({success:false,message:'پاسخ سرور قابل خواندن نیست.'}));
 if(!response.ok || !value.success)throw new Error(value.message||'ثبت اطلاعات با خطا مواجه شد.');
 return value;
}
const clone=(permissions:StaffPermissionMap)=>Object.fromEntries(Object.entries(permissions||{}).map(([k,v])=>[k,Array.isArray(v)?[...v]:[]]));

export const AdminStaffUsersModule:React.FC=()=>{
 const [users,setUsers]=useState<StaffAccount[]>([]);
 const [draft,setDraft]=useState(emptyDraft);
 const [loading,setLoading]=useState(true);
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [passwordMode,setPasswordMode]=useState(false);
 const reload=useCallback(async()=>{const data=await request('/api/admin/staff');setUsers(data.users||[]);},[]);
 useEffect(()=>{void reload().catch(e=>setError(String(e.message))).finally(()=>setLoading(false));},[reload]);
 const toggle=(module:string,permission:string)=>{
  setDraft(previous=>{
   const next=clone(previous.permissions);
   const list=new Set(next[module]||[]);
   if(permission==='view'){
    if(list.has('view'))delete next[module];
    else next[module]=['view'];
   }else{
    if(list.has(permission))list.delete(permission);else list.add(permission);
    if(!list.has('view'))list.add('view');
    next[module]=[...list];
   }
   return {...previous,permissions:next};
  });
 };
 const select=(account:StaffAccount)=>{
  setDraft({id:account.id,username:account.username,name:account.name,email:account.email,
    password:'',active:account.active,permissions:clone(account.permissions)});
  setPasswordMode(false);setSuccess('');setError('');
  window.scrollTo({top:0,behavior:'smooth'});
 };
 const clear=()=>{setDraft(emptyDraft());setPasswordMode(false);setError('');setSuccess('');};
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();setError('');setSuccess('');setPending(true);
  try{
   const payload=draft.id
    ? {name:draft.name,active:draft.active,permissions:draft.permissions}
    : {name:draft.name,username:draft.username,email:draft.email,password:draft.password,permissions:draft.permissions};
   await request(draft.id?'/api/admin/staff/'+draft.id:'/api/admin/staff',{
    method:draft.id?'PATCH':'POST',body:JSON.stringify(payload)});
   await reload();setSuccess(draft.id?'مجوزهای کارمند ذخیره و اعمال شد.':'حساب جدید کارمند ایجاد شد.');
   setDraft(emptyDraft());setPasswordMode(false);
  }catch(e){setError(e instanceof Error?e.message:'ذخیره انجام نشد.');}
  finally{setPending(false);}
 };
 const resetPassword=async()=>{
  if(!draft.id || draft.password.length<12)return setError('رمز جدید حداقل ۱۲ نویسه باشد.');
  setPending(true);setError('');setSuccess('');
  try{
   await request('/api/admin/staff/'+draft.id+'/reset-password',{
    method:'POST',body:JSON.stringify({password:draft.password})});
   setSuccess('رمز کارمند تغییر کرد.');setDraft(prev=>({...prev,password:''}));setPasswordMode(false);
  }catch(e){setError(e instanceof Error?e.message:'تغییر رمز انجام نشد.');}
  finally{setPending(false);}
 };
 return <div dir="rtl" className="space-y-6 text-right">
  <section className="rounded-3xl border border-[#F5CEB4] bg-white p-5 md:p-7">
   <div className="flex flex-wrap items-center gap-3">
    <div className="rounded-2xl bg-[#FFF0E5] p-3 text-[#E56B1E]"><ShieldCheck size={26}/></div>
    <div className="flex-1"><h3 className="text-lg font-black text-[#55565A]">مدیریت کاربران و سطح دسترسی</h3>
     <p className="mt-1 text-sm text-slate-500">هر تعداد کارمند تعریف کنید؛ منو و عملیات مجاز هر نفر را جداگانه انتخاب کنید.</p></div>
    <button type="button" onClick={clear} className="rounded-xl bg-[#E56B1E] px-4 py-2.5 text-sm font-bold text-white flex items-center gap-2"><UserPlus size={17}/> کاربر جدید</button>
   </div>
  </section>
  {error&&<div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">{error}</div>}
  {success&&<div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">{success}</div>}
  <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7 space-y-6">
   <div className="flex items-center justify-between flex-wrap gap-3">
    <h4 className="text-base font-black text-[#55565A]">{draft.id?'ویرایش حساب '+draft.username:'تعریف حساب کارمند جدید'}</h4>
    {draft.id&&<button type="button" onClick={clear} className="flex items-center gap-2 text-sm text-slate-500"><RotateCcw size={16}/> انصراف از ویرایش</button>}
   </div>
   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <label className="space-y-1.5 text-sm font-semibold text-slate-600">نام و نام خانوادگی
     <input required maxLength={160} minLength={2} value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-[#E56B1E]" placeholder="نام کارمند"/>
    </label>
    <label className="space-y-1.5 text-sm font-semibold text-slate-600">نام کاربری
     <input required disabled={!!draft.id} autoComplete="off" dir="ltr" pattern="[a-z][a-z0-9_]{3,31}" value={draft.username} onChange={e=>setDraft(v=>({...v,username:e.target.value.toLowerCase()}))} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-[#E56B1E] disabled:bg-slate-100" placeholder="catalog_editor"/>
    </label>
    <label className="space-y-1.5 text-sm font-semibold text-slate-600">ایمیل ورود
     <input required disabled={!!draft.id} autoComplete="off" dir="ltr" type="email" value={draft.email} onChange={e=>setDraft(v=>({...v,email:e.target.value}))} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-[#E56B1E] disabled:bg-slate-100" placeholder="staff@example.com"/>
    </label>
    {!draft.id&&<label className="space-y-1.5 text-sm font-semibold text-slate-600">رمز عبور اختصاصی
     <input required autoComplete="new-password" type="password" minLength={12} maxLength={128} value={draft.password} onChange={e=>setDraft(v=>({...v,password:e.target.value}))} className="w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-[#E56B1E]" placeholder="حداقل ۱۲ کاراکتر"/>
    </label>}
    {!!draft.id&&<label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 font-bold text-sm">
     <input type="checkbox" checked={draft.active} onChange={e=>setDraft(v=>({...v,active:e.target.checked}))} className="accent-[#E56B1E] w-4 h-4"/>
     {draft.active?<span className="flex items-center gap-2"><ShieldCheck size={18}/> حساب فعال</span>:<span className="flex items-center gap-2 text-rose-700"><ShieldOff size={18}/> حساب غیرفعال</span>}
    </label>}
   </div>
   <div className="space-y-3">
    <div><h4 className="font-black text-[#55565A]">دسترسی به منوها و عملیات داخل هر منو</h4>
     <p className="text-xs mt-1 text-slate-500">با برداشتن «نمایش منو»، تمام دسترسی‌های همان بخش لغو می‌شود. مجوزها روی سرور نیز بررسی می‌شوند.</p></div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
    {MODULES.map(module=>{
     const enabled=(draft.permissions[module.id]||[]).includes('view');
     return <div key={module.id} className={'rounded-2xl border p-4 space-y-3 '+(enabled?'border-[#F4C5A3] bg-[#FFF9F5]':'border-slate-200 bg-[#FAFAFA]')}>
      <label className="flex items-center gap-3 cursor-pointer">
       <input type="checkbox" checked={enabled} onChange={()=>toggle(module.id,'view')} className="h-4 w-4 accent-[#E56B1E]"/>
       <span className="font-black text-sm text-[#55565A] flex-1">{module.label}</span>
       {enabled?<Check size={16} className="text-[#E56B1E]"/>:<LockKeyhole size={16} className="text-slate-400"/>}
      </label>
      {enabled&&<div className="grid grid-cols-2 gap-2 border-t border-orange-100 pt-3">
       {module.actions.filter(([action])=>action!=='view').map(([action,title])=><label key={action} className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
         <input type="checkbox" checked={(draft.permissions[module.id]||[]).includes(action)} onChange={()=>toggle(module.id,action)} className="h-4 w-4 accent-[#E56B1E]"/>{title}
        </label>)}
       {module.actions.length===1&&<span className="text-xs text-slate-500">دسترسی فقط مشاهده</span>}
      </div>}
     </div>;
    })}
    </div>
   </div>
   <div className="flex flex-wrap gap-3">
    <button disabled={pending} type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-[#E56B1E] text-white px-5 py-3 text-sm font-black disabled:opacity-50"><Save size={18}/>{pending?'در حال ثبت…':draft.id?'ذخیره دسترسی‌ها':'ایجاد کاربر'}</button>
    {!!draft.id&&<button type="button" onClick={()=>setPasswordMode(v=>!v)} className="flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold"><KeyRound size={17}/> تغییر رمز</button>}
   </div>
   {!!draft.id&&passwordMode&&<div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-wrap gap-3">
    <input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={draft.password} onChange={e=>setDraft(v=>({...v,password:e.target.value}))} placeholder="رمز جدید (حداقل ۱۲ نویسه)" className="rounded-xl border border-slate-200 p-3 flex-1 min-w-48"/>
    <button type="button" onClick={()=>void resetPassword()} disabled={pending||draft.password.length<12} className="rounded-xl bg-slate-800 text-white p-3 text-sm font-bold disabled:opacity-50">ثبت رمز جدید</button>
   </div>}
  </form>
  <section className="rounded-3xl border border-slate-200 bg-white p-5 md:p-7 space-y-4">
   <h4 className="text-base font-black text-[#55565A] flex items-center gap-2"><Users size={20}/> کاربران تعریف‌شده <span className="text-xs text-slate-400">({users.length})</span></h4>
   {loading?<p className="text-sm text-slate-500">در حال بارگذاری کاربران…</p>:users.length===0?<p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">هنوز کارمندی تعریف نشده است.</p>:
   <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">{users.map(user=><article key={user.id} className="rounded-2xl border border-slate-200 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3">
     <div><p className="font-black text-sm text-[#55565A]">{user.name}</p><p className="text-xs font-mono text-slate-500" dir="ltr">{user.username}</p><p className="text-xs text-slate-400" dir="ltr">{user.email}</p></div>
     <span className={'text-xs rounded-full px-3 py-1 '+(user.active?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700')}>{user.active?'فعال':'غیرفعال'}</span>
    </div>
    <p className="text-xs text-slate-500">{Object.values(user.permissions||{}).filter(v=>Array.isArray(v)&&v.includes('view')).length} منوی مجاز</p>
    <button type="button" onClick={()=>select(user)} className="rounded-xl border border-[#F5CEB4] px-4 py-2 text-sm font-bold text-[#B54E0D] hover:bg-orange-50">ویرایش دسترسی‌ها</button>
   </article>)}</div>}
  </section>
 </div>;
};
