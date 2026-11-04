import React, { useCallback, useEffect, useState } from 'react';
import {
  Users, Building2, ShoppingBag, UserPlus, Search, RefreshCw, Eye,
  ShieldCheck, ShieldAlert, X, Save, ArrowRight, Phone, MapPin,
  FileText, Wallet, MessageCircle, Package, ChevronLeft, ChevronRight,
  ClipboardList, CalendarClock, BadgeCheck, Info, Loader2
} from 'lucide-react';

type Customer = {
  id: string; source: 'crm' | 'profile'; crm_id: string | null; user_id: string | null;
  name: string; company: string | null; phone: string | null; email: string | null;
  city: string | null; province: string | null; notes: string | null;
  approved_b2b: boolean; has_login: boolean; approval_status: string;
  grade_code: string | null; assigned_price_list_id: string | null;
  credit_limit: number | string | null; credit_used: number | string | null;
  current_debt: number | string | null; order_count: number;
  total_spent: number | string; last_order_at: string | null; created_at: string;
};
type Summary = { total: number; high_volume: number; retail: number };
type Order = { id: string; created_at: string; status: string; payment_status: string; currency: string; total_amount: string | number; final_amount: string | number | null; discount_amount: number | string | null };
type Entry = { id: string; kind: string; debt_delta: string | number; wallet_delta: string | number; points_delta: string | number; description: string; reference: string; created_at: string };
type Ticket = { id: string; subject: string; status: string; created_at: string };
type Detail = { customer: Customer; orders: Order[]; finance: Entry[]; tickets: Ticket[] };
type FormValues = { name: string; company: string; phone: string; email: string; province: string; city: string; notes: string; kind: 'retail' | 'high_volume' };
const emptyForm = (kind: FormValues['kind']): FormValues => ({ name:'',company:'',phone:'',email:'',province:'',city:'',notes:'',kind });
const nf = (value: number | string | null | undefined) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Number(value || 0));
const money = (value: number | string | null | undefined) => nf(value) + ' تومان';
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('fa-IR') : 'ثبت نشده';
const orderMoney = (o: Order) => money(Number(o.final_amount ?? o.total_amount ?? 0) / (o.currency === 'IRR' ? 10 : 1));
const card = 'rounded-2xl border border-[#ECEEF0] bg-white shadow-[0_4px_24px_rgba(32,40,52,.03)]';
const field = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#E56B1E] focus:ring-2 focus:ring-[#E56B1E]/10';
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials:'same-origin', cache:'no-store', headers: { 'Content-Type':'application/json', ...(init?.headers || {}) } });
  const json = await response.json().catch(() => ({ success:false, message:'پاسخ سرور معتبر نیست.' }));
  if (!response.ok || !json.success) throw new Error(json.message || 'درخواست به نتیجه نرسید.');
  return json as T;
}
function Input({ label, value, onChange, required=false, disabled=false, type='text' }:
 { label:string;value:string;onChange:(value:string)=>void;required?:boolean;disabled?:boolean;type?:string }) {
  return <label className="block min-w-0 space-y-1.5"><span className="text-xs font-bold text-slate-600">{label}</span>
    <input className={field} value={value} onChange={e=>onChange(e.target.value)} required={required} disabled={disabled} type={type}/></label>;
}
function Metric({label,value,Icon}:{label:string;value:string;Icon:React.ElementType}) {
  return <div className={card+' flex min-w-0 items-center gap-3 p-4'}>
    <div className="rounded-2xl bg-[#FFF1E6] p-3 text-[#E56B1E]"><Icon className="h-5 w-5"/></div>
    <div className="min-w-0"><div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums text-[#34363B]">{value}</div></div>
  </div>;
}

export const RealCustomersCrmModule: React.FC = () => {
  const [kind,setKind] = useState<'retail'|'high_volume'>('high_volume');
  const [q,setQ] = useState('');
  const [page,setPage] = useState(1);
  const [revision,setRevision] = useState(0);
  const [rows,setRows] = useState<Customer[]>([]);
  const [counts,setCounts] = useState<Summary>({total:0,retail:0,high_volume:0});
  const [total,setTotal] = useState(0);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [form,setForm] = useState<FormValues | null>(null);
  const [editing,setEditing] = useState<Customer|null>(null);
  const [detail,setDetail] = useState<Detail|null>(null);
  const [detailTab,setDetailTab] = useState<'profile'|'orders'|'finance'|'tickets'>('profile');
  const [detailsLoading,setDetailsLoading] = useState(false);
  const [busy,setBusy] = useState(false);

  useEffect(()=>{
    const controller = new AbortController();
    const timer = window.setTimeout(async()=>{
      try {
        setLoading(true);setError('');
        const params = new URLSearchParams({kind,q,page:String(page)});
        const response = await fetch('/api/admin/crm/customers?'+params.toString(),{credentials:'same-origin',cache:'no-store',signal:controller.signal});
        const data = await response.json().catch(()=>({success:false,message:'پاسخ سرور نامعتبر است.'}));
        if (!response.ok || !data.success) throw new Error(data.message || 'دریافت مشتریان ممکن نشد.');
        if (controller.signal.aborted) return;
        setRows(data.customers || []);setTotal(data.total || 0);
        setCounts(data.counts || {total:0,retail:0,high_volume:0});
      } catch(e) {
        if (!controller.signal.aborted) {setRows([]);setTotal(0);setError(e instanceof Error ? e.message : 'خطا در ارتباط با سرور');}
      } finally {if(!controller.signal.aborted)setLoading(false);}
    },q?320:0);
    return ()=>{controller.abort();window.clearTimeout(timer);};
  },[kind,q,page,revision]);

  const refresh = useCallback(()=>setRevision(n=>n+1),[]);
  const openDetail = async (id:string) => {
    try {
      setDetailsLoading(true);setDetail(null);setError('');
      const response=await api<Detail>('/api/admin/crm/customers/'+encodeURIComponent(id));
      setDetail(response);setDetailTab('profile');
    } catch(e) {setError(e instanceof Error?e.message:'پرونده دریافت نشد.');}
    finally {setDetailsLoading(false);}
  };
  const edit = (c:Customer) => {
    setEditing(c);
    setForm({name:c.name||'',company:c.company||'',phone:c.phone||'',email:c.email||'',
      city:c.city||'',province:c.province||'',notes:c.notes||'',kind:c.approved_b2b?'high_volume':'retail'});
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();if(!form)return;
    setBusy(true);setError('');
    try {
      if (editing) {
        await api('/api/admin/crm/customers/'+encodeURIComponent(editing.id),{method:'PATCH',body:JSON.stringify(form)});
        setNotice('اطلاعات واقعی مشتری ذخیره شد.');
      } else {
        const result=await api<{message:string}>('/api/admin/crm/customers',{method:'POST',body:JSON.stringify(form)});
        setNotice(result.message);
      }
      const id=editing?.id;
      setForm(null);setEditing(null);refresh();
      if(id && detail) await openDetail(id);
    } catch(e) {setError(e instanceof Error?e.message:'ثبت مشتری ممکن نشد.');}
    finally {setBusy(false);}
  };
  const approval = async (c:Customer) => {
    const approved=!c.approved_b2b;
    if(!window.confirm(approved?'این مشتری به پنل خرید بالا ارتقا یابد؟':'دسترسی خرید بالای مشتری لغو و پنل خرید تکی فعال شود؟'))return;
    setBusy(true);setError('');
    try {
      await api('/api/admin/crm/customers/'+encodeURIComponent(c.id)+'/approval',{method:'POST',body:JSON.stringify({approved})});
      setNotice('نوع دسترسی مشتری با موفقیت تغییر کرد؛ سوابق او حفظ شدند.');
      refresh();if(detail)await openDetail(c.id);
    } catch(e) {setError(e instanceof Error?e.message:'تغییر دسترسی ممکن نشد.');}
    finally {setBusy(false);}
  };
  const fieldSet = (key:keyof FormValues,value:string) => setForm(f=>f?{...f,[key]:value}:f);
  return <div dir="rtl" className="space-y-5 pb-10 text-right">
    <div className={card+' flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'}>
      <div><div className="flex items-center gap-2"><Users className="h-6 w-6 text-[#E56B1E]"/>
        <h2 className="text-lg font-black text-[#34363B] sm:text-xl">مشتریان و مدیریت ارتباط با مشتری (CRM)</h2></div>
        <p className="mt-2 text-xs leading-6 text-slate-500">اطلاعات مستقیماً از PostgreSQL خوانده می‌شود؛ سفارش و اعتبار آزمایشی نمایش داده نمی‌شود.</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={refresh} aria-label="بارگذاری مجدد" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"><RefreshCw className="h-5 w-5"/></button>
        <button type="button" onClick={()=>{setEditing(null);setForm(emptyForm(kind));setError('');}} className="flex items-center gap-2 rounded-xl bg-[#E56B1E] px-4 py-3 text-sm font-bold text-white hover:bg-[#CC5812]"><UserPlus className="h-4 w-4"/>افزودن مشتری</button>
      </div>
    </div>
    {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</div>}
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Metric Icon={Users} label="همه مشتریان ثبت‌شده" value={nf(counts.total)}/>
      <Metric Icon={Building2} label="مشتریان خرید بالا" value={nf(counts.high_volume)}/>
      <Metric Icon={ShoppingBag} label="مشتریان خرید تکی" value={nf(counts.retail)}/>
    </div>
    <div className={card+' overflow-hidden'}>
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {([{key:'high_volume',label:'مشتریان خرید بالا',Icon:Building2},{key:'retail',label:'مشتریان خرید تکی',Icon:ShoppingBag}] as const).map(item=>
            <button key={item.key} type="button" onClick={()=>{setKind(item.key);setPage(1);}} className={'flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold transition '+(kind===item.key?'bg-[#55565A] text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200')}>
              <item.Icon className="h-4 w-4"/>{item.label}</button>)}
        </div>
        <label className="relative block w-full sm:max-w-xs"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/>
          <input className={field+' pr-10'} value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="نام، شرکت یا موبایل..." aria-label="جستجوی مشتری"/></label>
      </div>
      {loading ? <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/>دریافت اطلاعات واقعی...</div> : !rows.length ?
        <div className="flex min-h-52 flex-col items-center justify-center gap-2 p-5 text-center text-slate-500">
          <Users className="h-8 w-8 text-slate-300"/><b className="text-sm">مشتری ثبت‌شده‌ای برای این فیلتر یافت نشد.</b>
          <span className="text-xs">هنوز داده‌ای در این گروه وجود ندارد یا جستجو نتیجه‌ای نداشته است.</span>
        </div> : <>
        <div className="hidden overflow-x-auto lg:block"><table className="w-full min-w-[900px] text-right text-xs">
          <thead className="bg-slate-50 text-slate-500"><tr>
            {['مشتری / مجموعه','تماس','وضعیت دسترسی','سفارش معتبر','مجموع خرید','آخرین سفارش','عملیات'].map(h=><th key={h} className="px-4 py-3 font-bold">{h}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(c=><tr key={c.id} className="hover:bg-[#FFF9F3]">
              <td className="px-4 py-4"><div className="font-bold text-slate-800">{c.name}</div><div className="mt-1 text-slate-500">{c.company||'شخص حقیقی'}</div></td>
              <td className="px-4 py-4" dir="ltr">{c.phone||'—'}</td>
              <td className="px-4 py-4"><span className={'inline-flex rounded-lg px-2 py-1 font-bold '+(c.has_login?'bg-emerald-50 text-emerald-800':'bg-amber-50 text-amber-800')}>{c.has_login?'حساب ثبت‌نامی':'بدون حساب ورود'}</span></td>
              <td className="px-4 py-4">{nf(c.order_count)}</td>
              <td className="px-4 py-4 font-bold">{money(c.total_spent)}</td>
              <td className="px-4 py-4">{date(c.last_order_at)}</td>
              <td className="px-4 py-4"><div className="flex gap-2">
                <button onClick={()=>void openDetail(c.id)} className="flex items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 font-bold text-[#BF5719]"><Eye className="h-4 w-4"/>پرونده</button>
                <button onClick={()=>edit(c)} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700">ویرایش</button>
              </div></td>
            </tr>)}
          </tbody>
        </table></div>
        <div className="grid gap-3 p-3 lg:hidden">{rows.map(c=><div key={c.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3"><div><b className="text-sm text-slate-800">{c.name}</b><p className="mt-1 text-xs text-slate-500">{c.company||'شخص حقیقی'}</p></div>
            <span className="rounded-lg bg-orange-50 px-2 py-1 text-[10px] text-orange-700">{c.has_login?'ثبت‌نامی':'بدون ورود'}</span></div>
          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Phone className="h-4 w-4"/>{c.phone||'شماره ثبت نشده'}</div>
          <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-xs"><span>سفارش: {nf(c.order_count)}</span><b>{money(c.total_spent)}</b></div>
          <div className="mt-3 flex gap-2"><button onClick={()=>void openDetail(c.id)} className="flex-1 rounded-xl bg-[#FFF1E6] p-2.5 text-xs font-bold text-[#B45215]">مشاهده پرونده</button>
            <button onClick={()=>edit(c)} className="rounded-xl border border-slate-200 px-4 text-xs">ویرایش</button></div>
        </div>)}</div>
        </>}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span>{nf(total)} نتیجه · صفحه {nf(page)}</span>
        <div className="flex gap-2"><button disabled={page<=1} onClick={()=>setPage(n=>Math.max(1,n-1))} className="rounded-lg border p-2 disabled:opacity-30" aria-label="صفحه قبل"><ChevronRight className="h-4 w-4"/></button>
          <button disabled={page*25>=total} onClick={()=>setPage(n=>n+1)} className="rounded-lg border p-2 disabled:opacity-30" aria-label="صفحه بعد"><ChevronLeft className="h-4 w-4"/></button></div>
      </div>
    </div>

    {form && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1A2230]/60 p-3" role="dialog" aria-modal="true">
      <form onSubmit={save} className="max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4"><div><h3 className="text-lg font-black text-slate-800">{editing?'ویرایش مشتری':'تعریف مشتری جدید'}</h3>
          <p className="mt-1 text-xs text-slate-500">مشخصات در دیتابیس واقعی ثبت می‌شوند.</p></div>
          <button type="button" onClick={()=>{setForm(null);setEditing(null);}} aria-label="بستن"><X className="h-5 w-5"/></button></div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="نام و نام خانوادگی *" required value={form.name} onChange={v=>fieldSet('name',v)}/>
          <Input label="شرکت یا فروشگاه" value={form.company} onChange={v=>fieldSet('company',v)}/>
          <Input label="شماره موبایل *" required disabled={!!editing} value={form.phone} onChange={v=>fieldSet('phone',v)}/>
          <Input label="ایمیل" type="email" disabled={!!editing?.has_login} value={form.email} onChange={v=>fieldSet('email',v)}/>
          <Input label="استان" value={form.province} onChange={v=>fieldSet('province',v)}/>
          <Input label="شهر" value={form.city} onChange={v=>fieldSet('city',v)}/>
        </div>
        {!editing && <div className="mt-4"><div className="mb-2 text-xs font-bold text-slate-600">نوع مشتری</div>
          <div className="flex gap-3">
            <button type="button" onClick={()=>fieldSet('kind','retail')} className={'rounded-xl px-4 py-3 text-xs '+(form.kind==='retail'?'bg-[#E56B1E] text-white':'border border-slate-200')}>خرید تکی</button>
            <button type="button" onClick={()=>fieldSet('kind','high_volume')} className={'rounded-xl px-4 py-3 text-xs '+(form.kind==='high_volume'?'bg-[#E56B1E] text-white':'border border-slate-200')}>خرید بالا</button>
          </div>
          <p className="mt-2 text-xs leading-6 text-amber-700">ثبت مخاطب CRM به معنی ایجاد حساب ورود نیست؛ ورود به پنل تنها پس از ثبت‌نام و احراز هویت امکان‌پذیر است.</p>
        </div>}
        <label className="mt-4 block space-y-1.5"><span className="text-xs font-bold text-slate-600">یادداشت داخلی CRM</span>
          <textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#E56B1E]" maxLength={4000} value={form.notes} onChange={e=>fieldSet('notes',e.target.value)}/></label>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={()=>{setForm(null);setEditing(null);}} className="rounded-xl border border-slate-200 px-4 py-3 text-sm">انصراف</button>
          <button disabled={busy} className="flex items-center gap-2 rounded-xl bg-[#E56B1E] px-5 py-3 text-sm font-bold text-white disabled:opacity-60"><Save className="h-4 w-4"/>{busy?'در حال ثبت...':'ذخیره اطلاعات'}</button></div>
      </form>
    </div>}

    {detailsLoading && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1A2230]/50"><div className="rounded-2xl bg-white p-6 text-sm"><Loader2 className="ml-2 inline h-5 w-5 animate-spin"/>دریافت پرونده...</div></div>}
    {detail && <div className="fixed inset-0 z-[90] bg-[#1A2230]/60" role="dialog" aria-modal="true">
      <div className="mr-auto flex h-full w-full max-w-3xl flex-col bg-[#F7F8FA] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white p-4">
          <div><h3 className="text-lg font-black text-slate-800">{detail.customer.name}</h3><p className="mt-1 text-xs text-slate-500">{detail.customer.company||'مشتری حقیقی'}</p></div>
          <button className="rounded-lg border border-slate-200 p-2" aria-label="بستن پرونده" onClick={()=>setDetail(null)}><X className="h-5 w-5"/></button>
        </div>
        <div className="flex flex-wrap gap-2 border-b bg-white p-3">
          {([{key:'profile',label:'مشخصات',Icon:Users},{key:'orders',label:'سفارش‌ها',Icon:Package},{key:'finance',label:'گردش مالی',Icon:Wallet},{key:'tickets',label:'پشتیبانی',Icon:MessageCircle}] as const).map(t=>
            <button key={t.key} onClick={()=>setDetailTab(t.key)} className={'flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold '+(detailTab===t.key?'bg-[#55565A] text-white':'bg-slate-100 text-slate-600')}><t.Icon className="h-4 w-4"/>{t.label}</button>)}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {detailTab==='profile' && <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Metric label="تعداد سفارش تأییدشده" value={nf(detail.customer.order_count)} Icon={Package}/>
              <Metric label="مجموع خرید تأییدشده" value={money(detail.customer.total_spent)} Icon={ShoppingBag}/>
              <Metric label="سقف اعتبار ثبت‌شده" value={money(detail.customer.credit_limit)} Icon={Wallet}/>
            </div>
            <div className={card+' space-y-3 p-4'}>
              <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-orange-600"/><span className="text-sm">{detail.customer.phone||'شماره ثبت نشده'}</span></div>
              <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-orange-600"/><span className="text-sm">{[detail.customer.province,detail.customer.city].filter(Boolean).join('، ')||'محل ثبت نشده'}</span></div>
              <div className="flex items-center gap-2"><CalendarClock className="h-4 w-4 text-orange-600"/><span className="text-sm">آخرین سفارش: {date(detail.customer.last_order_at)}</span></div>
              <div className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-orange-600"/><span className="text-sm">{detail.customer.has_login?'حساب ورود متصل است':'حساب ورود هنوز به CRM متصل نیست'}</span></div>
              <div className="text-xs text-slate-500">گرید: {detail.customer.grade_code||'تخصیص نیافته'} · قیمت‌نامه: {detail.customer.assigned_price_list_id||'تخصیص نیافته'}</div>
              <div className="border-t pt-3 text-xs leading-6 text-slate-600">یادداشت داخلی: {detail.customer.notes||'یادداشتی ثبت نشده است.'}</div>
            </div>
            <div className="flex flex-wrap gap-2"><button onClick={()=>edit(detail.customer)} className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold">ویرایش مشخصات</button>
              <button disabled={busy} onClick={()=>void approval(detail.customer)} className="flex items-center gap-2 rounded-xl bg-[#E56B1E] px-4 py-3 text-xs font-bold text-white disabled:opacity-50">
                {detail.customer.approved_b2b?<ShieldAlert className="h-4 w-4"/>:<ShieldCheck className="h-4 w-4"/>}
                {detail.customer.approved_b2b?'تغییر به خرید تکی':'تأیید خرید بالا'}
              </button></div>
          </>}
          {detailTab==='orders' && <div className={card+' divide-y divide-slate-100 p-4'}>
            {detail.orders.length?detail.orders.map(o=><div key={o.id} className="flex flex-wrap justify-between gap-2 py-3 text-xs"><div><b className="text-slate-800">{o.id}</b><p className="mt-1 text-slate-500">{date(o.created_at)} · {o.status}</p></div><b>{orderMoney(o)}</b></div>)
              :<p className="py-6 text-center text-sm text-slate-500">سفارشی در دیتابیس ثبت نشده است.</p>}
          </div>}
          {detailTab==='finance' && <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="اعتبار مصرف‌شده" value={money(detail.customer.credit_used)} Icon={Wallet}/>
              <Metric label="بدهی ثبت‌شده" value={money(detail.customer.current_debt)} Icon={ClipboardList}/>
              <Metric label="سقف اعتبار" value={money(detail.customer.credit_limit)} Icon={ShieldCheck}/>
            </div>
            <div className={card+' divide-y divide-slate-100 p-4'}>
              {detail.finance.length?detail.finance.map(e=><div key={e.id} className="py-3 text-xs">
                <div className="flex justify-between gap-3"><b>{e.kind}</b><span>{date(e.created_at)}</span></div>
                <p className="mt-1 text-slate-600">{e.description||e.reference||'سند مالی'}</p>
                <p className="mt-1 text-slate-500">تغییر بدهی: {nf(e.debt_delta)} · کیف پول: {nf(e.wallet_delta)} · امتیاز: {nf(e.points_delta)}</p>
              </div>):<p className="py-6 text-center text-sm text-slate-500">سند گردش مالی ثبت نشده است.</p>}
            </div>
          </>}
          {detailTab==='tickets' && <div className={card+' divide-y divide-slate-100 p-4'}>
            {detail.tickets.length?detail.tickets.map(t=><div key={t.id} className="flex justify-between gap-3 py-3 text-xs"><div><b>{t.subject}</b><p className="mt-1 text-slate-500">{date(t.created_at)}</p></div><span>{t.status}</span></div>)
              :<p className="py-6 text-center text-sm text-slate-500">تیکت ثبت‌شده‌ای وجود ندارد.</p>}
          </div>}
          <div className="flex items-start gap-2 text-xs leading-6 text-slate-500"><Info className="mt-1 h-4 w-4 shrink-0"/>تمام اطلاعات این پرونده از پایگاه داده خوانده می‌شوند و مبالغ سفارش صرفاً از سفارش‌های معتبر محاسبه شده‌اند.</div>
        </div>
        <div className="border-t bg-white p-3"><button onClick={()=>setDetail(null)} className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs"><ArrowRight className="h-4 w-4"/>بازگشت به فهرست</button></div>
      </div>
    </div>}
  </div>;
};
