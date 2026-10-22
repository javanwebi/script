import React, { useState, useEffect, useMemo } from 'react';
import {
  Megaphone,
  Globe,
  ShoppingBag,
  Building2,
  Users,
  UserCheck,
  Clock,
  Calendar,
  Archive,
  RotateCcw,
  Plus,
  Save,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Search,
  Pin,
  Sparkles,
  Database,
  Check,
  X,
} from 'lucide-react';
import {
  portalContentService as cms,
  PortalAnnouncementItem,
  AnnouncementPortalType,
} from '../../services/portalContentService';
import { adminService } from '../../services/adminService';
import { flushPortalChanges } from '../../services/portalRepository';
import { toPersianDigits } from '../../utils/formatters';

type StatusTab = 'active' | 'scheduled' | 'archived' | 'all';
type AudienceFilter = 'all' | AnnouncementPortalType;

const AUDIENCE_TYPES: {
  id: AnnouncementPortalType;
  label: string;
  subtitle: string;
  icon: typeof Globe;
  badgeClass: string;
}[] = [
  {
    id: 'storefront',
    label: 'وب‌سایت عمومی (همه بازدیدکنندگان)',
    subtitle: 'نمایش در آیکون اطلاعیه هدر اصلی وب‌سایت برای تمامی کاربران و مهمانان',
    icon: Globe,
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  {
    id: 'consumer',
    label: 'پنل خرده‌فروشی (مشتریان خرده‌فروش)',
    subtitle: 'ارسال به همه مشتریان خرده‌فروش یا انتخاب ریز مشتریان خاص پنل خرده‌فروشی',
    icon: ShoppingBag,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    id: 'high_volume',
    label: 'پنل خرید بالا (مشتریان مصرف بالا / B2B)',
    subtitle: 'ارسال به همه مشتریان خرید بالا یا انتخاب ریز مشتریان خاص پنل مصرف بالا',
    icon: Building2,
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200',
  },
];

function toLocalDatetimeInputValue(iso?: string | null): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatPersianDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(ms));
  } catch {
    return iso;
  }
}

const createEmptyDraft = (portal: AnnouncementPortalType = 'storefront'): PortalAnnouncementItem => ({
  id: '',
  portal,
  scope: 'collective',
  targetCustomerIds: [],
  targetCustomerNames: [],
  targetTierCode: 'ALL',
  title: '',
  body: '',
  tag: 'اطلاعیه مهم',
  priority: 'normal',
  pinned: false,
  highlightValue: '',
  actionLabel: '',
  actionTab: '',
  actionLink: '',
  startsAt: null,
  endsAt: null,
  expiresAt: null,
  showEndTimeToCustomer: true,
  archived: false,
  archivedAt: null,
  active: true,
  createdAt: '',
});

export const AnnouncementsAdminModule: React.FC = () => {
  const [draft, setDraft] = useState<PortalAnnouncementItem>(() => createEmptyDraft('storefront'));
  const [hasStartTime, setHasStartTime] = useState(false);
  const [hasEndTime, setHasEndTime] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [statusTab, setStatusTab] = useState<StatusTab>('active');
  const [audienceFilter, setAudienceFilter] = useState<AudienceFilter>('all');
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sync expired announcements into archive automatically
  useEffect(() => {
    cms.syncExpiredAnnouncementsToArchive();
    const timer = window.setInterval(() => {
      cms.syncExpiredAnnouncementsToArchive();
      setTick(t => t + 1);
    }, 15000);
    const onContentUpdated = () => setTick(t => t + 1);
    window.addEventListener('atlas-portal-content-updated', onContentUpdated);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('atlas-portal-content-updated', onContentUpdated);
    };
  }, []);

  const allCustomers = useMemo(() => adminService.getCustomers(), [tick]);

  const panelCustomers = useMemo(() => {
    if (draft.portal === 'storefront') return [];
    const wantHighVolume = draft.portal === 'high_volume';
    return allCustomers.filter(c => cms.isHighVolumeCustomer(c) === wantHighVolume);
  }, [allCustomers, draft.portal]);

  const filteredPanelCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return panelCustomers;
    return panelCustomers.filter(c => {
      const name = (c.fullName || c.name || '').toLowerCase();
      const company = (c.companyName || c.company || '').toLowerCase();
      const phone = (c.phone || c.mobile || '').toLowerCase();
      return name.includes(q) || company.includes(q) || phone.includes(q);
    });
  }, [panelCustomers, customerSearch]);

  const allAnnouncements = useMemo(() => cms.getAnnouncements(), [tick]);

  const categorizedAnnouncements = useMemo(() => {
    const now = Date.now();
    const active: PortalAnnouncementItem[] = [];
    const scheduled: PortalAnnouncementItem[] = [];
    const archived: PortalAnnouncementItem[] = [];

    for (const item of allAnnouncements) {
      const state = cms.getAnnouncementLifecycleStatus(item, now);
      if (state === 'archived' || state === 'inactive') archived.push(item);
      else if (state === 'scheduled') scheduled.push(item);
      else active.push(item);
    }

    return { active, scheduled, archived, all: allAnnouncements };
  }, [allAnnouncements, tick]);

  const visibleAnnouncements = useMemo(() => {
    const base = categorizedAnnouncements[statusTab] || [];
    if (audienceFilter === 'all') return base;
    return base.filter(a => a.portal === audienceFilter);
  }, [categorizedAnnouncements, statusTab, audienceFilter]);

  const runSave = async (operation: () => void, successText: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      operation();
      await flushPortalChanges();
      setTick(t => t + 1);
      setFeedback({ type: 'success', text: successText });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'خطا در ذخیره‌سازی اطلاعات در دیتابیس Supabase.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleCustomer = (customerId: string) => {
    const currentIds = new Set(draft.targetCustomerIds || []);
    if (currentIds.has(customerId)) {
      currentIds.delete(customerId);
    } else {
      currentIds.add(customerId);
    }
    const nextIds = Array.from(currentIds);
    const nextNames = panelCustomers
      .filter(c => nextIds.includes(c.id))
      .map(c => c.fullName || c.name || c.companyName || c.phone);
    setDraft(prev => ({
      ...prev,
      targetCustomerIds: nextIds,
      targetCustomerNames: nextNames,
      targetCustomerId: nextIds.length === 1 ? nextIds[0] : undefined,
      targetCustomerName: nextNames.length === 1 ? nextNames[0] : undefined,
    }));
  };

  const handleSelectAllFilteredCustomers = () => {
    const currentIds = new Set(draft.targetCustomerIds || []);
    for (const c of filteredPanelCustomers) currentIds.add(c.id);
    const nextIds = Array.from(currentIds);
    const nextNames = panelCustomers
      .filter(c => nextIds.includes(c.id))
      .map(c => c.fullName || c.name || c.companyName || c.phone);
    setDraft(prev => ({
      ...prev,
      targetCustomerIds: nextIds,
      targetCustomerNames: nextNames,
      targetCustomerId: nextIds.length === 1 ? nextIds[0] : undefined,
      targetCustomerName: nextNames.length === 1 ? nextNames[0] : undefined,
    }));
  };

  const handleClearSelectedCustomers = () => {
    setDraft(prev => ({
      ...prev,
      targetCustomerIds: [],
      targetCustomerNames: [],
      targetCustomerId: undefined,
      targetCustomerName: undefined,
    }));
  };

  const applyQuickEndOffset = (hours: number) => {
    const baseMs = hasStartTime && draft.startsAt ? Date.parse(draft.startsAt) : Date.now();
    const targetIso = new Date((Number.isFinite(baseMs) ? baseMs : Date.now()) + hours * 3600 * 1000).toISOString();
    setHasEndTime(true);
    setDraft(prev => ({
      ...prev,
      endsAt: targetIso,
      expiresAt: targetIso,
    }));
  };

  const handleSubmit = () => {
    runSave(() => {
      if (!draft.title.trim() || !draft.body.trim()) {
        throw new Error('لطفاً عنوان و متن اطلاعیه را کامل وارد کنید.');
      }
      if (
        draft.portal !== 'storefront' &&
        (draft.scope === 'selected' || draft.scope === 'individual') &&
        (!draft.targetCustomerIds || draft.targetCustomerIds.length === 0)
      ) {
        throw new Error('لطفاً حداقل یک مشتری را از لیست مشتریان این پنل انتخاب کنید.');
      }

      const startsAtIso = hasStartTime && draft.startsAt ? new Date(draft.startsAt).toISOString() : null;
      const endsAtIso = hasEndTime && draft.endsAt ? new Date(draft.endsAt).toISOString() : null;

      if (startsAtIso && endsAtIso && Date.parse(endsAtIso) <= Date.parse(startsAtIso)) {
        throw new Error('زمان پایان اطلاعیه باید بعد از زمان شروع آن باشد.');
      }

      const selectedNames =
        draft.portal !== 'storefront' && draft.scope !== 'collective'
          ? panelCustomers
              .filter(c => (draft.targetCustomerIds || []).includes(c.id))
              .map(c => c.fullName || c.name || c.companyName || c.phone)
          : [];

      const isAlreadyExpired = endsAtIso ? Date.parse(endsAtIso) <= Date.now() : false;

      cms.saveAnnouncement({
        ...draft,
        id: draft.id || `ann-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        scope: draft.portal === 'storefront' ? 'collective' : draft.scope,
        targetCustomerIds:
          draft.portal !== 'storefront' && draft.scope !== 'collective'
            ? draft.targetCustomerIds || []
            : [],
        targetCustomerNames: selectedNames,
        targetCustomerId:
          draft.portal !== 'storefront' &&
          draft.scope !== 'collective' &&
          (draft.targetCustomerIds || []).length === 1
            ? draft.targetCustomerIds![0]
            : undefined,
        targetCustomerName: selectedNames.length === 1 ? selectedNames[0] : undefined,
        startsAt: startsAtIso,
        endsAt: endsAtIso,
        expiresAt: endsAtIso,
        showEndTimeToCustomer: hasEndTime ? Boolean(draft.showEndTimeToCustomer) : false,
        archived: isAlreadyExpired ? true : false,
        archivedAt: isAlreadyExpired ? endsAtIso : null,
        active: !isAlreadyExpired,
        createdAt: draft.createdAt || new Date().toISOString(),
      });

      const currentPortal = draft.portal;
      setDraft(createEmptyDraft(currentPortal));
      setHasStartTime(false);
      setHasEndTime(false);
    }, draft.id ? 'اطلاعیه با موفقیت ویرایش و در جدول Supabase همگام‌سازی شد.' : 'اطلاعیه جدید با موفقیت ثبت و در جدول Supabase ذخیره شد.');
  };

  const handleEdit = (item: PortalAnnouncementItem) => {
    const normalizedIds =
      Array.isArray(item.targetCustomerIds) && item.targetCustomerIds.length > 0
        ? item.targetCustomerIds
        : item.targetCustomerId
          ? [item.targetCustomerId]
          : [];
    setDraft({
      ...createEmptyDraft(item.portal),
      ...item,
      scope:
        item.portal === 'storefront'
          ? 'collective'
          : item.scope === 'individual'
            ? 'selected'
            : item.scope,
      targetCustomerIds: normalizedIds,
      endsAt: item.endsAt || item.expiresAt || null,
    });
    setHasStartTime(Boolean(item.startsAt));
    setHasEndTime(Boolean(item.endsAt || item.expiresAt));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header & Database Status Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E06518] to-[#C95210] text-white flex items-center justify-center shadow-sm shrink-0">
            <Megaphone className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-base sm:text-lg font-black text-slate-900">
                مدیریت جامع اطلاعیه‌ها و اعلان‌های هدفمند
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Database className="w-3 h-3" />
                <span>جدول Supabase: portal_announcements</span>
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              ایجاد و زمان‌بندی اطلاعیه در ۳ سطح (وب‌سایت عمومی، پنل خرده‌فروشی و پنل خرید بالا) با قابلیت گزینش ریز مشتریان، نمایش اختیاری زمان پایان به مشتری و انتقال خودکار به بایگانی پس از انقضا.
            </p>
          </div>
        </div>

        {/* Summary Counters */}
        <div className="grid grid-cols-3 gap-2.5 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50/80 border border-emerald-200 text-center">
            <div className="text-[11px] text-emerald-700 font-bold">در حال نمایش</div>
            <div className="text-base font-black text-emerald-900 font-mono">
              {toPersianDigits(categorizedAnnouncements.active.length)}
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-amber-50/80 border border-amber-200 text-center">
            <div className="text-[11px] text-amber-700 font-bold">زمان‌بندی‌شده</div>
            <div className="text-base font-black text-amber-900 font-mono">
              {toPersianDigits(categorizedAnnouncements.scheduled.length)}
            </div>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-slate-100 border border-slate-200 text-center">
            <div className="text-[11px] text-slate-600 font-bold">در بایگانی</div>
            <div className="text-base font-black text-slate-800 font-mono">
              {toPersianDigits(categorizedAnnouncements.archived.length)}
            </div>
          </div>
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-xs font-bold ${
            feedback.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:bg-black/5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Grid: Form (Right) + Live List & Archive (Left) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* 1. CREATE / EDIT FORM */}
        <div className="xl:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4.5 h-4.5 text-[#E06518]" />
              <h2 className="font-black text-sm sm:text-base text-slate-900">
                {draft.id ? 'ویرایش اطلاعیه انتخاب‌شده' : 'ثبت اطلاعیه جدید'}
              </h2>
            </div>
            {draft.id && (
              <button
                type="button"
                onClick={() => {
                  setDraft(createEmptyDraft(draft.portal));
                  setHasStartTime(false);
                  setHasEndTime(false);
                }}
                className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>انصراف از ویرایش</span>
              </button>
            )}
          </div>

          {/* STEP 1: 3 Audience Types */}
          <div className="space-y-2.5">
            <label className="block text-xs font-black text-slate-700">
              ۱. انتخاب نوع و جایگاه نمایش اطلاعیه (۳ سطح):
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {AUDIENCE_TYPES.map(aud => {
                const Icon = aud.icon;
                const isSelected = draft.portal === aud.id;
                return (
                  <button
                    key={aud.id}
                    type="button"
                    onClick={() =>
                      setDraft(prev => ({
                        ...prev,
                        portal: aud.id,
                        scope: aud.id === 'storefront' ? 'collective' : prev.scope,
                        targetCustomerIds: [],
                        targetCustomerNames: [],
                        targetCustomerId: undefined,
                        targetCustomerName: undefined,
                      }))
                    }
                    className={`text-right p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? 'border-[#E06518] bg-orange-50/60 ring-2 ring-[#E06518]/15'
                        : 'border-slate-200 bg-slate-50/60 hover:bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-[#E06518] text-white' : 'bg-white text-slate-600 border border-slate-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-[#E06518] text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">{aud.label}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 leading-snug">{aud.subtitle}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Granular Customer Selection for Retail (consumer) or High-Volume (high_volume) */}
          {draft.portal !== 'storefront' && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#E06518]" />
                  <span>
                    ۲. مخاطبان هدف در{' '}
                    {draft.portal === 'consumer' ? 'پنل خرده‌فروشی' : 'پنل خرید بالا (مصرف بالا)'}:
                  </span>
                </span>
                <div className="inline-flex rounded-xl bg-white p-1 border border-slate-200">
                  <button
                    type="button"
                    onClick={() =>
                      setDraft(prev => ({
                        ...prev,
                        scope: 'collective',
                        targetCustomerIds: [],
                        targetCustomerNames: [],
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      draft.scope === 'collective'
                        ? 'bg-[#2B313A] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    همه مشتریان این پنل ({toPersianDigits(panelCustomers.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft(prev => ({
                        ...prev,
                        scope: 'selected',
                      }))
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      draft.scope !== 'collective'
                        ? 'bg-[#E06518] text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>انتخاب مشتریان خاص</span>
                  </button>
                </div>
              </div>

              {draft.scope !== 'collective' ? (
                <div className="space-y-2.5 pt-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        placeholder={`جستجوی نام، شرکت یا شماره موبایل مشتری ${
                          draft.portal === 'consumer' ? 'خرده‌فروش' : 'خرید بالا'
                        }...`}
                        className="w-full h-9 pr-8 pl-3 rounded-xl border border-slate-200 bg-white text-xs focus:outline-none focus:border-[#E06518]"
                      />
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2" />
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <button
                        type="button"
                        onClick={handleSelectAllFilteredCustomers}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-[#E06518] text-slate-700 font-bold cursor-pointer"
                      >
                        انتخاب همه ({toPersianDigits(filteredPanelCustomers.length)})
                      </button>
                      {(draft.targetCustomerIds?.length || 0) > 0 && (
                        <button
                          type="button"
                          onClick={handleClearSelectedCustomers}
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold cursor-pointer"
                        >
                          پاک کردن ({toPersianDigits(draft.targetCustomerIds?.length || 0)})
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Customer Checkboxes List */}
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                    {filteredPanelCustomers.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        مشتری منطبقی در این پنل یافت نشد.
                      </div>
                    ) : (
                      filteredPanelCustomers.map(c => {
                        const checked = (draft.targetCustomerIds || []).includes(c.id);
                        return (
                          <label
                            key={c.id}
                            className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                              checked ? 'bg-orange-50/70' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleToggleCustomer(c.id)}
                                className="rounded border-slate-300 text-[#E06518] focus:ring-[#E06518]"
                              />
                              <div className="truncate">
                                <span className="font-bold text-slate-800">
                                  {c.fullName || c.name || 'مشتری'}
                                </span>
                                {(c.companyName || c.company) && (
                                  <span className="text-slate-500 mr-1.5">
                                    ({c.companyName || c.company})
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {c.assignedPriceListCode && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-mono">
                                  گرید {c.assignedPriceListCode}
                                </span>
                              )}
                              <span className="font-mono text-[11px] text-slate-500" dir="ltr">
                                {toPersianDigits(c.phone || c.mobile || '')}
                              </span>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  {(draft.targetCustomerIds?.length || 0) > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-600">
                        انتخاب‌شده ({toPersianDigits(draft.targetCustomerIds?.length || 0)} نفر):
                      </span>
                      {panelCustomers
                        .filter(c => (draft.targetCustomerIds || []).includes(c.id))
                        .slice(0, 8)
                        .map(c => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100/80 text-[#E06518] border border-orange-200 text-[10px] font-bold"
                          >
                            <span>{c.fullName || c.name}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleCustomer(c.id)}
                              className="hover:text-red-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              ) : (
                draft.portal === 'high_volume' && (
                  <div className="flex items-center justify-between gap-3 pt-1">
                    <span className="text-xs font-bold text-slate-600">
                      فیلتر سطح لیست قیمت (اختیاری):
                    </span>
                    <select
                      value={draft.targetTierCode || 'ALL'}
                      onChange={e => setDraft({ ...draft, targetTierCode: e.target.value })}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800"
                    >
                      <option value="ALL">همه سطوح پنل خرید بالا</option>
                      <option value="C">سطح C (برنزی)</option>
                      <option value="B">سطح B (نقره‌ای)</option>
                      <option value="A">سطح A (طلایی)</option>
                      <option value="D">سطح D (الماس / VIP)</option>
                    </select>
                  </div>
                )
              )}
            </div>
          )}

          {/* STEP 3: Announcement Content */}
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  عنوان اطلاعیه *
                </label>
                <input
                  type="text"
                  value={draft.title}
                  onChange={e => setDraft({ ...draft, title: e.target.value })}
                  placeholder="مثلاً: شارژ موجودی تسمه‌های تایمینگ SWR"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#E06518]/25 focus:border-[#E06518]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    برچسب موضوعی
                  </label>
                  <input
                    type="text"
                    value={draft.tag}
                    onChange={e => setDraft({ ...draft, tag: e.target.value })}
                    placeholder="فروش ویژه / موجودی"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#E06518]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عبارت برجسته (اختیاری)
                  </label>
                  <input
                    type="text"
                    value={draft.highlightValue || ''}
                    onChange={e => setDraft({ ...draft, highlightValue: e.target.value })}
                    placeholder="مثلاً: ۱۰٪ تخفیف"
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#E06518]"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                متن کامل اطلاعیه *
              </label>
              <textarea
                rows={3}
                value={draft.body}
                onChange={e => setDraft({ ...draft, body: e.target.value })}
                placeholder="متن پیام یا اطلاعیه خود را به صورت شفاف برای مشتریان بنویسید..."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#E06518]/25 focus:border-[#E06518]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  متن دکمه اقدام (اختیاری)
                </label>
                <input
                  type="text"
                  value={draft.actionLabel || ''}
                  onChange={e => setDraft({ ...draft, actionLabel: e.target.value })}
                  placeholder="مثلاً: مشاهده کاتالوگ / ثبت سفارش"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:outline-none focus:border-[#E06518]"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  لینک یا بخش مقصد دکمه (اختیاری)
                </label>
                <input
                  type="text"
                  value={draft.actionLink || draft.actionTab || ''}
                  onChange={e =>
                    setDraft({
                      ...draft,
                      actionLink: e.target.value.startsWith('/') ? e.target.value : '',
                      actionTab: !e.target.value.startsWith('/') ? e.target.value : '',
                    })
                  }
                  placeholder="/products یا quick_buy یا orders_pricelist"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-mono focus:outline-none focus:border-[#E06518]"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* STEP 4: Start & End Scheduling + Show End Time to Customer Toggle */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                <Clock className="w-4 h-4 text-[#E06518]" />
                <span>۳. تنظیمات زمان شروع، زمان پایان و بایگانی خودکار</span>
              </div>
              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(draft.pinned)}
                  onChange={e => setDraft({ ...draft, pinned: e.target.checked })}
                  className="rounded border-slate-300 text-[#E06518]"
                />
                <Pin className="w-3.5 h-3.5 text-[#E06518]" />
                <span>سنجاق در صدر اطلاعیه‌ها</span>
              </label>
            </div>

            {/* Start Time Toggle */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2.5">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasStartTime}
                    onChange={e => {
                      setHasStartTime(e.target.checked);
                      if (!e.target.checked) setDraft(prev => ({ ...prev, startsAt: null }));
                      else if (!draft.startsAt)
                        setDraft(prev => ({ ...prev, startsAt: new Date().toISOString() }));
                    }}
                    className="rounded border-slate-300 text-[#E06518]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    دارای زمان شروع مشخص (در غیر این صورت بلافاصله نمایش داده می‌شود)
                  </span>
                </div>
                <Calendar className="w-4 h-4 text-slate-400" />
              </label>

              {hasStartTime && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-slate-100">
                  <input
                    type="datetime-local"
                    value={toLocalDatetimeInputValue(draft.startsAt)}
                    onChange={e => {
                      const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                      setDraft(prev => ({ ...prev, startsAt: val }));
                    }}
                    className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
                    dir="ltr"
                  />
                  <span className="text-[11px] text-slate-500">
                    معادل شمسی: <strong className="text-slate-800">{formatPersianDateTime(draft.startsAt)}</strong>
                  </span>
                </div>
              )}
            </div>

            {/* End Time Toggle + Customer Visibility Switch */}
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-3">
              <label className="flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={hasEndTime}
                    onChange={e => {
                      setHasEndTime(e.target.checked);
                      if (!e.target.checked) {
                        setDraft(prev => ({ ...prev, endsAt: null, expiresAt: null }));
                      } else if (!draft.endsAt) {
                        const defaultEnd = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
                        setDraft(prev => ({ ...prev, endsAt: defaultEnd, expiresAt: defaultEnd }));
                      }
                    }}
                    className="rounded border-slate-300 text-[#E06518]"
                  />
                  <span className="text-xs font-bold text-slate-800">
                    دارای زمان پایان (پس از پایان زمان، خودکار به بایگانی منتقل می‌شود)
                  </span>
                </div>
                <Archive className="w-4 h-4 text-slate-400" />
              </label>

              {hasEndTime && (
                <div className="space-y-3 pt-2 border-t border-slate-100">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <input
                      type="datetime-local"
                      value={toLocalDatetimeInputValue(draft.endsAt)}
                      onChange={e => {
                        const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                        setDraft(prev => ({ ...prev, endsAt: val, expiresAt: val }));
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-mono"
                      dir="ltr"
                    />
                    <div className="flex flex-wrap items-center gap-1">
                      {[
                        { label: '+۲۴ ساعت', hours: 24 },
                        { label: '+۳ روز', hours: 72 },
                        { label: '+۱ هفته', hours: 168 },
                        { label: '+۱ ماه', hours: 720 },
                      ].map(preset => (
                        <button
                          key={preset.hours}
                          type="button"
                          onClick={() => applyQuickEndOffset(preset.hours)}
                          className="px-2 py-1 rounded-md bg-slate-100 hover:bg-orange-50 hover:text-[#E06518] text-[10px] font-bold text-slate-600 transition-colors cursor-pointer"
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    زمان پایان به شمسی: <strong className="text-slate-800">{formatPersianDateTime(draft.endsAt)}</strong>
                  </div>

                  {/* Show End Time To Customer Toggle */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-orange-50/60 border border-orange-200/80">
                    <div className="flex items-center gap-2">
                      {draft.showEndTimeToCustomer ? (
                        <Eye className="w-4 h-4 text-[#E06518]" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      )}
                      <div>
                        <div className="text-xs font-black text-slate-800">
                          نمایش زمان پایان اعتبار به مشتری
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {draft.showEndTimeToCustomer
                            ? 'مشتری تاریخ و زمان پایان این اطلاعیه را در کارت اعلان مشاهده می‌کند.'
                            : 'زمان پایان به مشتری نمایش داده نمی‌شود، اما در موعد مقرر خودکار بایگانی می‌گردد.'}
                        </div>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={Boolean(draft.showEndTimeToCustomer)}
                      onChange={e =>
                        setDraft(prev => ({
                          ...prev,
                          showEndTimeToCustomer: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 rounded border-slate-300 text-[#E06518] cursor-pointer"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={busy}
            onClick={handleSubmit}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#E06518] to-[#C95210] hover:from-[#C95210] hover:to-[#B34407] text-white font-black text-xs sm:text-sm shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            {draft.id ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            <span>
              {busy
                ? 'در حال همگام‌سازی با دیتابیس Supabase...'
                : draft.id
                  ? 'ذخیره تغییرات اطلاعیه'
                  : 'انتشار و ذخیره اطلاعیه در دیتابیس'}
            </span>
          </button>
        </div>

        {/* 2. LIST & ARCHIVE MANAGEMENT */}
        <div className="xl:col-span-6 space-y-4">
          {/* Status Tabs & Audience Filter */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    {
                      id: 'active',
                      label: 'فعال و در حال نمایش',
                      count: categorizedAnnouncements.active.length,
                    },
                    {
                      id: 'scheduled',
                      label: 'زمان‌بندی‌شده',
                      count: categorizedAnnouncements.scheduled.length,
                    },
                    {
                      id: 'archived',
                      label: 'بایگانی (پایان‌یافته)',
                      count: categorizedAnnouncements.archived.length,
                    },
                    {
                      id: 'all',
                      label: 'همه',
                      count: categorizedAnnouncements.all.length,
                    },
                  ] as const
                ).map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setStatusTab(t.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      statusTab === t.id
                        ? 'bg-[#2B313A] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
                    }`}
                  >
                    {t.id === 'archived' && <Archive className="w-3.5 h-3.5" />}
                    <span>{t.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        statusTab === t.id ? 'bg-[#E06518] text-white' : 'bg-white text-slate-700'
                      }`}
                    >
                      {toPersianDigits(t.count)}
                    </span>
                  </button>
                ))}
              </div>

              {/* Filter by 3 Audience Types */}
              <select
                value={audienceFilter}
                onChange={e => setAudienceFilter(e.target.value as AudienceFilter)}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="all">همه جایگاه‌ها (وب‌سایت + ۲ پنل)</option>
                <option value="storefront">فقط وب‌سایت عمومی</option>
                <option value="consumer">فقط پنل خرده‌فروشی</option>
                <option value="high_volume">فقط پنل خرید بالا</option>
              </select>
            </div>
          </div>

          {/* Announcements Cards */}
          {visibleAnnouncements.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-2">
              <Megaphone className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-700">
                هیچ اطلاعیه‌ای در این بخش وجود ندارد
              </div>
              <p className="text-xs text-slate-400">
                {statusTab === 'archived'
                  ? 'اطلاعیه‌هایی که زمان پایان آن‌ها به اتمام برسد، به‌صورت خودکار به این بخش منتقل می‌شوند.'
                  : 'از فرم سمت راست می‌توانید اطلاعیه جدیدی برای وب‌سایت یا پنل مشتریان ثبت کنید.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {visibleAnnouncements.map(ann => {
                const lifecycle = cms.getAnnouncementLifecycleStatus(ann);
                const audMeta =
                  AUDIENCE_TYPES.find(x => x.id === ann.portal) || AUDIENCE_TYPES[0];
                const endIso = ann.endsAt || ann.expiresAt;
                const customerCount =
                  ann.targetCustomerIds?.length || (ann.targetCustomerId ? 1 : 0);

                return (
                  <article
                    key={ann.id}
                    className={`bg-white rounded-2xl border p-4 shadow-xs transition-all space-y-3 ${
                      lifecycle === 'archived' || lifecycle === 'inactive'
                        ? 'border-slate-200 opacity-85 bg-slate-50/40'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${audMeta.badgeClass}`}
                        >
                          {audMeta.label}
                        </span>

                        {ann.portal !== 'storefront' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {ann.scope === 'collective'
                              ? 'همه مشتریان پنل'
                              : `${toPersianDigits(customerCount)} مشتری انتخاب‌شده`}
                          </span>
                        )}

                        {ann.tag && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-[#E06518]">
                            {ann.tag}
                          </span>
                        )}

                        {ann.pinned && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Pin className="w-2.5 h-2.5" />
                            <span>سنجاق</span>
                          </span>
                        )}
                      </div>

                      {/* Status Badge */}
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          lifecycle === 'active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : lifecycle === 'scheduled'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {lifecycle === 'active'
                          ? 'فعال در حال نمایش'
                          : lifecycle === 'scheduled'
                            ? 'در انتظار زمان شروع'
                            : 'در بایگانی'}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-black text-sm text-slate-900">{ann.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{ann.body}</p>
                    </div>

                    {/* Selected Customer Names Preview */}
                    {ann.portal !== 'storefront' &&
                      ann.scope !== 'collective' &&
                      (ann.targetCustomerNames?.length || ann.targetCustomerName) && (
                        <div className="text-[11px] text-slate-500 bg-slate-50 rounded-xl px-3 py-1.5 border border-slate-100">
                          <span className="font-bold text-slate-700">مشتریان انتخاب‌شده: </span>
                          <span>
                            {ann.targetCustomerNames?.length
                              ? ann.targetCustomerNames.join('، ')
                              : ann.targetCustomerName}
                          </span>
                        </div>
                      )}

                    {/* Schedule & End-time Visibility Metadata */}
                    {(ann.startsAt || endIso) && (
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 bg-slate-50/80 rounded-xl px-3 py-2 border border-slate-100">
                        {ann.startsAt && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>شروع:</span>
                            <strong className="text-slate-700">
                              {formatPersianDateTime(ann.startsAt)}
                            </strong>
                          </div>
                        )}
                        {endIso && (
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-[#E06518]" />
                            <span>پایان:</span>
                            <strong className="text-slate-700">
                              {formatPersianDateTime(endIso)}
                            </strong>
                          </div>
                        )}
                        {endIso && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              ann.showEndTimeToCustomer
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-slate-200/70 text-slate-600'
                            }`}
                          >
                            {ann.showEndTimeToCustomer ? (
                              <>
                                <Eye className="w-3 h-3" />
                                <span>نمایش زمان پایان به مشتری: فعال</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3 h-3" />
                                <span>نمایش زمان پایان به مشتری: مخفی</span>
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEdit(ann)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>ویرایش</span>
                        </button>

                        {lifecycle === 'archived' || lifecycle === 'inactive' ? (
                          <button
                            type="button"
                            onClick={() =>
                              runSave(() => {
                                cms.restoreAnnouncementFromArchive(ann.id);
                              }, 'اطلاعیه از بایگانی خارج و مجدداً فعال شد.')
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>بازگردانی از بایگانی</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              runSave(() => {
                                cms.archiveAnnouncement(ann.id);
                              }, 'اطلاعیه به بایگانی منتقل شد.')
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>انتقال به بایگانی</span>
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          runSave(() => {
                            cms.deleteAnnouncement(ann.id);
                          }, 'اطلاعیه حذف شد.')
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-red-600 hover:bg-red-50 font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف</span>
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
