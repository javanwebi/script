import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, LogOut, PackageCheck, RefreshCw, ShieldCheck, Warehouse } from 'lucide-react';

type WarehouseStatus = 'pending' | 'available' | 'partial' | 'unavailable';
type RequestItem = {
 id: string;
 productCode: string;
 productName: string;
 unit: string;
 quantity: number;
 warehouseStatus: WarehouseStatus;
 availableQuantity?: number | null;
 warehouseNote?: string | null;
};
type WarehouseRequest = {
 id: string;
 requestNumber: string | number;
 status: 'sent_to_warehouse' | 'warehouse_reviewing';
 createdAt: string;
 warehouseAssignedTo?: string | null;
 items: RequestItem[];
};
type WarehouseUser = { id: string; username: string; name: string };
type Draft = { warehouseStatus: WarehouseStatus; availableQuantity: string; warehouseNote: string };

async function api<T>(url: string, init?: RequestInit): Promise<T> {
 const headers = new Headers(init?.headers);
 if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
 const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init, headers });
 const data = await response.json().catch(() => ({}));
 if (!response.ok || !data.success) throw new Error(data.message || 'عملیات انجام نشد.');
 return data as T;
}
const nf = (value: number | string) => Number(value || 0).toLocaleString('fa-IR');
const dateLabel = (value: string) => new Date(value).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' });
const stockLabels: Record<WarehouseStatus, string> = {
 pending: 'انتخاب وضعیت',
 available: 'موجود',
 partial: 'موجودی ناکافی',
 unavailable: 'ناموجود',
};

export const WarehouseLayout: React.FC = () => {
 const [user, setUser] = useState<WarehouseUser | null>(null);
 const [checking, setChecking] = useState(true);
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [loginBusy, setLoginBusy] = useState(false);
 const [loginError, setLoginError] = useState('');
 const [requests, setRequests] = useState<WarehouseRequest[]>([]);
 const [drafts, setDrafts] = useState<Record<string, Record<string, Draft>>>({});
 const [loading, setLoading] = useState(false);
 const [busyId, setBusyId] = useState('');
 const [error, setError] = useState('');
 const [message, setMessage] = useState('');

 const loadSession = useCallback(async () => {
  try {
   // If the access token expired, the first isolated request rotates the
   // refresh cookie; retry once with the new cookie without touching /api/portal.
   const load = () => api<{ user: WarehouseUser }>('/api/warehouse/session');
   let data: { user: WarehouseUser };
   try { data = await load(); }
   catch { data = await load(); }
   setUser(data.user);
   return true;
  } catch {
   setUser(null);
   return false;
  } finally { setChecking(false); }
 }, []);

 const loadRequests = useCallback(async (silent = false) => {
  if (!silent) setLoading(true);
  try {
   const data = await api<{ requests: WarehouseRequest[] }>('/api/warehouse/requests');
   const next = Array.isArray(data.requests) ? data.requests : [];
   setRequests(next);
   setDrafts(previous => {
    const updated = { ...previous };
    for (const request of next) {
     // A fresh unassigned dispatch means management reset the warehouse review.
     // Never carry stale local stock decisions into a newly dispatched request.
     const current = request.status === 'sent_to_warehouse' && !request.warehouseAssignedTo
      ? {}
      : { ...(updated[request.id] || {}) };
     for (const item of request.items) {
      if (!current[item.id]) current[item.id] = {
       warehouseStatus: item.warehouseStatus || 'pending',
       availableQuantity: item.availableQuantity == null ? String(item.quantity) : String(item.availableQuantity),
       warehouseNote: item.warehouseNote || ''
      };
     }
     updated[request.id] = current;
    }
    return updated;
   });
   setError('');
  } catch (e) { setError(e instanceof Error ? e.message : 'دریافت درخواست‌های انبار ناموفق بود.'); }
  finally { if (!silent) setLoading(false); }
 }, []);

 useEffect(() => { void loadSession(); }, [loadSession]);
 useEffect(() => {
  if (!user) return;
  void loadRequests();
  const events = new EventSource('/api/warehouse/requests/events', { withCredentials: true });
  events.addEventListener('warehouse-request-updated', () => { void loadRequests(true); });
  const poll = window.setInterval(() => { void loadRequests(true); }, 15000);
  // Refresh before the short-lived access token expires. The refresh cookie is
  // intentionally scoped to /api/portal, so this authenticated action owns it.
  const keepAlive = window.setInterval(() => {
   void api('/api/portal', { method: 'POST', body: JSON.stringify({ action: 'warehouse_refresh' }) })
    .catch(() => { void loadSession(); });
  }, 35 * 60 * 1000);
  const onFocus = () => { void loadRequests(true); };
  window.addEventListener('focus', onFocus);
  return () => { events.close(); window.clearInterval(poll); window.clearInterval(keepAlive); window.removeEventListener('focus', onFocus); };
 }, [user?.id, loadRequests, loadSession]);

 const login = async (event: React.FormEvent) => {
  event.preventDefault();
  setLoginBusy(true); setLoginError('');
  try {
   await api('/api/portal', { method: 'POST', body: JSON.stringify({ action: 'warehouse_login', identifier: username.trim().toLowerCase(), username: username.trim().toLowerCase(), password }) });
   setPassword('');
   const active = await loadSession();
   if (!active) setLoginError('ورود تأیید شد اما دسترسی پنل انبارداری فعال نیست. با مدیر سامانه تماس بگیرید.');
  } catch (e) { setLoginError(e instanceof Error ? e.message : 'ورود انجام نشد.'); }
  finally { setLoginBusy(false); }
 };

 const logout = async () => {
  try { await api('/api/portal', { method: 'POST', body: JSON.stringify({ action: 'logout' }) }); }
  catch { /* local sign-out still clears this isolated workspace */ }
  finally { setUser(null); setRequests([]); setDrafts({}); }
 };

 const claim = async (request: WarehouseRequest) => {
  setBusyId(request.id); setError(''); setMessage('');
  try {
   await api(`/api/warehouse/requests/${request.id}/claim`, { method: 'POST', body: '{}' });
   setMessage(`درخواست RFQ-${nf(request.requestNumber)} به شما واگذار شد.`);
   await loadRequests(true);
  } catch (e) { setError(e instanceof Error ? e.message : 'دریافت مسئولیت درخواست انجام نشد.'); }
  finally { setBusyId(''); }
 };

 const updateDraft = (requestId: string, itemId: string, patch: Partial<Draft>) => {
  setDrafts(previous => ({
   ...previous,
   [requestId]: {
    ...(previous[requestId] || {}),
    [itemId]: { ...(previous[requestId]?.[itemId] || { warehouseStatus: 'pending', availableQuantity: '', warehouseNote: '' }), ...patch }
   }
  }));
 };

 const save = async (request: WarehouseRequest) => {
  const rows = request.items.map(item => {
   const draft = drafts[request.id]?.[item.id] || { warehouseStatus: 'pending' as WarehouseStatus, availableQuantity: String(item.quantity), warehouseNote: '' };
   return { id: item.id, warehouseStatus: draft.warehouseStatus,
    availableQuantity: draft.availableQuantity === '' ? null : Number(draft.availableQuantity),
    warehouseNote: draft.warehouseNote };
  });
  if (rows.some(row => row.warehouseStatus === 'pending')) {
   setError('برای تمام اقلام، وضعیت موجودی را مشخص کنید.');
   return;
  }
  setBusyId(request.id); setError(''); setMessage('');
  try {
   await api(`/api/warehouse/requests/${request.id}/items`, { method: 'PATCH', body: JSON.stringify({ items: rows }) });
   setMessage(`نتیجه بررسی درخواست RFQ-${nf(request.requestNumber)} برای مدیریت ارسال شد.`);
   await loadRequests(true);
  } catch (e) { setError(e instanceof Error ? e.message : 'ذخیره نتیجه بررسی انجام نشد.'); }
  finally { setBusyId(''); }
 };

 const assignedRequests = useMemo(() => requests.filter(r => r.warehouseAssignedTo === user?.id), [requests, user?.id]);
 const waitingRequests = useMemo(() => requests.filter(r => !r.warehouseAssignedTo), [requests]);

 if (checking) return <div className="fixed inset-0 z-[1000] grid place-items-center bg-[#F7F8FA] text-sm text-slate-500" dir="rtl">در حال بررسی دسترسی انبارداری…</div>;

 return (
  <div className="fixed inset-0 z-[1000] min-h-screen overflow-y-auto bg-[#F7F8FA] text-slate-900" dir="rtl">
   {!user ? (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
     <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-[#E56B1E]"><Warehouse size={28}/></div>
      <div className="mt-4 text-center">
       <p className="text-xs font-black text-[#E56B1E]">صنعت پیش | اطلس</p>
       <h1 className="mt-2 text-xl font-black text-[#55565A]">ورود به پنل انبارداری</h1>
       <p className="mt-2 text-xs leading-6 text-slate-500">این پنل فقط برای حساب‌های اختصاصی انبارداری است. برای دریافت حساب با مدیر سامانه تماس بگیرید.</p>
      </div>
      {loginError && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{loginError}</div>}
      <form onSubmit={login} className="mt-5 space-y-3">
       <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">نام کاربری</span><input required autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#E56B1E]" dir="ltr" placeholder="warehouse01"/></label>
       <label className="block space-y-1.5"><span className="text-xs font-bold text-slate-600">رمز عبور</span><input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="h-12 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#E56B1E]" dir="ltr"/></label>
       <button disabled={loginBusy} className="h-12 w-full rounded-xl bg-[#E56B1E] text-sm font-black text-white hover:bg-[#c85612] disabled:opacity-50">{loginBusy ? 'در حال ورود…' : 'ورود امن به انبارداری'}</button>
      </form>
      <div className="mt-5 flex items-center justify-center gap-2 text-[10px] text-slate-400"><ShieldCheck size={13}/> دسترسی محدود به درخواست‌های ارجاع‌شده</div>
     </div>
    </div>
   ) : (
    <div className="mx-auto min-h-screen max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
     <header className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-orange-50 text-[#E56B1E]"><Warehouse size={22}/></div><div><p className="text-xs font-black text-[#E56B1E]">صنعت پیش | اطلس</p><h1 className="mt-1 text-lg font-black text-[#55565A]">پنل اختصاصی انبارداری</h1><p className="mt-1 text-[11px] text-slate-500">{user.name} · {user.username}</p></div></div>
      <div className="flex items-center gap-2"><button type="button" onClick={() => void loadRequests()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600"><RefreshCw size={14}/> تازه‌سازی</button><button type="button" onClick={() => void logout()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:text-red-600"><LogOut size={14}/> خروج</button></div>
     </header>

     <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><ClipboardList size={15}/> درخواست‌های در صف</div><strong className="mt-2 block text-2xl font-black tabular-nums">{nf(waitingRequests.length)}</strong></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-xs text-slate-500"><PackageCheck size={15}/> درخواست‌های واگذارشده به شما</div><strong className="mt-2 block text-2xl font-black tabular-nums">{nf(assignedRequests.length)}</strong></div>
     </div>

     {error && <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
     {message && <div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{message}</div>}

     {loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">در حال دریافت درخواست‌های ارجاع‌شده…</div> : requests.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><CheckCircle2 className="mx-auto text-slate-300" size={32}/><p className="mt-3 text-sm font-bold text-slate-600">درخواست ارجاع‌شده‌ای در صف انبار نیست.</p><p className="mt-1 text-xs text-slate-400">به‌محض ارجاع درخواست از طرف مدیریت، این صفحه به‌روزرسانی می‌شود.</p></div>
     ) : (
      <div className="space-y-4">
       {requests.map(request => {
        const isMine = request.warehouseAssignedTo === user.id;
        const canClaim = !request.warehouseAssignedTo && request.status === 'sent_to_warehouse';
        const requestDrafts = drafts[request.id] || {};
        const allReady = request.items.every(item => (requestDrafts[item.id]?.warehouseStatus || item.warehouseStatus) !== 'pending');
        return (
         <article key={request.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4 sm:p-5">
           <div><div className="flex items-center gap-2"><span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-black text-slate-700">RFQ-{nf(request.requestNumber)}</span><span className={`rounded-lg px-2 py-1 text-[10px] font-bold ${isMine ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{isMine ? 'واگذارشده به شما' : 'در انتظار دریافت مسئولیت'}</span></div><p className="mt-2 text-xs text-slate-500">ثبت درخواست: {dateLabel(request.createdAt)} · {nf(request.items.length)} قلم کالا</p></div>
           {canClaim && <button type="button" disabled={busyId === request.id} onClick={() => void claim(request)} className="h-10 rounded-xl bg-[#E56B1E] px-4 text-xs font-bold text-white disabled:opacity-50">دریافت و شروع بررسی</button>}
           {isMine && <button type="button" disabled={busyId === request.id || !allReady} onClick={() => void save(request)} className="h-10 rounded-xl bg-[#55565A] px-4 text-xs font-bold text-white disabled:opacity-40">ثبت نتیجه و ارسال به مدیریت</button>}
          </div>
          <div className="space-y-3 p-4 sm:p-5">
           {request.items.map(item => {
            const draft = requestDrafts[item.id] || { warehouseStatus: item.warehouseStatus || 'pending', availableQuantity: String(item.availableQuantity ?? item.quantity), warehouseNote: item.warehouseNote || '' };
            return (
             <div key={item.id} className="rounded-xl border border-slate-200 p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-black text-slate-800">{item.productName}</h3><p className="mt-1 text-[11px] text-slate-500">کد: <b dir="ltr" className="font-mono">{item.productCode}</b> · درخواست: {nf(item.quantity)} {item.unit}</p></div><span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{isMine ? 'قابل بررسی' : 'منتظر دریافت مسئولیت'}</span></div>
              {isMine && <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
               <label className="space-y-1"><span className="block text-[11px] font-bold text-slate-600">وضعیت موجودی</span><select value={draft.warehouseStatus} onChange={e=>{const status=e.target.value as WarehouseStatus;const current=Number(draft.availableQuantity);const partialQuantity=Math.max(1,Math.min(item.quantity-1,Number.isFinite(current)&&current>0?current:item.quantity-1));updateDraft(request.id,item.id,{warehouseStatus:status,availableQuantity:status==='unavailable'?'0':status==='available'?String(item.quantity):status==='partial'?String(partialQuantity):draft.availableQuantity});}} className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs"><option value="pending">{stockLabels.pending}</option><option value="available">{stockLabels.available}</option><option value="partial" disabled={item.quantity<=1}>{stockLabels.partial}</option><option value="unavailable">{stockLabels.unavailable}</option></select></label>
               <label className="space-y-1"><span className="block text-[11px] font-bold text-slate-600">تعداد موجود</span><input type="number" min="0" max="1000000" value={draft.availableQuantity} onChange={e=>updateDraft(request.id,item.id,{availableQuantity:e.target.value})} disabled={draft.warehouseStatus==='unavailable'} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-xs disabled:bg-slate-50" dir="ltr"/></label>
               <label className="space-y-1"><span className="block text-[11px] font-bold text-slate-600">توضیح برای مدیریت</span><input maxLength={1000} value={draft.warehouseNote} onChange={e=>updateDraft(request.id,item.id,{warehouseNote:e.target.value})} className="h-10 w-full rounded-lg border border-slate-200 px-2 text-xs" placeholder="اختیاری"/></label>
              </div>}
             </div>
            );
           })}
          </div>
         </article>
        );
       })}
      </div>
     )}
    </div>
   )}
  </div>
 );
};
