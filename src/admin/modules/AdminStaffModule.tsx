import React,{useCallback,useEffect,useState} from 'react';
import {ShieldCheck,UserPlus,KeyRound,RefreshCw} from 'lucide-react';
import {ADMIN_MODULES} from '../../../server/db/adminPermissions';
type Staff={id:string;username:string;name:string;email:string;role:string;status:string;permissions:string[]};
const names:Record<string,string>={dashboard:'داشبورد',orders:'سفارش‌ها',inquiries:'استعلام‌ها',crm:'مشتریان و CRM',customer_grading:'قیمت‌گذاری',agencies:'نمایندگی‌ها',products:'کاتالوگ و کالاها',bulk_import:'ورود گروهی اکسل',content_studio:'مدیریت محتوا',announcements:'اطلاعیه‌ها',clients:'مشتریان ما',settings:'امنیت (فقط مدیر اصلی)'};
const options=ADMIN_MODULES.filter(x=>x!=='settings');
const request=async(method:string,body?:unknown)=>{
 const res=await fetch('/api/admin/staff',{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
 const data=await res.json().catch(()=>({success:false,message:'پاسخ نامعتبر سرور'}));
 if(!res.ok||!data.success)throw new Error(data.message||'درخواست ناموفق بود.');
 return data;
};
export function AdminStaffModule(){
 const [staff,setStaff]=useState<Staff[]>([]);
 const [ready,setReady]=useState(false);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const [form,setForm]=useState({username:'',name:'',email:'',password:'',role:'sales_manager',permissions:['dashboard','inquiries','crm'] as string[]});
 const refresh=useCallback(async()=>{
   setError('');try{const data=await request('GET');setStaff(data.staff);setReady(data.provisioningReady);}catch(e:any){setError(e.message)}
 },[]);
 useEffect(()=>{void refresh()},[refresh]);
 const change=async(body:unknown)=>{
  setBusy(true);setError('');setMessage('');
  try{const data=await request(body&&typeof body==='object'&&'username' in body?'POST':'PATCH',body);setMessage(data.message||'ثبت شد.');await refresh()}catch(e:any){setError(e.message)}finally{setBusy(false)}
 };
 const toggle=(id:string)=>setForm(f=>({...f,permissions:f.permissions.includes(id)?f.permissions.filter(x=>x!==id):[...f.permissions,id]}));
 return <div dir="rtl" className="space-y-5 text-right">
   <header className="bg-white border border-[#E8EAEE] rounded-2xl p-5">
    <h2 className="font-black text-lg text-[#55565A] flex items-center gap-2"><ShieldCheck size={20} className="text-[#E06518]"/>کاربران و سطح دسترسی</h2>
    <p className="text-sm text-[#77787C] mt-2">هر کارمند حساب مستقل دارد و فقط به بخش‌های مجاز دسترسی پیدا می‌کند. رمزها در Supabase Auth نگهداری می‌شوند، نه در مرورگر.</p>
   </header>
   {!ready&&<p role="status" className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">برای ایجاد یا تغییر رمز کارمندان، کلید امن SUPABASE_SERVICE_ROLE_KEY باید صرفاً در Railway تنظیم شود. تا آن زمان ایجاد حساب غیرفعال است.</p>}
   {error&&<p role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</p>}
   {message&&<p role="status" className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">{message}</p>}
   <section className="bg-white border border-[#E8EAEE] rounded-2xl p-5 space-y-4">
    <h3 className="font-bold flex items-center gap-2"><UserPlus className="text-[#E06518]" size={18}/>افزودن کارمند جدید</h3>
    <form className="grid sm:grid-cols-2 gap-3" onSubmit={e=>{e.preventDefault();void change(form)}}>
     <label className="text-xs font-bold space-y-1">نام و نام خانوادگی<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full border rounded-xl p-3" placeholder="نام کارمند"/></label>
     <label className="text-xs font-bold space-y-1">نام کاربری انگلیسی<input required dir="ltr" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} className="w-full border rounded-xl p-3" placeholder="username"/></label>
     <label className="text-xs font-bold space-y-1">ایمیل حساب<input required type="email" dir="ltr" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full border rounded-xl p-3"/></label>
     <label className="text-xs font-bold space-y-1">رمز امن (حداقل ۱۲ نویسه)<input required type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full border rounded-xl p-3"/></label>
     <label className="text-xs font-bold space-y-1 sm:col-span-2">نقش سازمانی<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full border rounded-xl p-3"><option value="sales_manager">فروش و CRM</option><option value="warehouse_operator">انبار و لجستیک</option></select></label>
     <fieldset className="sm:col-span-2 space-y-3"><legend className="font-bold text-sm mb-2">دسترسی به بخش‌ها</legend><div className="grid grid-cols-2 md:grid-cols-4 gap-2">{options.map(id=><label key={id} className="flex items-center gap-2 border rounded-xl p-3 text-xs cursor-pointer"><input type="checkbox" checked={form.permissions.includes(id)} onChange={()=>toggle(id)}/>{names[id]}</label>)}</div></fieldset>
     <div className="sm:col-span-2 flex justify-end"><button type="submit" disabled={busy||!ready} className="rounded-xl bg-[#E06518] text-white font-bold px-6 py-3 disabled:opacity-50">ساخت حساب و ثبت دسترسی</button></div>
    </form>
   </section>
   <section className="bg-white border border-[#E8EAEE] rounded-2xl p-5 space-y-3">
    <div className="flex items-center justify-between"><h3 className="font-bold">کارکنان تعریف‌شده</h3><button type="button" onClick={()=>void refresh()} aria-label="بازخوانی کاربران" className="rounded-lg border p-2"><RefreshCw size={16}/></button></div>
    {!staff.length&&<p className="text-sm text-slate-500">هنوز کارمندی در دیتابیس ثبت نشده است.</p>}
    {staff.map(person=><article key={person.id} className="border rounded-xl p-4 space-y-3">
     <div className="flex flex-wrap justify-between gap-2"><div><strong>{person.name}</strong><p className="text-xs text-slate-500" dir="ltr">{person.username} · {person.email}</p></div><span className="text-xs bg-slate-100 rounded-lg px-2 py-1">{person.status==='active'?'فعال':'غیرفعال'}</span></div>
     <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{options.map(id=><label key={id} className="text-xs flex items-center gap-2"><input type="checkbox" checked={person.permissions.includes(id)} disabled={busy} onChange={()=>{const permissions=person.permissions.includes(id)?person.permissions.filter(x=>x!==id):[...person.permissions,id];void change({id:person.id,operation:'set_permissions',permissions})}}/>{names[id]}</label>)}</div>
     <div className="flex flex-wrap items-center gap-2"><button type="button" disabled={busy} className="border rounded-lg px-3 py-2 text-xs" onClick={()=>void change({id:person.id,operation:'set_active',active:person.status!=='active'})}>{person.status==='active'?'غیرفعال‌کردن':'فعال‌کردن'}</button><button type="button" disabled={busy||!ready} className="border rounded-lg px-3 py-2 text-xs flex items-center gap-1" onClick={()=>{const password=window.prompt('رمز امن جدید (حداقل ۱۲ نویسه):');if(password)void change({id:person.id,operation:'reset_password',password})}}><KeyRound size={14}/> تغییر رمز</button></div>
    </article>)}
   </section>
 </div>;
}
