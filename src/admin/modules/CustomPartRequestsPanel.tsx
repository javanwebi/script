import React, { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, FileImage, FileText, Phone, CalendarClock, Save, Download, Loader2, ClipboardList } from 'lucide-react';

type RequestStatus = 'new' | 'reviewing' | 'quoted' | 'accepted' | 'rejected' | 'completed';
type RequestRow = {
  id: string; tracking_code: string; contact_name: string; phone: string; email: string | null;
  company_name: string | null; part_name: string; part_type: string | null; dimensions: string | null;
  alloy_condition: string | null; quantity: string; notes: string | null; attachment_name: string | null;
  attachment_mime: string | null; attachment_size: number | null; has_attachment: boolean;
  status: RequestStatus; internal_note: string | null; quote_amount: number | string | null;
  quote_currency: string; created_at: string; updated_at: string;
};
const statusOptions: Array<{ value: RequestStatus; label: string }> = [
  { value: 'new', label: 'جدید' }, { value: 'reviewing', label: 'در حال بررسی' },
  { value: 'quoted', label: 'اعلام برآورد' }, { value: 'accepted', label: 'تأیید مشتری' },
  { value: 'rejected', label: 'رد شده' }, { value: 'completed', label: 'تکمیل‌شده' },
];
const card = 'rounded-2xl border border-slate-200 bg-white shadow-[0_4px_24px_rgba(32,40,52,.03)]';
const field = 'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#E56B1E] focus:ring-2 focus:ring-[#E56B1E]/10';
const dateText = (value: string) => new Date(value).toLocaleString('fa-IR');
const moneyText = (value: number | string | null, currency: string) => value === null || value === '' ? 'ثبت نشده' : new Intl.NumberFormat('fa-IR').format(Number(value)) + (currency === 'IRT' || currency === 'IRR' ? ' ' + (currency === 'IRR' ? 'ریال' : 'تومان') : ' ' + currency);

export const CustomPartRequestsPanel: React.FC = () => {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [query, setQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [note, setNote] = useState('');
  const [quoteAmount, setQuoteAmount] = useState('');
  const [quoteCurrency, setQuoteCurrency] = useState('IRT');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ q: query, status: filterStatus, limit: '100' });
      const response = await fetch('/api/admin/custom-part-requests?' + params.toString(), {
        credentials: 'same-origin', cache: 'no-store', signal,
      });
      const data = await response.json().catch(() => ({ success: false, message: 'پاسخ سرور معتبر نیست.' }));
      if (!response.ok || !data.success) throw new Error(data.message || 'دریافت درخواست‌های ساخت ناموفق بود.');
      if (signal?.aborted) return;
      const nextRows = Array.isArray(data.rows) ? data.rows as RequestRow[] : [];
      setRows(nextRows);
      setSelected(previous => nextRows.find(row => row.id === previous?.id) || nextRows[0] || null);
      setSelectedId(previous => nextRows.some(row => row.id === previous) ? previous : (nextRows[0]?.id || ''));
    } catch (e) {
      if (!signal?.aborted) setError(e instanceof Error ? e.message : 'دریافت درخواست‌ها ناموفق بود.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [query, filterStatus, revision]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => void load(controller.signal), query ? 250 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [load]);

  useEffect(() => {
    if (!selected) { setNote(''); setQuoteAmount(''); setQuoteCurrency('IRT'); return; }
    setNote(selected.internal_note || '');
    setQuoteAmount(selected.quote_amount === null ? '' : String(selected.quote_amount));
    setQuoteCurrency(selected.quote_currency || 'IRT');
  }, [selected?.id]);

  const save = async () => {
    if (!selected) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/custom-part-requests/' + encodeURIComponent(selected.id), {
        method: 'PATCH', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: selected.status, internalNote: note,
          quoteAmount: quoteAmount.trim() === '' ? null : Number(quoteAmount), quoteCurrency,
        }),
      });
      const data = await response.json().catch(() => ({ success: false, message: 'پاسخ سرور معتبر نیست.' }));
      if (!response.ok || !data.success) throw new Error(data.message || 'ذخیره تغییرات انجام نشد.');
      setNotice('وضعیت و یادداشت درخواست ذخیره شد.');
      setRevision(value => value + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ذخیره تغییرات ناموفق بود.');
    } finally { setSaving(false); }
  };

  const attachmentUrl = selected ? '/api/admin/custom-part-requests/' + encodeURIComponent(selected.id) + '/attachment' : '';
  return (
    <section className="space-y-4" dir="rtl">
      <div className={card + ' flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between'}>
        <div>
          <h3 className="flex items-center gap-2 text-base font-black text-slate-800"><ClipboardList className="h-5 w-5 text-[#E56B1E]"/>درخواست‌های ساخت و مهندسی معکوس</h3>
          <p className="mt-1 text-xs leading-6 text-slate-500">درخواست‌های مهمان و مشتریان ثبت‌شده، فایل‌های خصوصی، برآورد و وضعیت پیگیری</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <label className="relative min-w-0 sm:w-64">
            <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/>
            <input className={field + ' pr-9'} value={query} onChange={event => setQuery(event.target.value)} placeholder="نام، موبایل، قطعه یا کد پیگیری"/>
          </label>
          <select className={field + ' sm:w-40'} value={filterStatus} onChange={event => setFilterStatus(event.target.value)}>
            <option value="all">همه وضعیت‌ها</option>{statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" onClick={() => setRevision(value => value + 1)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4"/>بروزرسانی</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</div>}

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(340px,0.9fr)]">
        <div className={card + ' min-w-0 overflow-hidden'}>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <b className="text-sm text-slate-800">فهرست درخواست‌ها</b><span className="text-xs text-slate-500">{new Intl.NumberFormat('fa-IR').format(rows.length)} مورد</span>
          </div>
          {loading ? <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin"/>در حال دریافت...</div>
            : rows.length ? <div className="divide-y divide-slate-100">
              {rows.map(row => <button key={row.id} type="button" onClick={() => { setSelectedId(row.id); setSelected(row); setNotice(''); }}
                className={'block w-full p-4 text-right transition hover:bg-orange-50/50 ' + (selectedId === row.id ? 'bg-orange-50/70 ring-1 ring-inset ring-orange-200' : '')}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><div className="font-bold text-slate-800">{row.part_name}</div><div className="mt-1 text-[11px] text-slate-500">{row.contact_name} · {row.company_name || 'بدون نام مجموعه'}</div></div>
                  <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{statusOptions.find(x => x.value === row.status)?.label || row.status}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-slate-500">
                  <span className="font-mono font-bold text-[#E56B1E]" dir="ltr">{row.tracking_code}</span>
                  <span className="inline-flex items-center gap-1" dir="ltr"><Phone className="h-3 w-3"/>{row.phone}</span>
                  <span className="inline-flex items-center gap-1"><CalendarClock className="h-3 w-3"/>{dateText(row.created_at)}</span>
                  {row.has_attachment && <span className="inline-flex items-center gap-1 text-emerald-700"><FileImage className="h-3 w-3"/>پیوست دارد</span>}
                </div>
              </button>)}
            </div> : <div className="py-14 text-center text-sm text-slate-500">درخواستی با این فیلتر پیدا نشد.</div>}
        </div>

        <div className={card + ' min-w-0 p-4'}>
          {!selected ? <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-sm text-slate-500"><ClipboardList className="h-8 w-8 text-slate-300"/>برای مشاهده جزئیات، یک درخواست را انتخاب کنید.</div> : <>
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 pb-3">
              <div><div className="font-mono text-sm font-black text-[#E56B1E]" dir="ltr">{selected.tracking_code}</div><h4 className="mt-1 text-base font-black text-slate-800">{selected.part_name}</h4></div>
              <span className="text-[11px] text-slate-500">{dateText(selected.created_at)}</span>
            </div>
            <div className="grid grid-cols-1 gap-3 py-4 text-xs sm:grid-cols-2">
              <div><span className="text-slate-500">نام تماس</span><div className="mt-1 font-bold text-slate-800">{selected.contact_name}</div></div>
              <div><span className="text-slate-500">موبایل</span><div className="mt-1 font-bold text-slate-800" dir="ltr">{selected.phone}</div></div>
              <div><span className="text-slate-500">مجموعه</span><div className="mt-1 font-bold text-slate-800">{selected.company_name || '—'}</div></div>
              <div><span className="text-slate-500">نوع قطعه / تعداد</span><div className="mt-1 font-bold text-slate-800">{selected.part_type || '—'} · {selected.quantity}</div></div>
              <div><span className="text-slate-500">ابعاد</span><div className="mt-1 text-slate-800">{selected.dimensions || '—'}</div></div>
              <div><span className="text-slate-500">آلیاژ / شرایط کاری</span><div className="mt-1 text-slate-800">{selected.alloy_condition || '—'}</div></div>
              {selected.email && <div className="sm:col-span-2"><span className="text-slate-500">ایمیل</span><div className="mt-1 text-slate-800">{selected.email}</div></div>}
              {selected.quote_amount !== null && <div className="sm:col-span-2"><span className="text-slate-500">برآورد ثبت‌شده</span><div className="mt-1 font-black text-[#E56B1E]">{moneyText(selected.quote_amount, selected.quote_currency)}</div></div>}
              {selected.notes && <div className="sm:col-span-2"><span className="text-slate-500">توضیحات مشتری</span><p className="mt-1 whitespace-pre-wrap leading-6 text-slate-800">{selected.notes}</p></div>}
            </div>
            {selected.has_attachment && <div className="space-y-2 border-y border-slate-100 py-3">
              <div className="flex items-center justify-between gap-2 text-xs"><span className="inline-flex items-center gap-2 font-bold text-slate-700"><FileText className="h-4 w-4 text-[#E56B1E]"/>{selected.attachment_name || 'فایل پیوست'}</span><a href={attachmentUrl} className="inline-flex items-center gap-1 font-bold text-[#E56B1E]" target="_blank" rel="noreferrer"><Download className="h-4 w-4"/>دریافت فایل</a></div>
              {selected.attachment_mime?.startsWith('image/') && <img src={attachmentUrl} alt="تصویر قطعه ارسالی مشتری" className="max-h-64 w-full rounded-xl border border-slate-200 bg-slate-50 object-contain"/>}
              <p className="text-[10px] text-slate-400">فایل از مسیر خصوصی و پس از بررسی مجوز کارشناس دریافت می‌شود.</p>
            </div>}
            <div className="space-y-3 pt-4">
              <label className="block text-xs font-bold text-slate-700">وضعیت درخواست
                <select className={field + ' mt-1'} value={selected.status} onChange={event => setSelected({ ...selected, status: event.target.value as RequestStatus })}>
                  {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold text-slate-700">مبلغ برآورد (اختیاری)
                <div className="mt-1 grid grid-cols-[minmax(0,1fr)_100px] gap-2">
                  <input className={field} inputMode="decimal" value={quoteAmount} onChange={event => setQuoteAmount(event.target.value)} placeholder="مثلاً ۱۲۵۰۰۰۰"/>
                  <select className={field} value={quoteCurrency} onChange={event => setQuoteCurrency(event.target.value)}><option value="IRT">تومان</option><option value="IRR">ریال</option><option value="USD">دلار</option><option value="EUR">یورو</option></select>
                </div>
              </label>
              <label className="block text-xs font-bold text-slate-700">یادداشت داخلی کارشناسان
                <textarea className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-[#E56B1E]" value={note} onChange={event => setNote(event.target.value)} placeholder="نتیجه بررسی نقشه، جنس، روش ساخت، زمان تحویل و اقدام بعدی..."/>
              </label>
              <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#E56B1E] px-4 text-sm font-black text-white hover:bg-[#c95513] disabled:opacity-50"><Save className="h-4 w-4"/>{saving ? 'در حال ذخیره...' : 'ذخیره وضعیت و یادداشت'}</button>
            </div>
          </>}
        </div>
      </div>
    </section>
  );
};
