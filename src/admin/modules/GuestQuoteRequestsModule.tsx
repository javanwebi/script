import React, { useCallback, useEffect, useState } from 'react';
import { Archive, BellRing, CheckCircle2, Clock3, PackageCheck, RefreshCw, Send, Warehouse } from 'lucide-react';

type WarehouseStatus = 'pending' | 'available' | 'partial' | 'unavailable';
type GuestQuoteItem = {
 id: string;
 productCode: string;
 productName: string;
 unit: string;
 quantity: number;
 warehouseStatus: WarehouseStatus;
 availableQuantity?: number | null;
 warehouseNote?: string | null;
};
type GuestQuoteRequest = {
 id: string;
 requestNumber: string | number;
 status: 'new' | 'sent_to_warehouse' | 'warehouse_reviewing' | 'warehouse_returned' | 'completed' | 'cancelled';
 createdAt: string;
 sentToWarehouseAt?: string | null;
 warehouseCompletedAt?: string | null;
 items: GuestQuoteItem[];
};

const nf = (value: number | string) => Number(value || 0).toLocaleString('fa-IR');
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
const statusLabel: Record<GuestQuoteRequest['status'], string> = {
 new: 'درخواست جدید',
 sent_to_warehouse: 'ارسال‌شده به انبار',
 warehouse_reviewing: 'در حال بررسی انبار',
 warehouse_returned: 'نتیجه انبار دریافت شد',
 completed: 'تکمیل‌شده',
 cancelled: 'لغوشده',
};
const stockLabel: Record<WarehouseStatus, string> = {
 pending: 'بررسی نشده',
 available: 'موجود',
 partial: 'موجودی ناکافی',
 unavailable: 'ناموجود',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
 const headers = new Headers(init?.headers);
 if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
 const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init, headers });
 const data = await response.json().catch(() => ({}));
 if (!response.ok || !data.success) throw new Error(data.message || 'دریافت اطلاعات انجام نشد.');
 return data as T;
}

export const GuestQuoteRequestsModule: React.FC = () => {
 const [requests, setRequests] = useState<GuestQuoteRequest[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState('');
 const [busyId, setBusyId] = useState('');
 const [filter, setFilter] = useState<'all' | GuestQuoteRequest['status']>('all');

 const load = useCallback(async (silent = false) => {
  if (!silent) setLoading(true);
  try {
   const data = await api<{ requests: GuestQuoteRequest[] }>('/api/admin/guest-quote-requests');
   setRequests(Array.isArray(data.requests) ? data.requests : []);
   setError('');
  } catch (e) {
   setError(e instanceof Error ? e.message : 'دریافت درخواست‌ها ناموفق بود.');
  } finally {
   if (!silent) setLoading(false);
  }
 }, []);

 useEffect(() => {
  void load();
  const events = new EventSource('/api/admin/guest-quote-requests/events', { withCredentials: true });
  events.addEventListener('guest-quote-updated', () => { void load(true); });
  const poll = window.setInterval(() => { void load(true); }, 15000);
  const onFocus = () => { void load(true); };
  window.addEventListener('focus', onFocus);
  return () => { events.close(); window.clearInterval(poll); window.removeEventListener('focus', onFocus); };
 }, [load]);

 const runAction = async (request: GuestQuoteRequest, action: 'send-to-warehouse' | 'complete') => {
  setBusyId(request.id);
  setError('');
  try {
   await api(`/api/admin/guest-quote-requests/${request.id}/${action}`, { method: 'POST', body: '{}' });
   await load(true);
  } catch (e) {
   setError(e instanceof Error ? e.message : 'عملیات انجام نشد.');
  } finally {
   setBusyId('');
  }
 };

 const filtered = filter === 'all' ? requests : requests.filter(item => item.status === filter);
 const newCount = requests.filter(item => item.status === 'new').length;
 const warehouseCount = requests.filter(item => item.status === 'sent_to_warehouse' || item.status === 'warehouse_reviewing').length;
 const returnedCount = requests.filter(item => item.status === 'warehouse_returned').length;

 return (
  <div className="space-y-5 text-right" dir="rtl">
   <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
    <div>
     <div className="flex items-center gap-2 text-[#E06518]"><BellRing size={18}/><span className="text-xs font-black">درخواست‌های مهمان</span></div>
     <h2 className="mt-2 text-xl font-black text-[#55565A]">درخواست‌های پیش‌فاکتور</h2>
     <p className="mt-1 text-xs leading-6 text-slate-500">فقط نام کالا، کد و تعداد ثبت می‌شود؛ هیچ نام، شماره تماس یا اطلاعات هویتی از مشتری دریافت نمی‌شود.</p>
    </div>
    <button type="button" onClick={() => void load()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-[#E56B1E] hover:text-[#A8450B]">
     <RefreshCw size={15}/> تازه‌سازی دستی
    </button>
   </header>

   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">درخواست جدید</div><strong className="mt-2 block text-2xl font-black text-amber-600 tabular-nums">{nf(newCount)}</strong></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">در صف انبارداری</div><strong className="mt-2 block text-2xl font-black text-blue-700 tabular-nums">{nf(warehouseCount)}</strong></div>
    <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="text-xs text-slate-500">بازگشته از انبار</div><strong className="mt-2 block text-2xl font-black text-emerald-700 tabular-nums">{nf(returnedCount)}</strong></div>
   </div>

   <div className="flex flex-wrap items-center gap-2">
    {([
     ['all','همه درخواست‌ها'],
     ['new','جدید'],
     ['sent_to_warehouse','ارسال به انبار'],
     ['warehouse_reviewing','در حال بررسی'],
     ['warehouse_returned','نتیجه انبار'],
     ['completed','تکمیل‌شده'],
    ] as const).map(([value,label]) => (
     <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-xl px-3 py-2 text-xs font-bold transition-colors ${filter === value ? 'bg-[#55565A] text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-400'}`}>{label}</button>
    ))}
   </div>

   {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
   {loading ? (
    <div role="status" className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">در حال دریافت درخواست‌ها…</div>
   ) : filtered.length === 0 ? (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
     <Archive className="mx-auto text-slate-300" size={32}/>
     <p className="mt-3 text-sm font-bold text-slate-600">درخواستی در این وضعیت وجود ندارد.</p>
     <p className="mt-1 text-xs text-slate-400">درخواست‌های جدید بدون رفرش صفحه در همین بخش ظاهر می‌شوند.</p>
    </div>
   ) : (
    <div className="space-y-4">
     {filtered.map(request => (
      <article key={request.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
       <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
        <div>
         <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-black text-slate-700">RFQ-{nf(request.requestNumber)}</span>
          <span className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${request.status === 'new' ? 'bg-amber-50 text-amber-800' : request.status === 'warehouse_returned' ? 'bg-emerald-50 text-emerald-800' : request.status === 'completed' ? 'bg-slate-100 text-slate-600' : 'bg-blue-50 text-blue-800'}`}>{statusLabel[request.status]}</span>
         </div>
         <h3 className="mt-2 text-sm font-black text-[#55565A]">مشتری {nf(request.requestNumber)} <span className="font-medium text-slate-400">— مهمان، بدون اطلاعات تماس</span></h3>
         <p className="mt-1 text-[11px] text-slate-500">زمان ثبت: {dateLabel(request.createdAt)} · {nf(request.items.length)} قلم کالا</p>
        </div>
        <div className="flex flex-wrap gap-2">
         {(request.status === 'new' || request.status === 'warehouse_returned') && (
          <button type="button" disabled={busyId === request.id} onClick={() => void runAction(request,'send-to-warehouse')} className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#E56B1E] px-3.5 text-xs font-bold text-white hover:bg-[#c85612] disabled:opacity-50">
           <Send size={15}/> {request.status === 'warehouse_returned' ? 'ارجاع مجدد به انبار' : 'ارسال به انبارداری'}
          </button>
         )}
         {request.status === 'warehouse_returned' && (
          <button type="button" disabled={busyId === request.id} onClick={() => void runAction(request,'complete')} className="inline-flex h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 text-xs font-bold text-emerald-800 disabled:opacity-50">
           <CheckCircle2 size={15}/> تکمیل بررسی
          </button>
         )}
        </div>
       </div>
       <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-right text-xs">
         <thead className="bg-slate-50 text-slate-500"><tr><th className="px-4 py-3 font-bold">کالا</th><th className="px-4 py-3 font-bold">کد کالا</th><th className="px-4 py-3 font-bold">تعداد درخواستی</th><th className="px-4 py-3 font-bold">نتیجه انبار</th><th className="px-4 py-3 font-bold">تعداد موجود</th></tr></thead>
         <tbody>
          {request.items.map(item => (
           <tr key={item.id} className="border-t border-slate-100">
            <td className="px-4 py-3 font-bold text-slate-700">{item.productName}</td>
            <td className="px-4 py-3 font-mono text-slate-500" dir="ltr">{item.productCode}</td>
            <td className="px-4 py-3 font-black tabular-nums">{nf(item.quantity)} {item.unit}</td>
            <td className="px-4 py-3"><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${item.warehouseStatus === 'available' ? 'bg-emerald-50 text-emerald-700' : item.warehouseStatus === 'unavailable' ? 'bg-red-50 text-red-700' : item.warehouseStatus === 'partial' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-500'}`}>{stockLabel[item.warehouseStatus]}</span>{item.warehouseNote && <p className="mt-1 max-w-[180px] text-[10px] leading-5 text-slate-500">{item.warehouseNote}</p>}</td>
            <td className="px-4 py-3 font-bold tabular-nums">{item.availableQuantity == null ? '—' : nf(item.availableQuantity)}</td>
           </tr>
          ))}
         </tbody>
        </table>
       </div>
       {request.status === 'sent_to_warehouse' && <div className="flex items-center gap-2 border-t border-slate-100 bg-blue-50/60 px-4 py-3 text-[11px] text-blue-800"><Warehouse size={14}/> درخواست به صف انبارداری ارسال شده و منتظر دریافت نتیجه است.</div>}
       {request.status === 'warehouse_reviewing' && <div className="flex items-center gap-2 border-t border-slate-100 bg-amber-50/60 px-4 py-3 text-[11px] text-amber-800"><Clock3 size={14}/> انباردار در حال بررسی موجودی اقلام است.</div>}
       {request.status === 'warehouse_returned' && <div className="flex items-center gap-2 border-t border-slate-100 bg-emerald-50/60 px-4 py-3 text-[11px] text-emerald-800"><PackageCheck size={14}/> نتیجه بررسی موجودی به مدیریت بازگشته است.</div>}
      </article>
     ))}
    </div>
   )}
  </div>
 );
};
