import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Send, RefreshCw, Loader2, UserRound, Clock3 } from 'lucide-react';

type Message = { id?:string; sender?:string; senderName?:string; message?:string; text?:string; timestamp?:string };
type Ticket = { id:string; customer_name:string; phone:string; subject:string; status:string; messages:Message[]; created_at:string; updated_at:string };
const formatted = (stamp:string) => stamp ? new Date(stamp).toLocaleString('fa-IR') : '—';
export const RealCrmTickets:React.FC = () => {
  const [tickets,setTickets]=useState<Ticket[]>([]);
  const [selected,setSelected]=useState<string|null>(null);
  const [reply,setReply]=useState('');
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=useCallback(async()=>{
    try {
      setLoading(true);setError('');
      const response=await fetch('/api/admin/crm/tickets',{credentials:'same-origin',cache:'no-store'});
      const result=await response.json().catch(()=>({success:false,message:'پاسخ نامعتبر است.'}));
      if(!response.ok || !result.success)throw new Error(result.message || 'دریافت تیکت‌ها ممکن نشد.');
      const rows:Ticket[]=result.tickets || [];
      setTickets(rows);
      setSelected(previous=>previous && rows.some(t=>t.id===previous)?previous:rows[0]?.id||null);
    }catch(e){setError(e instanceof Error?e.message:'ارتباط با سرور برقرار نشد.');}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const active=tickets.find(t=>t.id===selected);
  const send=async(e:React.FormEvent)=>{
    e.preventDefault();if(!active||!reply.trim())return;
    setBusy(true);setError('');setNotice('');
    try{
      const result=await fetch('/api/admin/crm/tickets/'+encodeURIComponent(active.id)+'/reply',{
        method:'POST',credentials:'same-origin',
        headers:{'Content-Type':'application/json'},body:JSON.stringify({message:reply.trim()})});
      const body=await result.json().catch(()=>({success:false,message:'پاسخ نامعتبر است.'}));
      if(!result.ok||!body.success)throw new Error(body.message || 'پاسخ ذخیره نشد.');
      setReply('');setNotice('پاسخ در دیتابیس تیکت ذخیره شد.');await load();
    }catch(e){setError(e instanceof Error?e.message:'ارسال پاسخ ممکن نشد.');}
    finally{setBusy(false);}
  };
  return <section dir="rtl" className="space-y-3">
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div><h3 className="font-black text-slate-800">صندوق پشتیبانی مشتریان</h3>
        <p className="mt-1 text-xs text-slate-500">فقط تیکت‌های ثبت‌شده در دیتابیس نمایش داده می‌شوند.</p></div>
      <button type="button" onClick={()=>void load()} aria-label="بروزرسانی تیکت‌ها" className="rounded-xl border border-slate-200 p-2.5"><RefreshCw className="h-4 w-4"/></button>
    </div>
    {error&&<div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    {notice&&<div role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</div>}
    {loading?<div className="flex items-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/>در حال بارگذاری تیکت‌ها...</div>:
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {tickets.length ? tickets.map(t=><button key={t.id} type="button" onClick={()=>setSelected(t.id)}
            className={'block w-full rounded-xl border p-4 text-right '+(t.id===selected?'border-orange-300 bg-orange-50':'border-slate-200 bg-white')}>
            <div className="font-bold text-slate-800">{t.subject}</div><div className="mt-2 text-xs text-slate-500">{t.customer_name} · {t.status}</div>
            <div className="mt-1 text-[11px] text-slate-400">{formatted(t.updated_at)}</div>
          </button>):<div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">هنوز تیکتی ثبت نشده است.</div>}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:col-span-2">
          {active ? <>
            <div className="border-b border-slate-100 pb-3"><b className="text-sm text-slate-800">{active.subject}</b>
              <p className="mt-1 text-xs text-slate-500">{active.customer_name} · {active.phone}</p></div>
            <div className="my-4 max-h-[50vh] min-h-40 space-y-3 overflow-y-auto">
              {Array.isArray(active.messages) && active.messages.length?
                active.messages.map((m,i)=><div key={m.id||i} className={'max-w-[92%] rounded-xl p-3 text-sm '+(['support','admin'].includes(m.sender||'')?'mr-auto bg-orange-50 text-orange-900':'ml-auto bg-slate-100 text-slate-800')}>
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-bold"><UserRound className="h-3 w-3"/>{m.senderName || (m.sender==='support'?'پشتیبانی':'مشتری')}</div>
                  <p className="whitespace-pre-wrap break-words leading-7">{m.message||m.text||''}</p>
                  <div className="mt-1 flex items-center gap-1 text-[10px] opacity-65"><Clock3 className="h-3 w-3"/>{m.timestamp||''}</div>
                </div>) : <p className="p-6 text-center text-xs text-slate-500">پیامی در این تیکت ثبت نشده است.</p>}
            </div>
            <form onSubmit={send} className="border-t border-slate-100 pt-3">
              <label className="mb-2 block text-xs font-bold text-slate-600" htmlFor="crm-ticket-reply">پاسخ پشتیبانی</label>
              <textarea id="crm-ticket-reply" value={reply} onChange={e=>setReply(e.target.value)} required maxLength={3000}
                className="min-h-24 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-orange-400"/>
              <div className="mt-2 flex justify-end"><button disabled={busy||!reply.trim()} className="flex items-center gap-2 rounded-xl bg-[#E56B1E] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50"><Send className="h-4 w-4"/>{busy?'در حال ذخیره...':'ثبت پاسخ'}</button></div>
            </form>
          </>:<div className="flex h-full min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><MessageCircle className="h-5 w-5"/>تیکتی برای نمایش انتخاب نشده است.</div>}
        </div>
      </div>}
  </section>;
};
