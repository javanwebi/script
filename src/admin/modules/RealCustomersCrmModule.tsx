import React, { useCallback, useEffect, useState } from 'react';
import { RealCrmTickets } from './RealCrmTickets';
import { RealCrmCommercialEditor } from './RealCrmCommercialEditor';
import { CustomerAccountAccessModal } from './CustomerAccountAccessModal';
import { emptyCustomerAccess, type NewCustomerAccessDraft } from './CustomerNewAccessFields';
import { CustomerCrmFormDialog, type CustomerCrmFormValues } from './CustomerCrmFormDialog';
import {
  Users, Building2, ShoppingBag, UserPlus, Search, RefreshCw, Eye,
  ShieldCheck, ShieldAlert, X, Save, ArrowRight, Phone, MapPin,
  FileText, Wallet, MessageCircle, Package, ChevronLeft, ChevronRight,
  ClipboardList, CalendarClock, BadgeCheck, Info, Loader2, Download, KeyRound, Copy
} from 'lucide-react';

type Customer = {
  id: string; source: 'crm' | 'profile'; crm_id: string | null; user_id: string | null;
  name: string; company: string | null; phone: string | null; username?:string|null; email: string | null;
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
type ImageEvent = {
  id: string; user_id: string; customer_name: string; company: string; phone: string;
  original_name: string; mime_type: string; file_size: number; recognition_status: string;
  detected_part_type: string | null; recognized_summary: string | null; selected_product_code: string | null;
  matched_product_codes: string[]; similar_product_codes: string[]; created_at: string;
};
type Consultation = {
  id: string; title: string; summary: string; status: string; messages: Array<{id:string;role:string;text:string}>;
  product_codes: string[]; message_count: number; started_at: string; last_message_at: string;
};
type PurchasePeriod = { period: string; order_count: number; total: number | string };
type TopProduct = { product_code: string; product_name: string; quantity: number | string; revenue: number | string; order_count: number };
type ProductInterest = { product_code: string; product_name: string; interaction_count: number; first_seen_at: string; last_seen_at: string };
type Followup = { id: string; title: string; notes: string; status: string; due_at: string | null; completed_at: string | null; created_at: string; assigned_staff_name: string };
type Detail = {
  customer: Customer; orders: Order[]; finance: Entry[]; tickets: Ticket[];
  intelligenceEnabled?: boolean;
  imageEvents: ImageEvent[]; consultations: Consultation[]; productInterests: ProductInterest[];
  monthlyPurchases: PurchasePeriod[]; yearlyPurchases: PurchasePeriod[]; topProducts: TopProduct[]; followups: Followup[];
};
type FormValues = CustomerCrmFormValues;
const emptyForm = (kind: FormValues['kind']): FormValues => ({ name:'',company:'',phone:'',email:'',province:'',city:'',notes:'',kind });
const nf = (value: number | string | null | undefined) => new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 0 }).format(Number(value || 0));
const money = (value: number | string | null | undefined) => nf(value) + ' تومان';
const date = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString('fa-IR') : 'ثبت نشده';
const orderMoney = (o: Order) => money(Number(o.final_amount && Number(o.final_amount) !== 0 ? o.final_amount : o.total_amount || 0) / (o.currency === 'IRR' ? 10 : 1));
const card = 'rounded-2xl border border-[#ECEEF0] bg-white shadow-[0_4px_24px_rgba(32,40,52,.03)]';
const field = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-[#E56B1E] focus:ring-2 focus:ring-[#E56B1E]/10';
async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...init, credentials:'same-origin', cache:'no-store', headers: { 'Content-Type':'application/json', ...(init?.headers || {}) } });
  const json = await response.json().catch(() => ({ success:false, message:'پاسخ سرور معتبر نیست.' }));
  if (!response.ok || !json.success) throw new Error(json.message || 'درخواست به نتیجه نرسید.');
  return json as T;
}
function Metric({label,value,Icon}:{label:string;value:string;Icon:React.ElementType}) {
  return <div className={card+' flex min-w-0 items-center gap-3 p-4'}>
    <div className="rounded-2xl bg-[#FFF1E6] p-3 text-[#E56B1E]"><Icon className="h-5 w-5"/></div>
    <div className="min-w-0"><div className="text-[11px] font-bold text-slate-500">{label}</div>
      <div className="mt-1 text-xl font-black tabular-nums text-[#34363B]">{value}</div></div>
  </div>;
}

export const RealCustomersCrmModule: React.FC = () => {
  const [kind,setKind] = useState<'retail'|'high_volume'>('retail');
  const [section,setSection] = useState<'customers'|'tickets'|'images'>('customers');
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
  const [detailTab,setDetailTab] = useState<'profile'|'orders'|'finance'|'tickets'|'images'|'consultations'|'purchases'|'followups'>('profile');
  const [imageRows,setImageRows] = useState<ImageEvent[]>([]);
  const [imagesLoading,setImagesLoading] = useState(false);
  const [imageFeatureEnabled,setImageFeatureEnabled] = useState(true);
  const [imageQuery,setImageQuery] = useState('');
  const [followupTitle,setFollowupTitle] = useState('');
  const [followupNotes,setFollowupNotes] = useState('');
  const [followupDueAt,setFollowupDueAt] = useState('');
  const [followupSaving,setFollowupSaving] = useState(false);
  const [detailsLoading,setDetailsLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  const [exporting,setExporting] = useState(false);
  const [commercial,setCommercial] = useState<Customer|null>(null);
  const [accessCustomer,setAccessCustomer] = useState<Customer|null>(null);
  const [canManageAccess,setCanManageAccess] = useState(false);
  const [smsConfigured,setSmsConfigured] = useState(false);
  const [newAccess,setNewAccess] = useState<NewCustomerAccessDraft>(emptyCustomerAccess);
  const [issued,setIssued] = useState<{username:string;password:string;preview:string;smsSent:boolean;smsWarning?:string}|null>(null);
  useEffect(()=>{
    let live=true;
    void fetch('/api/admin/crm/credentials/config',{credentials:'same-origin',cache:'no-store'})
      .then(async r=>{
        const config=r.ok?await r.json():null;
        if(!live)return;
        setCanManageAccess(r.ok);
        setSmsConfigured(config?.smsConfigured===true);
      }).catch(()=>{if(live){setCanManageAccess(false);setSmsConfigured(false);}});
    return ()=>{live=false;};
  },[]);

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
  useEffect(()=>{
    if(section!=='images')return;
    const controller=new AbortController();
    const timer=window.setTimeout(async()=>{
      try{
        setImagesLoading(true);
        const response=await fetch('/api/admin/crm/images?limit=250&q='+encodeURIComponent(imageQuery),{
          credentials:'same-origin',cache:'no-store',signal:controller.signal
        });
        const data=await response.json().catch(()=>({success:false,message:'پاسخ سرور معتبر نیست.'}));
        if(!response.ok||!data.success)throw new Error(data.message||'دریافت تاریخچه تصاویر ممکن نشد.');
        if(!controller.signal.aborted){setImageRows(data.rows||[]);setImageFeatureEnabled(data.enabled!==false);}
      }catch(error){
        if(!controller.signal.aborted)setError(error instanceof Error?error.message:'دریافت تصاویر ناموفق بود.');
      }finally{if(!controller.signal.aborted)setImagesLoading(false);}
    },imageQuery?250:0);
    return ()=>{controller.abort();window.clearTimeout(timer);};
  },[section,imageQuery,revision]);

  const createFollowup = async () => {
    if(!detail || followupTitle.trim().length<2)return;
    setFollowupSaving(true);
    try{
      await api('/api/admin/crm/customers/'+encodeURIComponent(detail.customer.id)+'/followups',{
        method:'POST',body:JSON.stringify({title:followupTitle,notes:followupNotes,dueAt:followupDueAt||null})
      });
      setFollowupTitle('');setFollowupNotes('');setFollowupDueAt('');
      setNotice('پیگیری مشتری ثبت شد.');
      await openDetail(detail.customer.id);
      setDetailTab('followups');
    }catch(error){setError(error instanceof Error?error.message:'ثبت پیگیری ناموفق بود.');}
    finally{setFollowupSaving(false);}
  };

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
    if(!editing && newAccess.enabled){
      if(!canManageAccess){setError('ساخت حساب فقط برای مدیر اصلی فعال است.');return;}
      if(!/^[a-z][a-z0-9_]{3,31}$/.test(newAccess.username.trim().toLowerCase())){setError('نام کاربری باید ۴ تا ۳۲ نویسه انگلیسی و با حرف شروع شود.');return;}
      if(newAccess.password.length<12 || newAccess.password.length>128){setError('رمز اولیه باید بین ۱۲ تا ۱۲۸ نویسه باشد.');return;}
      if(!newAccess.confirmedPhone){setError('مالکیت شماره مشتری را تأیید کنید.');return;}
      if(newAccess.sendSms && (!smsConfigured || !newAccess.messageTemplate.includes('{username}') || !newAccess.messageTemplate.includes('{password}'))){
        setError('متن پیامک باید نام کاربری و رمز داشته باشد و SMS.ir فعال باشد.');return;
      }
    }
    setBusy(true);setError('');
    try {
      let updatedId=editing?.id;
      if (editing) {
        const result=await api<{id?:string}>('/api/admin/crm/customers/'+encodeURIComponent(editing.id),{method:'PATCH',body:JSON.stringify(form)});
        updatedId=result.id || editing.id;
        setNotice('اطلاعات واقعی مشتری ذخیره شد.');
      } else {
        const created=await api<{id:string;message:string}>('/api/admin/crm/customers',{method:'POST',body:JSON.stringify(form)});
        updatedId=created.id;
        setNotice(created.message);
        if(newAccess.enabled){
          try{
            const result=await api<{username:string;smsSent:boolean;smsWarning?:string}>('/api/admin/crm/customers/'+encodeURIComponent(created.id)+'/credentials',{
              method:'POST',body:JSON.stringify({operation:'create',username:newAccess.username.trim().toLowerCase(),
                password:newAccess.password,sendSms:newAccess.sendSms,messageTemplate:newAccess.messageTemplate})
            });
            const preview=newAccess.messageTemplate.replace(/\{(username|password|smsName|loginUrl)\}/g,(_match,key)=>
              ({username:result.username,password:newAccess.password,smsName:form.name,
                loginUrl:'https://www.sanatpish.com/login'} as Record<string,string>)[key]||'');
            setIssued({username:result.username,password:newAccess.password,preview,smsSent:result.smsSent,smsWarning:result.smsWarning});
            setNotice('مشتری و حساب ورود واقعی او ساخته شدند.');
          }catch(e){
            // Contact is saved already; never retry its creation or duplicate customer records.
            setNotice('مشتری ثبت شد، اما حساب ورود ایجاد نشد. از پرونده او دوباره اقدام کنید.');
            setError('ساخت حساب ورود ناموفق بود: '+(e instanceof Error?e.message:'خطای سرویس ورود'));
          }
        }
      }
      setForm(null);setEditing(null);setNewAccess(emptyCustomerAccess());refresh();
      if(updatedId && detail) await openDetail(updatedId);
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
  const exportData=async()=>{
    try{
      setExporting(true);setError('');
      const response=await fetch('/api/admin/crm/export?kind='+kind,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok){
        const data=await response.json().catch(()=>({message:'دریافت خروجی با خطا مواجه شد.'}));
        throw new Error(data.message||'دریافت فایل ممکن نشد.');
      }
      const blob=await response.blob();
      const url=window.URL.createObjectURL(blob);
      const a=document.createElement('a');a.href=url;a.download='sanatpish-crm-'+kind+'.csv';
      document.body.appendChild(a);a.click();a.remove();
      window.URL.revokeObjectURL(url);
    }catch(e){setError(e instanceof Error?e.message:'دریافت اطلاعات ناموفق بود.');}
    finally{setExporting(false);}
  };
  return <div dir="rtl" className="space-y-5 pb-10 text-right">
    <div className={card+' flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'}>
      <div><div className="flex items-center gap-2"><Users className="h-6 w-6 text-[#E56B1E]"/>
        <h2 className="text-lg font-black text-[#34363B] sm:text-xl">مشتریان و مدیریت ارتباط با مشتری (CRM)</h2></div>
        <p className="mt-2 text-xs leading-6 text-slate-500">ثبت‌نام‌های تأییدشده سایت در «خرید تکی» نمایش داده می‌شوند؛ می‌توان نوع پنل را تغییر داد و نام کاربری و رمز اختصاص داد.</p>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={refresh} aria-label="بارگذاری مجدد" className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50"><RefreshCw className="h-5 w-5"/></button>
        <button type="button" disabled={exporting} onClick={()=>void exportData()} className="flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-3 text-xs font-bold text-orange-700 disabled:opacity-50"><Download className="h-4 w-4"/>{exporting?'دریافت...':'خروجی CSV واقعی'}</button>
        <button type="button" onClick={()=>{setEditing(null);setForm(emptyForm(kind));setNewAccess(emptyCustomerAccess());setError('');}} className="flex items-center gap-2 rounded-xl bg-[#E56B1E] px-4 py-3 text-sm font-bold text-white hover:bg-[#CC5812]"><UserPlus className="h-4 w-4"/>افزودن مشتری</button>
      </div>
    </div>
    <nav className="flex flex-wrap gap-2" aria-label="بخش‌های مدیریت مشتریان">
      <button type="button" onClick={()=>setSection('customers')} className={'rounded-xl px-4 py-2.5 text-sm font-bold '+(section==='customers'?'bg-[#55565A] text-white':'border border-slate-200 bg-white text-slate-700')}>مشتریان خرید تکی و بالا</button>
      <button type="button" onClick={()=>setSection('tickets')} className={'rounded-xl px-4 py-2.5 text-sm font-bold '+(section==='tickets'?'bg-[#55565A] text-white':'border border-slate-200 bg-white text-slate-700')}>تیکت‌های پشتیبانی</button>
      <button type="button" onClick={()=>setSection('images')} className={'rounded-xl px-4 py-2.5 text-sm font-bold '+(section==='images'?'bg-[#55565A] text-white':'border border-slate-200 bg-white text-slate-700')}>تاریخچه تصاویر شناسایی</button>
    </nav>
    {section === 'tickets' ? <RealCrmTickets/> : section === 'images' ? <>
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className={card+' space-y-3 p-4'}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-black text-slate-800">تصاویر ارسالی مشتریان برای شناسایی</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">فایل اصلی فقط روی دستگاه مشتری نگهداری می‌شود؛ این صفحه فقط فراداده و نتیجه شناسایی را نمایش می‌دهد.</p></div>
          <label className="relative block w-full sm:max-w-xs"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/>
            <input className={field+' pr-10'} value={imageQuery} onChange={event=>setImageQuery(event.target.value)} placeholder="نام، شرکت، موبایل یا کد محصول..." aria-label="جستجوی تاریخچه تصاویر"/></label>
        </div>
        {!imageFeatureEnabled ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">این قابلیت پس از بررسی مهاجرت دیتابیس و فعال‌سازی کنترل‌شده CUSTOMER_360_LOCAL_VAULT_ENABLED در دسترس قرار می‌گیرد.</div> :
        imagesLoading ? <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/>دریافت سوابق شناسایی...</div> :
          imageRows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr>{['مشتری','مجموعه / تماس','تاریخ ارسال','نوع قطعه','کد انتخابی','وضعیت','پرونده'].map(label=><th key={label} className="px-3 py-3">{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{imageRows.map(row=><tr key={row.id} className="hover:bg-orange-50/50">
              <td className="px-3 py-3 font-bold text-slate-800">{row.customer_name}</td>
              <td className="px-3 py-3"><div>{row.company||'—'}</div><div className="mt-1 text-slate-500" dir="ltr">{row.phone}</div></td>
              <td className="px-3 py-3">{date(row.created_at)}</td>
              <td className="px-3 py-3">{row.detected_part_type||'در انتظار شناسایی'}</td>
              <td className="px-3 py-3 font-bold" dir="ltr">{row.selected_product_code||'—'}</td>
              <td className="px-3 py-3">{row.recognition_status}</td>
              <td className="px-3 py-3"><button type="button" onClick={()=>void openDetail('profile:'+row.user_id)} className="rounded-lg bg-orange-50 px-3 py-2 font-bold text-orange-700">پرونده مشتری</button></td>
            </tr>)}</tbody>
          </table></div> : <div className="py-10 text-center text-sm text-slate-500">هنوز سابقه شناسایی ثبت نشده است.</div>}
      </div>
    </> : <>
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
                 {canManageAccess && <button onClick={()=>setAccessCustomer(c)} className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 font-bold text-orange-700"><KeyRound className="h-4 w-4"/>{c.has_login?'مدیریت ورود':'ساخت پنل'}</button>}
                 <button disabled={busy} onClick={()=>void approval(c)} className="rounded-lg border border-slate-200 px-3 py-2 text-slate-700 disabled:opacity-50">{c.approved_b2b?'انتقال به خرید تکی':'انتقال به خرید بالا'}</button>
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
            <button onClick={()=>edit(c)} className="rounded-xl border border-slate-200 px-4 text-xs">ویرایش</button>
             {canManageAccess && <button onClick={()=>setAccessCustomer(c)} className="rounded-xl border border-orange-200 px-3 text-xs font-bold text-orange-700">{c.has_login?'رمز':'ساخت پنل'}</button>}
             <button disabled={busy} onClick={()=>void approval(c)} className="rounded-xl border border-slate-200 px-3 text-xs disabled:opacity-50">{c.approved_b2b?'خرید تکی':'خرید بالا'}</button></div>
        </div>)}</div>
        </>}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        <span>{nf(total)} نتیجه · صفحه {nf(page)}</span>
        <div className="flex gap-2"><button disabled={page<=1} onClick={()=>setPage(n=>Math.max(1,n-1))} className="rounded-lg border p-2 disabled:opacity-30" aria-label="صفحه قبل"><ChevronRight className="h-4 w-4"/></button>
          <button disabled={page*25>=total} onClick={()=>setPage(n=>n+1)} className="rounded-lg border p-2 disabled:opacity-30" aria-label="صفحه بعد"><ChevronLeft className="h-4 w-4"/></button></div>
      </div>
    </div>

    {form && <CustomerCrmFormDialog
      form={form} editing={editing} access={newAccess} canManageAccess={canManageAccess}
      smsConfigured={smsConfigured} busy={busy} error={error}
      onChange={setForm} onAccessChange={setNewAccess} onSubmit={save}
      onClose={()=>{setForm(null);setEditing(null);setError('');}}
      onManageAccess={()=>{if(editing){setAccessCustomer(editing);setForm(null);setEditing(null);}}}
    />}

    {issued && <div className="fixed inset-0 z-[145] flex items-center justify-center bg-slate-950/70 p-3" role="dialog" aria-modal="true" aria-label="اطلاعات حساب ایجادشده">
       <div className="max-h-[90dvh] w-full max-w-xl space-y-4 overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
         <h3 className="text-lg font-black text-emerald-700">حساب ورود مشتری با موفقیت ایجاد شد.</h3>
         <p className="text-xs leading-6 text-slate-600">رمز موقت فقط در همین صفحه نمایش داده می‌شود و پس از بستن قابل بازیابی نیست.</p>
         <div className="rounded-xl bg-slate-50 p-3 text-sm"><div>نام کاربری: <b dir="ltr" className="select-all">{issued.username}</b></div>
           <div className="mt-2">رمز اولیه: <b dir="ltr" className="select-all">{issued.password}</b></div></div>
         {issued.smsSent && <p className="text-xs text-emerald-700">درخواست SMS.ir پذیرفته شد؛ تحویل قطعی نیازمند گزارش اپراتور است.</p>}
         {issued.smsWarning && <p className="text-xs text-amber-700">{issued.smsWarning}</p>}
         <pre dir="rtl" className="whitespace-pre-wrap rounded-xl border border-slate-200 p-3 font-sans text-xs leading-7">{issued.preview}</pre>
         <div className="flex flex-wrap justify-end gap-2">
           <button type="button" onClick={()=>void navigator.clipboard.writeText(issued.preview).catch(()=>setError('کپی خودکار انجام نشد.'))} className="flex items-center gap-2 rounded-xl border border-orange-200 px-4 py-2.5 text-xs text-orange-700"><Copy className="h-4 w-4"/>کپی متن</button>
           <button type="button" onClick={()=>setIssued(null)} className="rounded-xl bg-[#E56B1E] px-4 py-2.5 text-xs font-bold text-white">پایان</button>
         </div>
       </div>
     </div>}
     {accessCustomer && <CustomerAccountAccessModal customer={accessCustomer} onClose={()=>setAccessCustomer(null)}
      onSaved={()=>{setNotice('اطلاعات حساب ورود مشتری در Supabase Auth ذخیره شد.');refresh();void openDetail(accessCustomer.id);}}/>}
    {commercial && <RealCrmCommercialEditor customer={commercial} onClose={()=>setCommercial(null)} onSaved={()=>{const id=commercial.id;setCommercial(null);setNotice('شرایط تجاری واقعی مشتری ذخیره شد.');refresh();void openDetail(id);}}/>}
    {detailsLoading && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#1A2230]/50"><div className="rounded-2xl bg-white p-6 text-sm"><Loader2 className="ml-2 inline h-5 w-5 animate-spin"/>دریافت پرونده...</div></div>}
    {detail && <div className="fixed inset-0 z-[90] bg-[#1A2230]/60" role="dialog" aria-modal="true">
      <div className="mr-auto flex h-full w-full max-w-3xl flex-col bg-[#F7F8FA] shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-white p-4">
          <div><h3 className="text-lg font-black text-slate-800">{detail.customer.name}</h3><p className="mt-1 text-xs text-slate-500">{detail.customer.company||'مشتری حقیقی'}</p></div>
          <button className="rounded-lg border border-slate-200 p-2" aria-label="بستن پرونده" onClick={()=>setDetail(null)}><X className="h-5 w-5"/></button>
        </div>
        <div className="flex flex-wrap gap-2 border-b bg-white p-3">
          {([
            {key:'profile',label:'مشخصات',Icon:Users},
            {key:'orders',label:'سفارش‌ها',Icon:Package},
            {key:'purchases',label:'تحلیل خرید',Icon:ShoppingBag},
            {key:'images',label:'تصاویر AI',Icon:Eye},
            {key:'consultations',label:'مشاوره FORZA',Icon:MessageCircle},
            {key:'followups',label:'پیگیری‌ها',Icon:CalendarClock},
            {key:'finance',label:'گردش مالی',Icon:Wallet},
            {key:'tickets',label:'پشتیبانی',Icon:FileText}
          ] as const).map(t=>
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
              </button>
              {canManageAccess && <button onClick={()=>setAccessCustomer(detail.customer)}
                className="flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-3 text-xs font-bold text-[#A64B14]">
                {detail.customer.has_login?'مدیریت نام کاربری و بازنشانی رمز':'ساخت نام کاربری، رمز و فعال‌سازی پنل'}
              </button>}
              {detail.customer.approved_b2b && <button onClick={()=>setCommercial(detail.customer)} className="rounded-xl border border-orange-200 bg-white px-4 py-3 text-xs font-bold text-orange-700">تنظیم گرید، قیمت‌نامه و اعتبار</button>}
            </div>
          </>}
          {detailTab==='orders' && <div className={card+' divide-y divide-slate-100 p-4'}>
            {detail.orders.length?detail.orders.map(o=><div key={o.id} className="flex flex-wrap justify-between gap-2 py-3 text-xs"><div><b className="text-slate-800">{o.id}</b><p className="mt-1 text-slate-500">{date(o.created_at)} · {o.status}</p></div><b>{orderMoney(o)}</b></div>)
              :<p className="py-6 text-center text-sm text-slate-500">سفارشی در دیتابیس ثبت نشده است.</p>}
          </div>}
          {detailTab==='purchases' && <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Metric label="خرید در آخرین ماه ثبت‌شده" value={detail.monthlyPurchases[0]?money(detail.monthlyPurchases[0].total):'بدون سابقه'} Icon={ShoppingBag}/>
              <Metric label="خرید در آخرین سال ثبت‌شده" value={detail.yearlyPurchases[0]?money(detail.yearlyPurchases[0].total):'بدون سابقه'} Icon={CalendarClock}/>
            </div>
            <div className={card+' p-4'}>
              <h4 className="mb-3 text-sm font-black text-slate-800">روند خرید ماهانه</h4>
              {detail.monthlyPurchases.length ? detail.monthlyPurchases.map(item=><div key={item.period} className="flex justify-between gap-3 border-b border-slate-100 py-2.5 text-xs last:border-0">
                <span>{item.period} · {nf(item.order_count)} سفارش</span><b>{money(item.total)}</b>
              </div>) : <p className="py-5 text-center text-xs text-slate-500">خرید معتبری در ماه‌های ثبت‌شده وجود ندارد.</p>}
            </div>
            <div className={card+' p-4'}>
              <h4 className="mb-3 text-sm font-black text-slate-800">روند خرید سالانه</h4>
              {detail.yearlyPurchases.length ? detail.yearlyPurchases.map(item=><div key={item.period} className="flex justify-between gap-3 border-b border-slate-100 py-2.5 text-xs last:border-0">
                <span>{item.period} · {nf(item.order_count)} سفارش</span><b>{money(item.total)}</b>
              </div>) : <p className="py-5 text-center text-xs text-slate-500">خرید معتبری در سال‌های ثبت‌شده وجود ندارد.</p>}
            </div>
            <div className={card+' p-4'}>
              <h4 className="mb-3 text-sm font-black text-slate-800">محصولات پرتکرار مشتری</h4>
              {detail.topProducts.length ? detail.topProducts.map(item=><div key={item.product_code} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-3 text-xs last:border-0">
                <div><b>{item.product_name}</b><p className="mt-1 text-slate-500" dir="ltr">{item.product_code} · {nf(item.order_count)} سفارش</p></div>
                <div className="text-left"><b>{nf(item.quantity)} عدد</b><p className="mt-1 text-slate-500">{money(item.revenue)}</p></div>
              </div>) : <p className="py-5 text-center text-xs text-slate-500">هنوز اقلام سفارش قابل تحلیل ثبت نشده‌اند.</p>}
            </div>
          </>}
          {detailTab==='images' && <div className={card+' space-y-3 p-4'}>
            {!detail.intelligenceEnabled && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">ثبت سوابق تصویری پس از بررسی و اعمال مهاجرت دیتابیس و فعال‌سازی پرچم قابلیت انجام می‌شود.</div>}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-6 text-slate-600">
              فایل اصلی و برش تصویر فقط در حافظه محلی دستگاه مشتری نگهداری می‌شوند. این پرونده فقط اطلاعات شناسایی و کدهای محصول را نشان می‌دهد و امکان مشاهده یا دانلود تصویر را ندارد.
            </div>
            {detail.imageEvents.length ? detail.imageEvents.map(item=><div key={item.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><b className="text-sm text-slate-800">{item.detected_part_type||'قطعه شناسایی‌نشده'}</b>
                  <p className="mt-1 text-[11px] text-slate-500">{item.original_name||'تصویر مشتری'} · {date(item.created_at)}</p></div>
                <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{item.recognition_status}</span>
              </div>
              {item.recognized_summary && <p className="mt-2 text-xs leading-6 text-slate-600">{item.recognized_summary}</p>}
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                {item.selected_product_code && <span className="rounded-lg bg-emerald-50 px-2 py-1 font-bold text-emerald-700">انتخاب: {item.selected_product_code}</span>}
                {(item.matched_product_codes||[]).map(code=><span key={'m-'+code} dir="ltr" className="rounded-lg bg-orange-50 px-2 py-1 text-orange-700">تطبیق {code}</span>)}
                {(item.similar_product_codes||[]).map(code=><span key={'s-'+code} dir="ltr" className="rounded-lg bg-slate-100 px-2 py-1 text-slate-600">مشابه {code}</span>)}
              </div>
              <p className="mt-2 text-[10px] text-slate-400">اثر انگشت: {item.image_sha256.slice(0,16)}… · حجم: {nf(item.file_size)} بایت</p>
            </div>) : <p className="py-6 text-center text-sm text-slate-500">تصویر شناسایی ثبت‌شده‌ای برای این مشتری وجود ندارد.</p>}
          </div>}
          {detailTab==='consultations' && <div className="space-y-3">
            {!detail.intelligenceEnabled && <div className={card+' p-4 text-xs leading-6 text-amber-800'}>ذخیره تاریخچه FORZA پس از اعمال مهاجرت دیتابیس و فعال‌سازی قابلیت Customer 360 فعال می‌شود.</div>}
            {detail.consultations.length ? detail.consultations.map(session=><div key={session.id} className={card+' space-y-3 p-4'}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div><b className="text-sm text-slate-800">{session.title||'مشاوره فنی FORZA'}</b>
                  <p className="mt-1 text-[11px] text-slate-500">شروع: {date(session.started_at)} · آخرین فعالیت: {date(session.last_message_at)}</p></div>
                <span className="rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">{nf(session.message_count)} پیام</span>
              </div>
              {session.summary && <div className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700"><b className="mb-1 block">خلاصه آخرین پاسخ FORZA</b>{session.summary}</div>}
              {(session.product_codes||[]).length>0 && <div className="flex flex-wrap gap-1.5">{session.product_codes.map(code=><span key={code} dir="ltr" className="rounded-lg bg-orange-50 px-2 py-1 text-[10px] font-bold text-orange-700">{code}</span>)}</div>}
              <details className="rounded-xl border border-slate-200 p-3">
                <summary className="cursor-pointer text-xs font-bold text-slate-600">نمایش متن مکالمه</summary>
                <div className="mt-3 space-y-2">{(session.messages||[]).slice(-20).map(message=><div key={message.id} className={'rounded-xl p-2.5 text-xs leading-6 '+(message.role==='assistant'?'bg-orange-50 text-slate-700':'bg-slate-50 text-slate-700')}>
                  <b className="mb-1 block text-[10px]">{message.role==='assistant'?'FORZA':'مشتری'}</b>{message.text}
                </div>)}</div>
              </details>
            </div>) : <div className={card+' py-8 text-center text-sm text-slate-500'}>هنوز جلسه مشاوره ثبت‌شده‌ای وجود ندارد.</div>}
            {detail.productInterests.length>0 && <div className={card+' p-4'}>
              <h4 className="mb-3 text-sm font-black text-slate-800">علاقه‌مندی‌های ثبت‌شده از مشاوره</h4>
              <div className="flex flex-wrap gap-2">{detail.productInterests.map(item=><span key={item.product_code} className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs">{item.product_code} · {nf(item.interaction_count)} بار</span>)}</div>
            </div>}
          </div>}
          {detailTab==='followups' && <>
            {!detail.intelligenceEnabled ? <div className={card+' p-4 text-xs leading-6 text-amber-800'}>مدیریت پیگیری‌ها پس از اعمال مهاجرت دیتابیس و فعال‌سازی قابلیت Customer 360 در دسترس قرار می‌گیرد.</div> : <>
            <div className={card+' space-y-3 p-4'}>
              <h4 className="text-sm font-black text-slate-800">ثبت پیگیری جدید</h4>
              <input className={field} value={followupTitle} onChange={event=>setFollowupTitle(event.target.value)} placeholder="عنوان پیگیری؛ مثلاً تماس درباره استعلام بلبرینگ"/>
              <textarea className="min-h-20 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#E56B1E]" value={followupNotes} onChange={event=>setFollowupNotes(event.target.value)} placeholder="یادداشت کارشناس و اقدام موردنیاز..."/>
              <label className="block text-xs text-slate-500">زمان پیگیری<input type="datetime-local" className={field+' mt-1'} value={followupDueAt} onChange={event=>setFollowupDueAt(event.target.value)}/></label>
              <button type="button" disabled={followupSaving||followupTitle.trim().length<2} onClick={()=>void createFollowup()} className="rounded-xl bg-[#E56B1E] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{followupSaving?'در حال ثبت...':'ثبت پیگیری مشتری'}</button>
            </div>
            <div className={card+' divide-y divide-slate-100 p-4'}>
              <h4 className="mb-2 text-sm font-black text-slate-800">سوابق پیگیری</h4>
              {detail.followups.length ? detail.followups.map(item=><div key={item.id} className="py-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2"><b>{item.title}</b><span className="rounded-lg bg-slate-100 px-2 py-1">{item.status}</span></div>
                {item.notes && <p className="mt-2 leading-6 text-slate-600">{item.notes}</p>}
                <div className="mt-2 flex flex-wrap justify-between gap-2 text-[10px] text-slate-500"><span>موعد: {item.due_at?new Date(item.due_at).toLocaleString('fa-IR'):'تعیین نشده'}</span><span>مسئول: {item.assigned_staff_name||'تخصیص نیافته'}</span></div>
                {item.status!=='completed' && item.status!=='cancelled' && <button type="button" onClick={async()=>{try{await api('/api/admin/crm/followups/'+encodeURIComponent(item.id),{method:'PATCH',body:JSON.stringify({status:'completed'})});await openDetail(detail.customer.id);setDetailTab('followups');}catch(error){setError(error instanceof Error?error.message:'به‌روزرسانی پیگیری ناموفق بود.');}}} className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[10px] font-bold text-emerald-700">علامت‌گذاری به‌عنوان انجام‌شده</button>}
              </div>) : <p className="py-5 text-center text-xs text-slate-500">پیگیری‌ای ثبت نشده است.</p>}
            </div>
            </>}
          </>}
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
    </>}
  </div>;
};
