import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, ShieldCheck, UserRound } from 'lucide-react';

type WarehouseAccount = {
 id: string;
 username: string;
 name: string;
 active: boolean;
 createdAt: string;
 lastLogin?: string | null;
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
 const headers = new Headers(init?.headers);
 if (init?.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
 const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init, headers });
 const data = await response.json().catch(() => ({}));
 if (!response.ok || !data.success) throw new Error(data.message || 'عملیات انجام نشد.');
 return data as T;
}
const dateLabel = (value?: string | null) => value ? new Date(value).toLocaleString('fa-IR', { dateStyle: 'short', timeStyle: 'short' }) : 'هنوز وارد نشده';

export const WarehouseAccountsModule: React.FC = () => {
 const [accounts, setAccounts] = useState<WarehouseAccount[]>([]);
 const [loading, setLoading] = useState(true);
 const [busy, setBusy] = useState(false);
 const [error, setError] = useState('');
 const [message, setMessage] = useState('');
 const [name, setName] = useState('');
 const [username, setUsername] = useState('');
 const [password, setPassword] = useState('');
 const [resetFor, setResetFor] = useState('');
 const [resetPassword, setResetPassword] = useState('');

 const load = useCallback(async () => {
  setLoading(true);
  try {
   const data = await api<{ accounts: WarehouseAccount[] }>('/api/admin/warehouse/accounts');
   setAccounts(Array.isArray(data.accounts) ? data.accounts : []);
   setError('');
  } catch (e) { setError(e instanceof Error ? e.message : 'دریافت حساب‌ها ناموفق بود.'); }
  finally { setLoading(false); }
 }, []);
 useEffect(() => { void load(); }, [load]);

 const create = async (event: React.FormEvent) => {
  event.preventDefault();
  setBusy(true); setError(''); setMessage('');
  try {
   await api('/api/admin/warehouse/accounts', { method: 'POST', body: JSON.stringify({ name, username, password }) });
   setName(''); setUsername(''); setPassword('');
   setMessage('حساب انباردار ساخته شد. اطلاعات ورود را به‌صورت امن در اختیار انباردار قرار دهید.');
   await load();
  } catch (e) { setError(e instanceof Error ? e.message : 'ساخت حساب انجام نشد.'); }
  finally { setBusy(false); }
 };

 const toggle = async (account: WarehouseAccount) => {
  setBusy(true); setError(''); setMessage('');
  try {
   await api(`/api/admin/warehouse/accounts/${account.id}`, { method: 'PATCH', body: JSON.stringify({ active: !account.active }) });
   await load();
  } catch (e) { setError(e instanceof Error ? e.message : 'تغییر وضعیت حساب انجام نشد.'); }
  finally { setBusy(false); }
 };
 const reset = async (account: WarehouseAccount) => {
  if (resetPassword.length < 12) { setError('رمز جدید باید حداقل ۱۲ نویسه باشد.'); return; }
  setBusy(true); setError(''); setMessage('');
  try {
   await api(`/api/admin/warehouse/accounts/${account.id}/reset-password`, { method: 'POST', body: JSON.stringify({ password: resetPassword }) });
   setResetFor(''); setResetPassword('');
   setMessage(`رمز حساب ${account.username} بازنشانی شد.`);
  } catch (e) { setError(e instanceof Error ? e.message : 'بازنشانی رمز انجام نشد.'); }
  finally { setBusy(false); }
 };

 return (
  <div className="space-y-5 text-right" dir="rtl">
   <header className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
    <div className="flex items-center gap-2 text-[#E56B1E]"><ShieldCheck size={18}/><span className="text-xs font-black">دسترسی مستقل انبارداری</span></div>
    <h2 className="mt-2 text-xl font-black text-[#55565A]">مدیریت حساب‌های انبارداری</h2>
    <p className="mt-1 text-xs leading-6 text-slate-500">این حساب‌ها فقط به پنل اختصاصی انبارداری در نشانی <b dir="ltr">/warehouse</b> وارد می‌شوند و به پنل مدیریت، مشتریان، قیمت‌ها یا اطلاعات فروش دسترسی ندارند.</p>
   </header>

   {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">{error}</div>}
   {message && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{message}</div>}

   <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <h3 className="flex items-center gap-2 text-sm font-black text-[#55565A]"><Plus size={17} className="text-[#E56B1E]"/> ساخت حساب جدید انباردار</h3>
    <form onSubmit={create} className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
     <label className="space-y-1.5"><span className="block text-xs font-bold text-slate-600">نام و نام خانوادگی انباردار</span><input required minLength={2} maxLength={160} value={name} onChange={e=>setName(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#E56B1E]" placeholder="نام انباردار"/></label>
     <label className="space-y-1.5"><span className="block text-xs font-bold text-slate-600">نام کاربری انگلیسی</span><input required minLength={4} maxLength={32} pattern="[a-z][a-z0-9_]{3,31}" value={username} onChange={e=>setUsername(e.target.value.toLowerCase())} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#E56B1E]" dir="ltr" placeholder="warehouse01"/></label>
     <label className="space-y-1.5"><span className="block text-xs font-bold text-slate-600">رمز عبور اولیه</span><input required type="password" minLength={12} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)} className="h-11 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-[#E56B1E]" dir="ltr" placeholder="حداقل ۱۲ نویسه"/></label>
     <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-1">
      <p className="text-[11px] leading-5 text-slate-500">نام کاربری و رمز را خارج از سایت و به‌صورت امن به انباردار تحویل دهید.</p>
      <button disabled={busy} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-5 text-xs font-bold text-white hover:bg-[#c85612] disabled:opacity-50"><Plus size={16}/> ایجاد حساب انباردار</button>
     </div>
    </form>
   </section>

   <section className="rounded-2xl border border-slate-200 bg-white p-5">
    <div className="flex items-center justify-between gap-3">
     <h3 className="text-sm font-black text-[#55565A]">حساب‌های ثبت‌شده ({accounts.length.toLocaleString('fa-IR')})</h3>
     <button type="button" onClick={() => void load()} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600"><RefreshCw size={14}/> تازه‌سازی</button>
    </div>
    {loading ? <p className="py-10 text-center text-xs text-slate-500">در حال دریافت حساب‌ها…</p> : accounts.length === 0 ? (
     <div className="py-10 text-center text-xs text-slate-500">هنوز حساب انبارداری ساخته نشده است.</div>
    ) : (
     <div className="mt-4 space-y-3">
      {accounts.map(account => (
       <article key={account.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
         <div className="flex items-start gap-3">
          <span className="rounded-xl bg-slate-100 p-2 text-slate-600"><UserRound size={18}/></span>
          <div><div className="font-bold text-sm text-slate-800">{account.name}</div><div className="mt-1 text-xs text-slate-500" dir="ltr">{account.username}</div><div className="mt-1 text-[10px] text-slate-400">آخرین ورود: {dateLabel(account.lastLogin)}</div></div>
         </div>
         <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold ${account.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{account.active ? 'فعال' : 'غیرفعال'}</span>
          <button type="button" disabled={busy} onClick={() => void toggle(account)} className="h-9 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-600 hover:border-[#E56B1E] disabled:opacity-50">{account.active ? 'غیرفعال‌سازی' : 'فعال‌سازی'}</button>
          <button type="button" onClick={() => {setResetFor(resetFor === account.id ? '' : account.id);setResetPassword('');}} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-[11px] font-bold text-slate-600 hover:border-[#E56B1E]"><KeyRound size={13}/> بازنشانی رمز</button>
         </div>
        </div>
        {resetFor === account.id && <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3"><input type="password" minLength={12} maxLength={128} value={resetPassword} onChange={e=>setResetPassword(e.target.value)} placeholder="رمز جدید، حداقل ۱۲ نویسه" className="h-10 min-w-[220px] flex-1 rounded-lg border border-slate-200 px-3 text-xs" dir="ltr"/><button type="button" disabled={busy || resetPassword.length < 12} onClick={() => void reset(account)} className="h-10 rounded-lg bg-[#55565A] px-4 text-xs font-bold text-white disabled:opacity-50">ذخیره رمز جدید</button></div>}
       </article>
      ))}
     </div>
    )}
   </section>
  </div>
 );
};
