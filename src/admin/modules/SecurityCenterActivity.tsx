import React,{useEffect,useState} from 'react';
import {Activity,Search,MessageSquare,RefreshCcw,ArrowRight,ArrowLeft} from 'lucide-react';
import {faDate,field,panel,primary,secondary,SectionTitle,securityApi} from './SecurityCenterShared';
type EventRow={id:string;user_name:string;action:string;entity:string;target:string;details:string;created_at:string};
type SmsRow={id:string;recipient_phone:string;event_key:string;status:string;created_at:string};
export const SecurityCenterActivity:React.FC<{mode:'audit'|'sms'}>=({mode})=>{
 const [rows,setRows]=useState<EventRow[]|SmsRow[]>([]);
 const [page,setPage]=useState(1);
 const [search,setSearch]=useState('');
 const [applied,setApplied]=useState('');
 const [more,setMore]=useState(false);
 const [busy,setBusy]=useState(true);
 const [error,setError]=useState('');
 async function load(p:number,q:string){
  setBusy(true);
  try{
   if(mode==='audit'){
    const data=await securityApi<{rows:EventRow[];hasMore:boolean}>('/api/admin/security/activity?page='+p+'&q='+encodeURIComponent(q));
    setRows(data.rows);setMore(data.hasMore);setPage(p);
   }else{
    const data=await securityApi<{rows:SmsRow[]}>('/api/admin/security/sms-logs');
    setRows(data.rows);setMore(false);
   }
   setError('');
  }catch(e){setError(e instanceof Error?e.message:'دریافت اطلاعات ممکن نشد');}
  finally{setBusy(false);}
 }
 useEffect(()=>{setRows([]);void load(1,applied);},[mode,applied]);
 const audits=mode==='audit'?rows as EventRow[]:[];
 const messages=mode==='sms'?rows as SmsRow[]:[];
 return <section className={panel}>
  <div className="flex flex-wrap items-start justify-between gap-4">
   <SectionTitle icon={mode==='audit'?Activity:MessageSquare}
    title={mode==='audit'?'تاریخچه واقعی فعالیت مدیران':'رویدادهای ثبت‌شده پیامک'}
    subtitle={mode==='audit'?'جست‌وجو و مشاهده وقایع ثبت‌شده در PostgreSQL':'نمایش فقط پیامک‌هایی که در sms_logs ثبت شده‌اند'}/>
   <button type="button" aria-label="بازخوانی سرور" onClick={()=>void load(page,applied)} className={secondary} disabled={busy}><RefreshCcw size={15} className={busy?'animate-spin':''}/> به‌روزرسانی</button>
  </div>
  {mode==='audit'&&<form className="mb-4 flex w-full max-w-md items-center gap-2" onSubmit={e=>{e.preventDefault();setApplied(search.trim());}}>
   <input className={field} placeholder="جست‌وجوی نام مدیر، اقدام یا هدف..." value={search} maxLength={80} onChange={e=>setSearch(e.target.value)}/>
   <button type="submit" className={primary}><Search size={16}/>جست‌وجو</button>
  </form>}
  {error&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-xs font-bold text-red-700">{error}</p>}
  <div className="w-full overflow-x-auto rounded-xl border border-[#EDF0F3]">
   <table className="w-full min-w-[650px] text-right text-xs">
    <thead className="bg-[#F7F8FA] text-[#69727E]">
     {mode==='audit'?<tr><th className="p-3">زمان</th><th className="p-3">مجری</th><th className="p-3">عملیات</th><th className="p-3">هدف</th><th className="p-3">شرح</th></tr>:
     <tr><th className="p-3">زمان</th><th className="p-3">گیرنده</th><th className="p-3">رویداد</th><th className="p-3">وضعیت ثبت‌شده</th></tr>}
    </thead>
    <tbody className="divide-y divide-[#EDF0F3]">
     {audits.map(row=><tr key={row.id} className="hover:bg-slate-50">
      <td className="whitespace-nowrap p-3 text-[#858D98]">{faDate(row.created_at)}</td>
      <td className="p-3 font-bold">{row.user_name||'—'}</td>
      <td className="p-3 font-bold text-[#D1651D]">{row.action}</td>
      <td className="p-3">{row.target||'—'}</td>
      <td className="max-w-xs p-3 leading-6">{row.details||'—'}</td></tr>)}
     {messages.map(row=><tr key={row.id} className="hover:bg-slate-50">
      <td className="p-3">{faDate(row.created_at)}</td>
      <td className="p-3" dir="ltr">{row.recipient_phone}</td>
      <td className="p-3">{row.event_key||'—'}</td>
      <td className="p-3 font-bold">{row.status}</td></tr>)}
    </tbody>
   </table>
   {!busy&&rows.length===0&&<p className="p-10 text-center text-xs text-slate-400">رویدادی با این شرایط ثبت نشده است.</p>}
   {busy&&<p role="status" className="p-8 text-center text-xs text-slate-400">در حال دریافت اطلاعات واقعی…</p>}
  </div>
  {mode==='audit'&&<div className="mt-4 flex items-center justify-end gap-3">
   <button className={secondary} type="button" disabled={busy||page===1} onClick={()=>void load(page-1,applied)}>قبلی</button>
   <span className="text-xs font-bold text-slate-500">صفحه {page.toLocaleString('fa-IR')}</span>
   <button className={secondary} type="button" disabled={busy||!more} onClick={()=>void load(page+1,applied)}>بعدی</button>
  </div>}
 </section>;
};
