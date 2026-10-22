import React, { useState, useMemo, useEffect } from 'react';
import {
  Award,
  CheckCircle2,
  Download,
  Upload,
  FileSpreadsheet,
  History,
  Trash2,
  Plus,
  Edit2,
  Users,
  Gift,
  Search,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Check,
  X,
  UserPlus,
  Layers,
  ShieldCheck,
  SlidersHorizontal,
  Eye,
} from 'lucide-react';
import {
  pricingCreditService,
  PriceListDefinition,
  PriceListExcelPreviewResult,
  PriceListHistoryRecord,
  ClubPortalTier,
  ClubRewardRule,
  CustomerRewardAssignment,
  CatalogSkuPriceItem,
} from '../../services/pricingCreditService';
import { Customer } from '../../types';
import { formatPrice, toPersianDigits } from '../../utils/formatters';

export const CustomerGradingModule: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'pricelists' | 'history' | 'customers' | 'club'>('pricelists');

  // --- Data States ---
  const [priceLists, setPriceLists] = useState<PriceListDefinition[]>(() =>
    pricingCreditService.getPriceLists()
  );
  const [selectedListId, setSelectedListId] = useState<string>('plist-a');
  const [catalogSkus, setCatalogSkus] = useState<CatalogSkuPriceItem[]>(() =>
    pricingCreditService.getAllCatalogSkuItems()
  );
  const [historyRecords, setHistoryRecords] = useState<PriceListHistoryRecord[]>(() =>
    pricingCreditService.getPriceListHistory()
  );
  const [customers, setCustomers] = useState<Customer[]>(() =>
    pricingCreditService
      .getAllCustomers()
      .filter(c => c.approvedB2B || c.isLegacyCustomer || (c.role && c.role !== 'retail'))
  );
  const [rewardRules, setRewardRules] = useState<ClubRewardRule[]>(() =>
    pricingCreditService.getClubRewardRules()
  );
  const [rewardAssignments, setRewardAssignments] = useState<CustomerRewardAssignment[]>(() =>
    pricingCreditService.getRewardAssignments()
  );

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const refreshAll = () => {
    setPriceLists(pricingCreditService.getPriceLists());
    setCatalogSkus(pricingCreditService.getAllCatalogSkuItems());
    setHistoryRecords(pricingCreditService.getPriceListHistory());
    setCustomers(
      pricingCreditService
        .getAllCustomers()
        .filter(c => c.approvedB2B || c.isLegacyCustomer || (c.role && c.role !== 'retail'))
    );
    setRewardRules(pricingCreditService.getClubRewardRules());
    setRewardAssignments(pricingCreditService.getRewardAssignments());
  };

  useEffect(() => {
    const sync = () => refreshAll();
    window.addEventListener('atlas-pricing-updated', sync);
    window.addEventListener('atlas-catalog-updated', sync);
    return () => {
      window.removeEventListener('atlas-pricing-updated', sync);
      window.removeEventListener('atlas-catalog-updated', sync);
    };
  }, []);

  const selectedPriceList = useMemo(
    () => priceLists.find(p => p.id === selectedListId) || priceLists[0],
    [priceLists, selectedListId]
  );

  // --- Tab 1: Price List Add/Edit Modal State ---
  const [isPriceListModalOpen, setIsPriceListModalOpen] = useState(false);
  const [editingPriceList, setEditingPriceList] = useState<PriceListDefinition | null>(null);

  // --- Tab 1: Excel Import & Diff Preview State ---
  const [excelPreview, setExcelPreview] = useState<PriceListExcelPreviewResult | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'changed' | 'all' | 'unchanged' | 'invalid'>('changed');
  const [applyTargetMode, setApplyTargetMode] = useState<'both' | 'pricelist_only'>('both');
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);

  // --- Tab 1: Direct SKU Price Table Search & Pagination ---
  const [skuSearch, setSkuSearch] = useState('');
  const [skuPage, setSkuPage] = useState(1);
  const [editingSkuPrices, setEditingSkuPrices] = useState<Record<string, number>>({});
  const skusPerPage = 15;

  const filteredSkus = useMemo(() => {
    const q = skuSearch.trim().toLowerCase();
    if (!q) return catalogSkus;
    return catalogSkus.filter(
      s =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.familyName.toLowerCase().includes(q)
    );
  }, [catalogSkus, skuSearch]);

  const totalSkuPages = Math.max(1, Math.ceil(filteredSkus.length / skusPerPage));
  const paginatedSkus = filteredSkus.slice((skuPage - 1) * skusPerPage, skuPage * skusPerPage);

  // --- Tab 2: History Detail Modal State ---
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<PriceListHistoryRecord | null>(null);
  const [historyFilterCode, setHistoryFilterCode] = useState<string>('ALL');

  // --- Tab 3: Customer Grading & Legacy Onboarding State ---
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilterGrade, setCustomerFilterGrade] = useState<string>('ALL');
  const [isLegacyModalOpen, setIsLegacyModalOpen] = useState(false);
  const [legacyForm, setLegacyForm] = useState({
    fullName: '',
    companyName: '',
    phone: '',
    city: 'یزد',
    assignedPriceListCode: 'A',
    previousPurchaseVolume: 650000000,
    creditLimit: 300000000,
    notes: 'مشتری قدیمی مجموعه - انتقال به سیستم جدید با لیست قیمت اختصاصی',
  });

  // --- Tab 4: Club & Collective/Individual Reward Assignment State ---
  const [assignMode, setAssignMode] = useState<'individual' | 'collective_grade' | 'collective_legacy'>('individual');
  const [selectedCustomerIdForReward, setSelectedCustomerIdForReward] = useState<string>('');
  const [selectedGradeForCollective, setSelectedGradeForCollective] = useState<string>('A');
  const [selectedRewardRuleId, setSelectedRewardRuleId] = useState<string>('rw-gold-credit');
  const [customRewardNote, setCustomRewardNote] = useState<string>('');
  const [isRewardRuleModalOpen, setIsRewardRuleModalOpen] = useState(false);
  const [editingRewardRule, setEditingRewardRule] = useState<ClubRewardRule | null>(null);

  // ============================================================================
  // HANDLERS: TAB 1 (PRICE LISTS & EXCEL)
  // ============================================================================
  const handleOpenNewPriceList = () => {
    const existingCodes = new Set(priceLists.map(p => p.code.toUpperCase()));
    const candidateCodes = ['E', 'F', 'G', 'VIP-PLUS'];
    const nextCode = candidateCodes.find(c => !existingCodes.has(c)) || `L-${priceLists.length + 1}`;
    setEditingPriceList({
      id: `plist-${Date.now()}`,
      code: nextCode,
      name: `لیست قیمت ${nextCode} (سفارشی)`,
      adminTitle: `لیست قیمت ${nextCode} (سفارشی)`,
      clubTier: 'gold',
      clubTierLabel: `سطح ویژه (${nextCode})`,
      customerTier: 'gold',
      customerTierLabel: `سطح ویژه (${nextCode})`,
      description: 'لیست قیمت اختصاصی تعریف‌شده توسط مدیر سیستم برای مشتریان منتخب',
      minPurchaseVolume: 300000000,
      discountPercent: 10,
      defaultDiscountPercent: 10,
      badgeColor: 'indigo',
      active: true,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
      skuPrices: {},
    });
    setIsPriceListModalOpen(true);
  };

  const handleOpenEditPriceList = (plist: PriceListDefinition) => {
    setEditingPriceList({ ...plist, skuPrices: { ...(plist.skuPrices || {}) } });
    setIsPriceListModalOpen(true);
  };

  const handleSavePriceListModal = () => {
    if (!editingPriceList || !editingPriceList.code?.trim() || !(editingPriceList.adminTitle || editingPriceList.name)?.trim()) {
      return;
    }
    const tierLabels: Record<string, string> = {
      vip: 'سطح الماس (VIP)',
      platinum: 'سطح پلاتینیوم (Platinum)',
      gold: 'سطح طلایی (Gold)',
      silver: 'سطح نقره‌ای (Silver)',
      bronze: 'سطح برنزی (Bronze)',
      retail: 'خرید نقدی (خرده‌فروشی)',
    };
    const toSave: PriceListDefinition = {
      ...editingPriceList,
      code: editingPriceList.code.trim().toUpperCase(),
      adminTitle: editingPriceList.adminTitle || editingPriceList.name,
      customerTierLabel:
        editingPriceList.customerTierLabel || (editingPriceList.customerTier && tierLabels[editingPriceList.customerTier]) || 'سطح طلایی',
    };
    pricingCreditService.savePriceList(toSave);
    refreshAll();
    setSelectedListId(toSave.id);
    setIsPriceListModalOpen(false);
    setEditingPriceList(null);
    showToast(`لیست قیمت «${toSave.adminTitle}» با موفقیت ذخیره شد.`);
  };

  const handleDeletePriceList = (id: string) => {
    pricingCreditService.deletePriceList(id);
    refreshAll();
    if (selectedListId === id) {
      setSelectedListId('plist-a');
    }
    showToast('لیست قیمت انتخابی حذف شد.');
  };

  const handleExportExcel = (listId: string) => {
    pricingCreditService.exportPriceListToExcel(listId);
    const pl = priceLists.find(p => p.id === listId);
    showToast(
      `فایل اکسل لیست قیمت «${pl?.adminTitle || listId}» شامل تک‌به‌تک کدهای کالا بدون تکرار دانلود شد.`
    );
  };

  const handleExcelFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedPriceList) return;
    setIsUploadingExcel(true);
    try {
      const preview = await pricingCreditService.parsePriceListExcelFile(file, selectedPriceList.id);
      setExcelPreview(preview);
      setPreviewFilter(preview.changedRowsCount > 0 ? 'changed' : 'all');
      showToast(
        `فایل «${file.name}» تحلیل شد: ${toPersianDigits(preview.changedRowsCount)} تغییر قیمت شناسایی گردید.`
      );
    } catch {
      showToast('خطا در خواندن فایل اکسل. لطفاً فایل استاندارد .xlsx یا .csv انتخاب کنید.');
    } finally {
      setIsUploadingExcel(false);
      e.target.value = '';
    }
  };

  const handleSimulateSampleExcelDiff = () => {
    if (!selectedPriceList) return;
    const sampleItems = catalogSkus.slice(0, 8);
    // Create an in-memory workbook with modified prices + 1 duplicate SKU to demonstrate deduplication
    const rows = sampleItems.map((item, idx) => {
      const currentPrice = pricingCreditService.getSkuPriceForList(
        item.code,
        item.basePrice,
        selectedPriceList
      );
      const base = currentPrice > 0 ? currentPrice : 1450000 + idx * 250000;
      const newPrice =
        idx % 3 === 0
          ? Math.round((base * 1.12) / 1000) * 1000
          : idx % 3 === 1
          ? Math.round((base * 0.94) / 1000) * 1000
          : base;
      return {
        'کد محصول': item.code,
        'نام محصول': item.name,
        'قیمت محصول (تومان)': newPrice,
      };
    });
    // Add a duplicate SKU row to prove automatic deduplication by SKU code
    if (sampleItems[0]) {
      rows.push({
        'کد محصول': sampleItems[0].code,
        'نام محصول': sampleItems[0].name + ' (ردیف تکراری در اکسل)',
        'قیمت محصول (تومان)': 2190000,
      });
    }

    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PriceList');
      const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const file = new File(
        [buf],
        `Sample_Edited_PriceList_${selectedPriceList.code}.xlsx`,
        { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
      );
      pricingCreditService.parsePriceListExcelFile(file, selectedPriceList.id).then(preview => {
        setExcelPreview(preview);
        setPreviewFilter('changed');
        showToast(
          `پیش‌نمایش تغییرات آماده شد: ${toPersianDigits(preview.changedRowsCount)} تغییر قیمت و ${toPersianDigits(preview.duplicateSkusMerged.length)} کد تکراری ادغام‌شده.`
        );
      });
    });
  };

  const handleConfirmAndApplyExcelChanges = () => {
    if (!excelPreview) return;
    const historyEntry = pricingCreditService.applyPriceListPreviewChanges(excelPreview, {
      updateBaseCatalogPrices: applyTargetMode === 'both',
      changedBy: 'مدیر بازرگانی (تایید اکسل)',
      notes: `اعمال تاییدشده تغییرات فایل اکسل (${excelPreview.fileName}) روی لیست قیمت ${excelPreview.priceListCode}`,
    });
    setExcelPreview(null);
    refreshAll();
    showToast(
      `تغییرات قیمت (${toPersianDigits(historyEntry.changedSkusCount)} کد کالا) با موفقیت در سایت اعمال و در تاریخچه لیست قیمت‌ها ثبت شد.`
    );
  };

  const handleSaveSingleSkuPrice = (skuItem: CatalogSkuPriceItem) => {
    if (!selectedPriceList) return;
    const rawVal = editingSkuPrices[skuItem.code];
    if (rawVal === undefined) return;
    const newPrice = Math.max(0, Number(rawVal) || 0);
    const oldPrice = pricingCreditService.getSkuPriceForList(
      skuItem.code,
      skuItem.basePrice,
      selectedPriceList
    );
    if (newPrice === oldPrice) return;

    const fakePreview: PriceListExcelPreviewResult = {
      priceListId: selectedPriceList.id,
      priceListCode: selectedPriceList.code,
      priceListTitle: selectedPriceList.adminTitle || selectedPriceList.name,
      fileName: `ویرایش مستقیم کد ${skuItem.code}`,
      totalRowsRead: 1,
      uniqueSkusProcessed: 1,
      duplicateSkusMerged: [],
      changedRowsCount: 1,
      unchangedRowsCount: 0,
      invalidRowsCount: 0,
      rows: [
        {
          code: skuItem.code,
          name: skuItem.name,
          familyCode: skuItem.familyCode,
          familyName: skuItem.familyName,
          categoryName: skuItem.categoryName || 'قطعات صنعتی',
          size: skuItem.size || 'استاندارد',
          oldPrice,
          newPrice,
          diffAmount: newPrice - oldPrice,
          diffPercent: oldPrice > 0 ? Math.round(((newPrice - oldPrice) / oldPrice) * 1000) / 10 : 100,
          changeType: newPrice > oldPrice ? 'increase' : 'decrease',
          status: newPrice > oldPrice ? 'increased' : 'decreased',
        },
      ],
    };

    pricingCreditService.applyPriceListPreviewChanges(fakePreview, {
      updateBaseCatalogPrices: selectedPriceList.code === 'RETAIL',
      changedBy: 'مدیر بازرگانی (ویرایش دستی کد کالا)',
    });
    refreshAll();
    showToast(`قیمت کد کالا ${skuItem.code} در «${selectedPriceList.adminTitle}» بروزرسانی و در تاریخچه ثبت شد.`);
  };

  // ============================================================================
  // HANDLERS: TAB 2 (PRICE LIST HISTORY)
  // ============================================================================
  const handleDeleteHistoryItem = (id: string) => {
    pricingCreditService.deletePriceListHistoryRecord(id);
    if (selectedHistoryRecord?.id === id) {
      setSelectedHistoryRecord(null);
    }
    refreshAll();
    showToast('رکورد تاریخچه لیست قیمت با موفقیت حذف شد.');
  };

  const handleClearAllHistory = () => {
    pricingCreditService.clearAllPriceListHistory();
    setSelectedHistoryRecord(null);
    refreshAll();
    showToast('تمام رکوردهای تاریخچه لیست قیمت پاکسازی شدند.');
  };

  // ============================================================================
  // HANDLERS: TAB 3 (CUSTOMER GRADING & LEGACY ONBOARDING)
  // ============================================================================
  const handleGradeChangeForCustomer = (customerId: string, newPriceListCode: string) => {
    const targetPl = priceLists.find(p => p.code.toUpperCase() === newPriceListCode.toUpperCase());
    pricingCreditService.assignCustomerGradeAndPriceList(customerId, {
      priceListCode: newPriceListCode,
      clubTier: targetPl?.customerTier,
    });
    refreshAll();
    showToast(
      `گرید مشتری به «لیست قیمت ${newPriceListCode} (${targetPl?.customerTierLabel || ''})» تغییر یافت.`
    );
  };

  const handleOnboardLegacyCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!legacyForm.fullName.trim() || !legacyForm.phone.trim()) return;
    const created = pricingCreditService.onboardLegacyCustomer(legacyForm);
    refreshAll();
    setIsLegacyModalOpen(false);
    setLegacyForm({
      fullName: '',
      companyName: '',
      phone: '',
      city: 'یزد',
      assignedPriceListCode: 'A',
      previousPurchaseVolume: 650000000,
      creditLimit: 300000000,
      notes: 'مشتری قدیمی مجموعه - انتقال به سیستم جدید با لیست قیمت اختصاصی',
    });
    showToast(
      `مشتری قدیمی «${created.companyName || created.fullName}» با لیست قیمت ${created.assignedPriceListCode} وارد سیستم شد.`
    );
  };

  // ============================================================================
  // HANDLERS: TAB 4 (CLUB REWARDS - INDIVIDUAL & COLLECTIVE)
  // ============================================================================
  const handleAssignRewardSubmit = () => {
    const rule = rewardRules.find(r => r.id === selectedRewardRuleId) || rewardRules[0];
    if (!rule) return;

    if (assignMode === 'individual') {
      const cust = customers.find(c => c.id === selectedCustomerIdForReward) || customers[0];
      if (!cust) return;
      pricingCreditService.assignRewardToCustomers({
        reward: rule,
        assignmentScope: 'individual',
        targetCustomers: [cust],
        notes: customRewardNote || `اعطای اختصاصی به ${cust.companyName || cust.fullName}`,
      });
      refreshAll();
      setCustomRewardNote('');
      showToast(`جایزه «${rule.title}» برای مشتری «${cust.companyName || cust.fullName}» ثبت شد.`);
    } else if (assignMode === 'collective_grade') {
      const targetPl = priceLists.find(p => p.code === selectedGradeForCollective);
      const matchingCustomers = customers.filter(
        c => (c.assignedPriceListCode || 'C').toUpperCase() === selectedGradeForCollective.toUpperCase()
      );
      pricingCreditService.assignRewardToCustomers({
        reward: rule,
        assignmentScope: 'collective',
        targetCustomers: matchingCustomers,
        targetTierLabel: `کلیه مشتریان لیست قیمت ${selectedGradeForCollective} (${targetPl?.customerTierLabel || ''}) — ${toPersianDigits(matchingCustomers.length)} مشتری`,
        notes: customRewardNote || `اعطای دسته‌جمعی به مشتریان گرید ${selectedGradeForCollective}`,
      });
      refreshAll();
      setCustomRewardNote('');
      showToast(
        `جایزه دسته‌جمعی «${rule.title}» برای ${toPersianDigits(matchingCustomers.length)} مشتری لیست قیمت ${selectedGradeForCollective} فعال شد.`
      );
    } else {
      const legacyCustomers = customers.filter(c => c.isLegacyCustomer);
      pricingCreditService.assignRewardToCustomers({
        reward: rule,
        assignmentScope: 'collective',
        targetCustomers: legacyCustomers,
        targetTierLabel: `کلیه مشتریان قدیمی و وفادار مجموعه (${toPersianDigits(legacyCustomers.length)} مشتری)`,
        notes: customRewardNote || 'پاداش وفاداری مشتریان قدیمی انتقال‌یافته به سیستم',
      });
      refreshAll();
      setCustomRewardNote('');
      showToast(
        `جایزه دسته‌جمعی برای ${toPersianDigits(legacyCustomers.length)} مشتری قدیمی مجموعه ثبت شد.`
      );
    }
  };

  const handleSaveRewardRuleModal = () => {
    if (!editingRewardRule || !editingRewardRule.title.trim()) return;
    pricingCreditService.saveClubRewardRule(editingRewardRule);
    refreshAll();
    setIsRewardRuleModalOpen(false);
    setEditingRewardRule(null);
    showToast('جایزه باشگاه مشتریان ذخیره شد.');
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 left-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-amber-500/40 flex items-center gap-3 text-xs font-bold">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* =====================================================================
          HEADER & ARCHITECTURE EXPLANATION
         ===================================================================== */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-50 text-[#E06518] border border-orange-200 text-[11px] font-bold mb-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>ماژول مستقل قیمت‌گذاری، لیست قیمت (A/B/C/D) و باشگاه مشتریان (بدون تصویر و موجودی)</span>
            </div>
            <h2 className="text-lg font-black text-slate-900">
              مدیریت لیست‌های قیمت (A تا D)، اکسل قیمت‌گذاری، تاریخچه و گریدبندی مشتریان خرید بالا
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              مشتریان خرده‌فروش در پنل <span className="font-mono font-bold text-slate-700" dir="ltr">/consumer-dashboard</span> به صورت نقدی خرید می‌کنند؛ مشتریان خرید بالا در پنل <span className="font-mono font-bold text-[#E06518]" dir="ltr">/account</span> بر اساس حجم خرید گریدبندی شده (لیست قیمت A، B، C، D معادل سطوح طلایی، نقره‌ای، برنزی و الماس) و قیمت و جوایز اختصاصی دریافت می‌کنند.
            </p>
          </div>

          {/* 4 Main Section Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
            {[
              {
                id: 'pricelists',
                label: `۱. لیست‌های قیمت (A/B/C/D) و اکسل (${toPersianDigits(priceLists.length)})`,
                icon: FileSpreadsheet,
              },
              {
                id: 'history',
                label: `۲. تاریخچه لیست قیمت‌ها (${toPersianDigits(historyRecords.length)})`,
                icon: History,
              },
              {
                id: 'customers',
                label: `۳. گریدبندی مشتریان و مشتریان قدیمی (${toPersianDigits(customers.length)})`,
                icon: Users,
              },
              {
                id: 'club',
                label: '۴. باشگاه مشتریان و جوایز (تکی و دسته‌جمعی)',
                icon: Gift,
              },
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                    activeTab === tab.id
                      ? 'bg-white text-[#E06518] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mapping Overview Bar: Admin A/B/C/D <-> Customer /account Bronze/Silver/Gold/VIP */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {priceLists.map(pl => {
            const isSelected = selectedPriceList?.id === pl.id;
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => {
                  setSelectedListId(pl.id);
                  setActiveTab('pricelists');
                }}
                className={`p-3 rounded-xl border text-right transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#E06518] bg-orange-50/70 ring-1 ring-[#E06518]'
                    : 'border-slate-200 bg-slate-50/70 hover:bg-white'
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-[11px]">
                    لیست {pl.code}
                  </span>
                  <span className="text-[11px] font-bold text-[#E06518]">
                    {pl.customerTierLabel}
                  </span>
                </div>
                <div className="font-bold text-slate-800 truncate">{pl.adminTitle}</div>
                <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                  <span>تخفیف پایه: {toPersianDigits(pl.defaultDiscountPercent)}٪</span>
                  <span>
                    حداقل خرید:{' '}
                    {pl.minPurchaseVolume > 0
                      ? `${toPersianDigits(Math.round(pl.minPurchaseVolume / 1000000))} میلیون`
                      : 'نقدی'}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          TAB 1: PRICE LISTS (A, B, C, D, ...) & EXCEL EXPORT / IMPORT / DIFF
         ===================================================================== */}
      {activeTab === 'pricelists' && selectedPriceList && (
        <div className="space-y-6">
          {/* Price Lists Management Row */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-[#E06518]" />
                  <span>مدیریت لیست‌های قیمت (قابل افزودن و ویرایش: A، B، C، D و...)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  هر لیست قیمت دارای کد پنل مدیریت (A، B، C، D) و عنوان متناظر در پنل مشتریان خرید بالا (<span className="font-mono" dir="ltr">/account</span>: طلایی، نقره‌ای، برنزی، الماس) است.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenEditPriceList(selectedPriceList)}
                  className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  <span>ویرایش «{selectedPriceList.adminTitle}»</span>
                </button>
                <button
                  type="button"
                  onClick={handleOpenNewPriceList}
                  className="px-4 py-2 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ افزودن لیست قیمت جدید (مثلاً E)</span>
                </button>
              </div>
            </div>

            {/* Selected Price List Info & Excel Action Box */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Left: Active Price List Details */}
              <div className="lg:col-span-5 p-4 rounded-2xl bg-slate-900 text-white flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs font-mono">
                      کد پنل مدیریت: لیست قیمت {selectedPriceList.code}
                    </span>
                    <span className="px-3 py-1 rounded-lg bg-white/10 text-amber-300 font-bold text-xs">
                      نمایش در پنل /account: {selectedPriceList.customerTierLabel}
                    </span>
                  </div>
                  <h4 className="text-lg font-black text-white pt-1">
                    {selectedPriceList.adminTitle}
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedPriceList.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
                  <div className="p-2.5 rounded-xl bg-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">حداقل حجم خرید</span>
                    <span className="text-xs font-black text-amber-400 font-mono mt-0.5 block">
                      {selectedPriceList.minPurchaseVolume > 0
                        ? `${toPersianDigits(
                            new Intl.NumberFormat('fa-IR').format(selectedPriceList.minPurchaseVolume)
                          )} ت`
                        : 'بدون محدودیت'}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">تخفیف پیش‌فرض گرید</span>
                    <span className="text-xs font-black text-emerald-400 font-mono mt-0.5 block">
                      {toPersianDigits(selectedPriceList.defaultDiscountPercent)}٪
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-800/80">
                    <span className="text-[10px] text-slate-400 block">کل کدهای کالا (SKU)</span>
                    <span className="text-xs font-black text-white font-mono mt-0.5 block">
                      {toPersianDigits(catalogSkus.length)} کد یکتا
                    </span>
                  </div>
                </div>
              </div>

              {/* Right: Excel Download & Upload Workflow */}
              <div className="lg:col-span-7 p-4 rounded-2xl bg-emerald-50/60 border-2 border-emerald-200 flex flex-col justify-between space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h4 className="text-sm font-black text-emerald-950 flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                      <span>دریافت و ورود فایل اکسل قیمت‌گذاری (بر اساس کد کالا - بدون تکرار)</span>
                    </h4>
                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      تشخیص هوشمند بر اساس «کد محصول»
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    ۱. ابتدا فایل اکسل شامل <strong>کد محصول، نام محصول و قیمت محصول</strong> برای تک‌به‌تک محصولات ({toPersianDigits(catalogSkus.length)} کد کالای یکتا) را دانلود کنید.
                    <br />
                    ۲. قیمت‌ها را در اکسل تغییر دهید و همان فایل را وارد کنید تا سیستم <strong>لیست تغییرات قیمت</strong> را قبل از تایید نهایی به شما نمایش دهد.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleExportExcel(selectedPriceList.id)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>دانلود فایل اکسل «{selectedPriceList.adminTitle}» (.xlsx)</span>
                  </button>

                  <label className="px-4 py-2.5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors">
                    <Upload className="w-4 h-4" />
                    <span>
                      {isUploadingExcel
                        ? 'در حال بررسی فایل اکسل...'
                        : 'بارگذاری فایل اکسل ویرایش‌شده (.xlsx)'}
                    </span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleExcelFileUpload}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={handleSimulateSampleExcelDiff}
                    className="px-3.5 py-2.5 rounded-xl bg-white hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#E06518]" />
                    <span>تست سریع پیش‌نمایش تغییرات اکسل</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ===============================================================
              EXCEL DIFF PREVIEW & CONFIRMATION PANEL (WHEN FILE IS UPLOADED)
             =============================================================== */}
          {excelPreview && (
            <div className="bg-white rounded-3xl border-2 border-[#E06518] shadow-xl overflow-hidden space-y-4">
              <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-md bg-[#E06518] text-white text-[11px] font-black">
                      پیش‌نمایش تغییرات قبل از تایید نهایی
                    </span>
                    <h4 className="text-sm sm:text-base font-black">
                      بررسی تغییرات فایل «{excelPreview.fileName}» برای {excelPreview.priceListTitle}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">
                    سیستم کدهای کالا را بررسی و ردیف‌های تکراری را ادغام کرد. لطفاً تغییرات زیر را بررسی و در صورت صحت، دکمهٔ «تایید نهایی و اعمال در سایت» را بزنید.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleConfirmAndApplyExcelChanges}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>تایید نهایی و اعمال قیمت‌ها در سایت ({toPersianDigits(excelPreview.changedRowsCount)} تغییر)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExcelPreview(null)}
                    className="px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                </div>
              </div>

              <div className="px-5 space-y-4 pb-5">
                {/* Summary Stats of Parsed Excel */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">کل ردیف‌های فایل اکسل</span>
                    <span className="text-base font-black text-slate-800 font-mono">
                      {toPersianDigits(excelPreview.totalRowsRead)} ردیف
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <span className="text-[11px] text-blue-800 block">کدهای کالای یکتا (بدون تکرار)</span>
                    <span className="text-base font-black text-blue-900 font-mono">
                      {toPersianDigits(excelPreview.uniqueSkusProcessed)} کد کالا
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-300">
                    <span className="text-[11px] text-amber-900 block">کالاهای دارای تغییر قیمت</span>
                    <span className="text-base font-black text-[#E06518] font-mono">
                      {toPersianDigits(excelPreview.changedRowsCount)} کد کالا
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200">
                    <span className="text-[11px] text-purple-800 block">کدهای تکراری ادغام‌شده</span>
                    <span className="text-base font-black text-purple-900 font-mono">
                      {toPersianDigits(excelPreview.duplicateSkusMerged.length)} مورد
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="text-[11px] text-slate-500 block">بدون تغییر قیمت</span>
                    <span className="text-base font-black text-slate-700 font-mono">
                      {toPersianDigits(excelPreview.unchangedRowsCount)} کد کالا
                    </span>
                  </div>
                </div>

                {/* Deduplication Notice if duplicates existed in Excel */}
                {excelPreview.duplicateSkusMerged.length > 0 && (
                  <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-950 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-purple-700 shrink-0" />
                      <span>
                        <strong>جلوگیری از تکرار کد کالا:</strong> کدهای{' '}
                        <span className="font-mono font-bold" dir="ltr">
                          {excelPreview.duplicateSkusMerged.join(', ')}
                        </span>{' '}
                        در فایل اکسل بیش از یک‌بار تکرار شده بودند که به صورت خودکار بر اساس کد کالا ادغام شدند تا هیچ فیلد تکراری ثبت نشود.
                      </span>
                    </div>
                  </div>
                )}

                {/* Filter Bar & Target Option */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      {
                        id: 'changed',
                        label: `فقط کالاهای تغییریافته (${toPersianDigits(excelPreview.changedRowsCount)})`,
                      },
                      {
                        id: 'all',
                        label: `همه کدهای بررسی‌شده (${toPersianDigits(excelPreview.rows.length)})`,
                      },
                      {
                        id: 'unchanged',
                        label: `بدون تغییر (${toPersianDigits(excelPreview.unchangedRowsCount)})`,
                      },
                      {
                        id: 'invalid',
                        label: `کدهای نامعتبر (${toPersianDigits(excelPreview.invalidRowsCount)})`,
                      },
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setPreviewFilter(f.id as any)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                          previewFilter === f.id
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                    <input
                      type="checkbox"
                      checked={applyTargetMode === 'both'}
                      onChange={e =>
                        setApplyTargetMode(e.target.checked ? 'both' : 'pricelist_only')
                      }
                      className="w-4 h-4 accent-[#E06518]"
                    />
                    <span>بروزرسانی هم‌زمان قیمت کد کالا در صفحه محصول سایت و لیست قیمت {excelPreview.priceListCode}</span>
                  </label>
                </div>

                {/* Diff Table */}
                <div className="overflow-x-auto rounded-2xl border border-slate-200 max-h-96">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-slate-100 text-slate-700 sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4 font-bold">کد کالا (SKU)</th>
                        <th className="py-3 px-4 font-bold">نام کالا</th>
                        <th className="py-3 px-4 font-bold">خانواده محصول</th>
                        <th className="py-3 px-4 font-bold">قیمت قبلی (تومان)</th>
                        <th className="py-3 px-4 font-bold">قیمت جدید در اکسل (تومان)</th>
                        <th className="py-3 px-4 font-bold">تغییر قیمت</th>
                        <th className="py-3 px-4 font-bold">وضعیت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {excelPreview.rows
                        .filter(r => {
                          if (previewFilter === 'changed') {
                            return (
                              r.status === 'increased' ||
                              r.status === 'decreased' ||
                              r.status === 'new_price'
                            );
                          }
                          if (previewFilter === 'unchanged') return r.status === 'unchanged';
                          if (previewFilter === 'invalid') {
                            return r.status === 'not_found' || r.status === 'invalid';
                          }
                          return true;
                        })
                        .slice(0, 200)
                        .map(row => (
                          <tr
                            key={row.code}
                            className={
                              row.status === 'increased'
                                ? 'bg-amber-50/40'
                                : row.status === 'decreased'
                                ? 'bg-emerald-50/40'
                                : row.status === 'new_price'
                                ? 'bg-blue-50/40'
                                : ''
                            }
                          >
                            <td className="py-2.5 px-4 font-mono font-black text-[#E06518]" dir="ltr">
                              {row.code}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-800">{row.name}</td>
                            <td className="py-2.5 px-4 text-slate-500">{row.familyName}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-600">
                              {row.oldPrice > 0 ? formatPrice(row.oldPrice) : 'بدون قیمت (استعلامی)'}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-black text-slate-900">
                              {row.newPrice > 0 ? formatPrice(row.newPrice) : 'استعلامی (۰)'}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold" dir="ltr">
                              {row.diffAmount > 0 ? (
                                <span className="text-amber-700 flex items-center gap-0.5">
                                  <ArrowUpRight className="w-3.5 h-3.5" />+
                                  {toPersianDigits(
                                    new Intl.NumberFormat('fa-IR').format(row.diffAmount)
                                  )}{' '}
                                  ({toPersianDigits(row.diffPercent)}%)
                                </span>
                              ) : row.diffAmount < 0 ? (
                                <span className="text-emerald-700 flex items-center gap-0.5">
                                  <ArrowDownRight className="w-3.5 h-3.5" />
                                  {toPersianDigits(
                                    new Intl.NumberFormat('fa-IR').format(row.diffAmount)
                                  )}{' '}
                                  ({toPersianDigits(row.diffPercent)}%)
                                </span>
                              ) : (
                                <span className="text-slate-400">۰</span>
                              )}
                            </td>
                            <td className="py-2.5 px-4">
                              {row.status === 'increased' && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold text-[11px]">
                                  افزایش قیمت
                                </span>
                              )}
                              {row.status === 'decreased' && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 font-bold text-[11px]">
                                  کاهش قیمت
                                </span>
                              )}
                              {row.status === 'new_price' && (
                                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold text-[11px]">
                                  تعیین قیمت جدید
                                </span>
                              )}
                              {row.status === 'unchanged' && (
                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px]">
                                  بدون تغییر
                                </span>
                              )}
                              {(row.status === 'not_found' || row.status === 'invalid') && (
                                <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-bold text-[11px]">
                                  {row.errorMessage || 'کد نامعتبر'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===============================================================
              DIRECT SKU PRICE TABLE (NO IMAGES, NO STOCK - PURE SKU PRICING)
             =============================================================== */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="font-black text-sm text-slate-800">
                  جدول مستقیم قیمت کدهای کالا در «{selectedPriceList.adminTitle}» (بدون تصویر و موجودی)
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  تمام کدهای کالا یکتا هستند. می‌توانید قیمت هر کد کالا را مستقیماً تغییر دهید یا از طریق فایل اکسل بالا به صورت یکجا بروزرسانی کنید.
                </p>
              </div>

              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={skuSearch}
                  onChange={e => {
                    setSkuSearch(e.target.value);
                    setSkuPage(1);
                  }}
                  placeholder="جستجوی کد کالا (مثلاً 34265) یا نام محصول..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-[#E06518] focus:outline-none"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-bold">کد محصول (SKU یکتا)</th>
                    <th className="py-3 px-4 font-bold">نام محصول</th>
                    <th className="py-3 px-4 font-bold">خانواده محصول</th>
                    <th className="py-3 px-4 font-bold">قیمت پایه / نقدی</th>
                    <th className="py-3 px-4 font-bold">
                      قیمت در {selectedPriceList.adminTitle} ({selectedPriceList.customerTierLabel})
                    </th>
                    <th className="py-3 px-4 font-bold">ویرایش سریع قیمت این کد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedSkus.map(sku => {
                    const activeListPrice = pricingCreditService.getSkuPriceForList(
                      sku.code,
                      sku.basePrice,
                      selectedPriceList
                    );
                    const draftVal =
                      editingSkuPrices[sku.code] !== undefined
                        ? editingSkuPrices[sku.code]
                        : activeListPrice;
                    return (
                      <tr key={sku.code} className="hover:bg-slate-50/80">
                        <td className="py-3 px-4 font-mono font-black text-[#E06518]" dir="ltr">
                          {sku.code}
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-800">{sku.name}</td>
                        <td className="py-3 px-4 text-slate-500">{sku.familyName}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {sku.basePrice > 0 ? `${formatPrice(sku.basePrice)} ت` : 'نیازمند استعلام'}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-emerald-800">
                          {activeListPrice > 0
                            ? `${formatPrice(activeListPrice)} تومان`
                            : 'نیازمند استعلام'}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step={10000}
                              value={draftVal}
                              onChange={e =>
                                setEditingSkuPrices({
                                  ...editingSkuPrices,
                                  [sku.code]: Number(e.target.value) || 0,
                                })
                              }
                              className="w-32 px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs bg-white"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveSingleSkuPrice(sku)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-[#E06518] text-white font-bold text-[11px] cursor-pointer transition-colors"
                            >
                              ثبت
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
              <span className="text-slate-500">
                نمایش صفحه {toPersianDigits(skuPage)} از {toPersianDigits(totalSkuPages)} (کل کدهای یکتا:{' '}
                {toPersianDigits(filteredSkus.length)})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={skuPage <= 1}
                  onClick={() => setSkuPage(p => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 font-bold cursor-pointer"
                >
                  قبلی
                </button>
                <button
                  type="button"
                  disabled={skuPage >= totalSkuPages}
                  onClick={() => setSkuPage(p => Math.min(totalSkuPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 font-bold cursor-pointer"
                >
                  بعدی
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: PRICE LIST HISTORY (VIEW ADDED & PREVIOUS LISTS + DELETE)
         ===================================================================== */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                  <History className="w-5 h-5 text-[#E06518]" />
                  <span>تاریخچه لیست قیمت‌های اضافه‌شده و لیست قیمت‌های قبلی</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  مشاهده تمام لیست قیمت‌های قبلی و فایل‌های اکسل اعمال‌شده به همراه جزئیات تغییرات هر کد کالا و امکان حذف تاریخچه
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={historyFilterCode}
                  onChange={e => setHistoryFilterCode(e.target.value)}
                  className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white font-bold"
                >
                  <option value="ALL">همه لیست‌های قیمت (A / B / C / D)</option>
                  {priceLists.map(pl => (
                    <option key={pl.id} value={pl.code}>
                      فقط تاریخچه لیست {pl.code} ({pl.customerTierLabel})
                    </option>
                  ))}
                </select>

                {historyRecords.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearAllHistory}
                    className="px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>پاکسازی کل تاریخچه</span>
                  </button>
                )}
              </div>
            </div>

            {historyRecords.length === 0 ? (
              <div className="p-10 text-center text-slate-500 space-y-2">
                <History className="w-10 h-10 text-slate-300 mx-auto" />
                <div className="font-bold text-sm text-slate-700">
                  هیچ رکوردی در تاریخچه لیست قیمت‌ها وجود ندارد
                </div>
                <p className="text-xs">
                  با بارگذاری فایل اکسل یا تغییر قیمت‌ها در تب اول، تاریخچه به صورت خودکار در این بخش ثبت می‌شود.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {historyRecords
                  .filter(h => historyFilterCode === 'ALL' || h.priceListCode === historyFilterCode)
                  .map(record => (
                    <div
                      key={record.id}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-[#E06518]/60 bg-slate-50/50 hover:bg-white transition-all flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-900 text-white font-mono font-black text-xs">
                            لیست قیمت {record.priceListCode}
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                              record.sourceType === 'excel_import'
                                ? 'bg-emerald-100 text-emerald-900'
                                : record.sourceType === 'initial_baseline'
                                ? 'bg-blue-100 text-blue-900'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {record.sourceType === 'excel_import'
                              ? 'اضافه‌شده با فایل اکسل'
                              : record.sourceType === 'initial_baseline'
                              ? 'لیست قیمت قبلی (نسخه پایه)'
                              : 'ویرایش در پنل مدیریت'}
                          </span>
                          <span className="text-xs font-black text-slate-800">
                            {record.priceListTitle}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            • تاریخ: {record.createdAt}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600">
                          فایل / منبع: <strong className="font-mono">{record.fileName || 'سیستم'}</strong>{' '}
                          | ثبت توسط: <strong>{record.changedBy}</strong>
                          {record.notes && <span> — {record.notes}</span>}
                        </div>

                        <div className="flex items-center gap-4 text-[11px] pt-1">
                          <span className="text-slate-600">
                            تعداد تغییرات: <strong className="text-slate-900">{toPersianDigits(record.changedSkusCount)} کد کالا</strong>
                          </span>
                          <span className="text-amber-700 font-semibold">
                            افزایش قیمت: {toPersianDigits(record.increasedCount)} کد
                          </span>
                          <span className="text-emerald-700 font-semibold">
                            کاهش قیمت: {toPersianDigits(record.decreasedCount)} کد
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryRecord(record)}
                          className="px-3.5 py-2 rounded-xl bg-white hover:bg-orange-50 text-[#E06518] border border-orange-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>مشاهده ریز تغییرات و قیمت‌های این نسخه</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteHistoryItem(record.id)}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                          title="حذف این تاریخچه"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف تاریخچه</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Modal to View Detailed SKU Changes in a History Record */}
          {selectedHistoryRecord && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white w-full max-w-4xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
                  <div>
                    <h4 className="text-sm font-black">
                      جزئیات تاریخچه: {selectedHistoryRecord.priceListTitle} ({selectedHistoryRecord.createdAt})
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      منبع: {selectedHistoryRecord.fileName} | ثبت توسط: {selectedHistoryRecord.changedBy}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDeleteHistoryItem(selectedHistoryRecord.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                    >
                      حذف این تاریخچه
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedHistoryRecord(null)}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold cursor-pointer"
                    >
                      بستن
                    </button>
                  </div>
                </div>

                <div className="p-5 overflow-y-auto space-y-4 text-xs">
                  <div className="font-bold text-slate-800">
                    لیست کدهای کالای تغییریافته در این نسخه ({toPersianDigits(selectedHistoryRecord.changes.length)} ردیف):
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                        <tr>
                          <th className="py-2.5 px-4 font-bold">کد کالا</th>
                          <th className="py-2.5 px-4 font-bold">نام کالا</th>
                          <th className="py-2.5 px-4 font-bold">قیمت قبلی (تومان)</th>
                          <th className="py-2.5 px-4 font-bold">قیمت ثبت‌شده (تومان)</th>
                          <th className="py-2.5 px-4 font-bold">درصد تغییر</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedHistoryRecord.changes.map((ch, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono font-black text-[#E06518]" dir="ltr">
                              {ch.code}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-800">{ch.name}</td>
                            <td className="py-2.5 px-4 font-mono text-slate-500">
                              {ch.oldPrice > 0 ? formatPrice(ch.oldPrice) : 'بدون قیمت'}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-black text-emerald-800">
                              {ch.newPrice > 0 ? formatPrice(ch.newPrice) : 'استعلامی'}
                            </td>
                            <td className="py-2.5 px-4 font-mono font-bold" dir="ltr">
                              {ch.diffPercent > 0
                                ? `+${toPersianDigits(ch.diffPercent)}%`
                                : `${toPersianDigits(ch.diffPercent)}%`}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: CUSTOMER GRADING (/account) & LEGACY CUSTOMER ONBOARDING
         ===================================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#E06518]" />
                  <span>گریدبندی اختصاصی مشتریان پنل خرید بالا (/account) تعریف‌شده در CRM</span>
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  گریدبندی مشتریان صرفاً ویژه مشتریان پنل خرید بالا (<span className="font-mono font-bold" dir="ltr">/account</span>) است که در بخش «مشتریان و CRM» تعریف شده‌اند (شامل مشتریان خرده‌فروش نمی‌شود). هر مشتری به یکی از لیست‌های قیمت <strong>A (طلایی)، B (نقره‌ای)، C (برنزی) یا D (الماس)</strong> متصل می‌گردد.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsLegacyModalOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ تعریف سریع مشتری پنل خرید بالا (با گرید A/B/C/D)</span>
              </button>
            </div>

            {/* Search & Grade Filter */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  placeholder="جستجوی نام مشتری، نام کاربری، شرکت یا شماره تماس..."
                  className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { id: 'ALL', label: 'همه مشتریان خرید بالا (CRM)' },
                  { id: 'A', label: 'لیست قیمت A (طلایی)' },
                  { id: 'B', label: 'لیست قیمت B (نقره‌ای)' },
                  { id: 'C', label: 'لیست قیمت C (برنزی)' },
                  { id: 'D', label: 'لیست قیمت D (الماس VIP)' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCustomerFilterGrade(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                      customerFilterGrade === f.id
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Customers Grading Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-bold">مشتری / مجموعه (تعریف‌شده در CRM)</th>
                    <th className="py-3 px-4 font-bold">نام کاربری و موبایل ورود (/account)</th>
                    <th className="py-3 px-4 font-bold">حجم کل خرید (تومان)</th>
                    <th className="py-3 px-4 font-bold">پیشنهاد هوشمند سیستم</th>
                    <th className="py-3 px-4 font-bold">لیست قیمت فعلی (پنل مدیریت)</th>
                    <th className="py-3 px-4 font-bold">نمایش در پنل /account مشتری</th>
                    <th className="py-3 px-4 font-bold">تغییر گرید / لیست قیمت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {customers
                    .filter(c => {
                      const q = customerSearch.trim().toLowerCase();
                      if (
                        q &&
                        !`${c.fullName} ${c.companyName || ''} ${c.username || ''} ${c.phone}`
                          .toLowerCase()
                          .includes(q)
                      ) {
                        return false;
                      }
                      if (customerFilterGrade !== 'ALL') {
                        return (c.assignedPriceListCode || 'C').toUpperCase() === customerFilterGrade;
                      }
                      return true;
                    })
                    .map(cust => {
                      const vol = cust.totalPurchases || 0;
                      const suggested = pricingCreditService.recommendGradeByPurchaseVolume(vol);
                      const activeCode = (cust.assignedPriceListCode || 'C').toUpperCase();
                      const activePl =
                        priceLists.find(p => p.code.toUpperCase() === activeCode) || priceLists[0];
                      return (
                        <tr key={cust.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4">
                            <div className="font-black text-slate-800">
                              {cust.companyName || cust.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {cust.fullName} • {cust.city || 'یزد'}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono font-bold text-slate-900" dir="ltr">
                                {cust.username || cust.phone}
                              </span>
                              <span className="font-mono text-[11px] text-slate-500" dir="ltr">
                                {cust.phone}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-800">
                            {formatPrice(vol)} ت
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[11px] text-slate-600">
                              پیشنهاد حجم خرید:{' '}
                              <strong className="text-[#E06518]">
                                لیست {suggested.code} ({suggested.customerTierLabel})
                              </strong>
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-3 py-1 rounded-lg bg-slate-900 text-white font-mono font-black text-xs">
                              لیست قیمت {activeCode}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-3 py-1 rounded-lg bg-orange-50 text-[#E06518] border border-orange-200 font-bold text-xs">
                              {activePl?.customerTierLabel || 'سطح برنزی'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <select
                              value={activeCode}
                              onChange={e =>
                                handleGradeChangeForCustomer(cust.id, e.target.value)
                              }
                              className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white font-bold text-xs cursor-pointer focus:border-[#E06518]"
                            >
                              {priceLists
                                .filter(pl => pl.code !== 'RETAIL')
                                .map(pl => (
                                  <option key={pl.id} value={pl.code}>
                                    اختصاص لیست {pl.code} ← {pl.customerTierLabel}
                                  </option>
                                ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal: Legacy Customer Onboarding */}
          {isLegacyModalOpen && (
            <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <form
                onSubmit={handleOnboardLegacyCustomer}
                className="bg-white w-full max-w-xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden"
              >
                <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-black flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-[#E06518]" />
                      <span>انتقال و تعریف مشتری قدیمی در سیستم با تعیین گرید (مثلاً لیست قیمت A)</span>
                    </h4>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      مشتریانی که از قبل با شما کار می‌کردند را مستقیم با لیست قیمت توافقی وارد پنل /account کنید
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLegacyModalOpen(false)}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
                  >
                    بستن
                  </button>
                </div>

                <div className="p-5 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">نام و نام خانوادگی مشتری *</label>
                      <input
                        type="text"
                        required
                        value={legacyForm.fullName}
                        onChange={e =>
                          setLegacyForm({ ...legacyForm, fullName: e.target.value })
                        }
                        placeholder="مثلاً: حاج محمود رضایی"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">نام کارخانه / فروشگاه / مجموعه</label>
                      <input
                        type="text"
                        value={legacyForm.companyName}
                        onChange={e =>
                          setLegacyForm({ ...legacyForm, companyName: e.target.value })
                        }
                        placeholder="مثلاً: کارخانجات کاشی کویر یزد"
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">شماره موبایل (جهت ورود به /account) *</label>
                      <input
                        type="text"
                        dir="ltr"
                        required
                        value={legacyForm.phone}
                        onChange={e =>
                          setLegacyForm({ ...legacyForm, phone: e.target.value })
                        }
                        placeholder="0913..."
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">شهر / استان</label>
                      <input
                        type="text"
                        value={legacyForm.city}
                        onChange={e =>
                          setLegacyForm({ ...legacyForm, city: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl border border-slate-300"
                      />
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl bg-orange-50/70 border border-orange-200 space-y-3">
                    <div>
                      <label className="block font-black text-slate-900 mb-1">
                        انتخاب لیست قیمت اختصاصی برای این مشتری قدیمی (مثلاً لیست قیمت A):
                      </label>
                      <select
                        value={legacyForm.assignedPriceListCode}
                        onChange={e =>
                          setLegacyForm({
                            ...legacyForm,
                            assignedPriceListCode: e.target.value,
                          })
                        }
                        className="w-full px-3 py-2.5 rounded-xl border border-[#E06518] bg-white font-black text-slate-900"
                      >
                        {priceLists.map(pl => (
                          <option key={pl.id} value={pl.code}>
                            لیست قیمت {pl.code} — {pl.adminTitle} (در پنل /account مشتری: {pl.customerTierLabel})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          سابقه حجم خرید قبلی (تومان)
                        </label>
                        <input
                          type="number"
                          value={legacyForm.previousPurchaseVolume}
                          onChange={e =>
                            setLegacyForm({
                              ...legacyForm,
                              previousPurchaseVolume: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          سقف خرید اعتباری (تومان)
                        </label>
                        <input
                          type="number"
                          value={legacyForm.creditLimit}
                          onChange={e =>
                            setLegacyForm({
                              ...legacyForm,
                              creditLimit: Number(e.target.value) || 0,
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsLegacyModalOpen(false)}
                      className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer"
                    >
                      انصراف
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold cursor-pointer"
                    >
                      ثبت مشتری قدیمی و فعال‌سازی لیست قیمت {legacyForm.assignedPriceListCode}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: CUSTOMER CLUB & REWARDS (INDIVIDUAL & COLLECTIVE ASSIGNMENT)
         ===================================================================== */}
      {activeTab === 'club' && (
        <div className="space-y-6">
          {/* Top Section: Award a Gift / Reward Individually or Collectively */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                  <Gift className="w-5 h-5 text-[#E06518]" />
                  <span>تخصیص جوایز و پاداش باشگاه مشتریان (تکی برای یک مشتری یا دسته‌جمعی)</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  بر اساس حجم خرید و سطح باشگاه (برنزی، نقره‌ای، طلایی، الماس)، برای یک مشتری خاص یا به صورت دسته‌جمعی برای یک گرید جایزه انتخاب و فعال کنید.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingRewardRule({
                    id: `rw-${Date.now()}`,
                    title: '',
                    description: '',
                    targetTier: 'gold',
                    minVolumeRequired: 300000000,
                    rewardType: 'cashback',
                    valueLabel: '۱۰ میلیون تومان اعتبار خرید',
                    active: true,
                  });
                  setIsRewardRuleModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ تعریف جایزه جدید در باشگاه</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Assignment Form */}
              <div className="lg:col-span-7 p-4 rounded-2xl bg-orange-50/50 border border-orange-200 space-y-4 text-xs">
                <div className="font-black text-sm text-slate-900">
                  پنل اعطای جایزه به مشتریان (تکی یا دسته‌جمعی):
                </div>

                {/* Scope Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'individual', label: '۱. انتخاب تکی (یک مشتری خاص)' },
                    { id: 'collective_grade', label: '۲. دسته‌جمعی (کل یک گرید / لیست قیمت)' },
                    { id: 'collective_legacy', label: '۳. دسته‌جمعی (کل مشتریان قدیمی)' },
                  ].map(mode => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setAssignMode(mode.id as any)}
                      className={`p-2.5 rounded-xl border font-bold text-center cursor-pointer transition-all ${
                        assignMode === mode.id
                          ? 'bg-[#E06518] text-white border-[#E06518] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>

                {/* Target Customer or Group Picker */}
                {assignMode === 'individual' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      انتخاب مشتری دریافت‌کننده جایزه:
                    </label>
                    <select
                      value={selectedCustomerIdForReward || customers[0]?.id || ''}
                      onChange={e => setSelectedCustomerIdForReward(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    >
                      {customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.companyName || c.fullName} ({c.fullName}) — لیست قیمت{' '}
                          {c.assignedPriceListCode || 'C'} | حجم خرید:{' '}
                          {formatPrice(c.totalPurchases || 0)} ت
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {assignMode === 'collective_grade' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      انتخاب گرید / سطح باشگاه برای اعطای دسته‌جمعی جایزه:
                    </label>
                    <select
                      value={selectedGradeForCollective}
                      onChange={e => setSelectedGradeForCollective(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                    >
                      {priceLists.map(pl => {
                        const count = customers.filter(
                          c =>
                            (c.assignedPriceListCode || 'C').toUpperCase() ===
                            pl.code.toUpperCase()
                        ).length;
                        return (
                          <option key={pl.id} value={pl.code}>
                            کلیه مشتریان لیست قیمت {pl.code} ({pl.customerTierLabel}) — شامل{' '}
                            {toPersianDigits(count)} مشتری
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}

                {assignMode === 'collective_legacy' && (
                  <div className="p-3 rounded-xl bg-amber-100/70 border border-amber-300 text-amber-950 font-bold">
                    این جایزه به صورت دسته‌جمعی برای تمام{' '}
                    {toPersianDigits(customers.filter(c => c.isLegacyCustomer).length)} مشتری قدیمی و همکار پیشین مجموعه فعال می‌شود.
                  </div>
                )}

                {/* Select Reward Rule */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    انتخاب جایزه یا مشوق باشگاه مشتریان:
                  </label>
                  <select
                    value={selectedRewardRuleId}
                    onChange={e => setSelectedRewardRuleId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    {rewardRules.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.title} — ({r.valueLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    توضیح یا پیام اختصاصی برای نمایش در پنل /account مشتری:
                  </label>
                  <input
                    type="text"
                    value={customRewardNote}
                    onChange={e => setCustomRewardNote(e.target.value)}
                    placeholder="مثلاً: پاداش خرید فصل پاییز بازرگانی اطلس..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleAssignRewardSubmit}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-black flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                >
                  <Award className="w-4 h-4" />
                  <span>
                    {assignMode === 'individual'
                      ? 'ثبت و اعطای جایزه به مشتری انتخابی'
                      : 'ثبت و اعطای دسته‌جمعی جایزه به گروه انتخابی'}
                  </span>
                </button>
              </div>

              {/* Right: Reward Catalog Cards */}
              <div className="lg:col-span-5 space-y-2.5">
                <div className="text-xs font-black text-slate-800">
                  جوایز و سطوح تعریف‌شده در باشگاه مشتریان ({toPersianDigits(rewardRules.length)} مورد):
                </div>
                {rewardRules.map(rule => (
                  <div
                    key={rule.id}
                    className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-start justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="font-black text-xs text-slate-900">{rule.title}</div>
                      <div className="text-[11px] text-slate-600">{rule.description}</div>
                      <div className="flex items-center gap-2 pt-1">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-bold">
                          ارزش: {rule.valueLabel}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          حداقل خرید:{' '}
                          {toPersianDigits(Math.round(rule.minVolumeRequired / 1000000))} میلیون ت
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRewardRule(rule);
                        setIsRewardRuleModalOpen(true);
                      }}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-[#E06518] hover:bg-white cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Assigned Rewards History Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <h4 className="font-black text-sm text-slate-800">
              جوایز اختصاص‌یافته به مشتریان (تکی و دسته‌جمعی — قابل مشاهده در پنل /account مشتریان)
            </h4>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-xs text-right border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-bold">عنوان جایزه</th>
                    <th className="py-3 px-4 font-bold">ارزش جایزه</th>
                    <th className="py-3 px-4 font-bold">نوع تخصیص</th>
                    <th className="py-3 px-4 font-bold">دریافت‌کننده (مشتری یا گروه)</th>
                    <th className="py-3 px-4 font-bold">تاریخ ثبت</th>
                    <th className="py-3 px-4 font-bold">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rewardAssignments.map(asg => (
                    <tr key={asg.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-black text-slate-800">{asg.rewardTitle}</td>
                      <td className="py-3 px-4 font-bold text-emerald-700">{asg.rewardValue}</td>
                      <td className="py-3 px-4">
                        {asg.assignmentScope === 'collective' ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-900 font-bold text-[10px]">
                            دسته‌جمعی (گروهی)
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-900 font-bold text-[10px]">
                            اختصاصی (تکی)
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">
                        {asg.assignmentScope === 'collective'
                          ? asg.targetTierLabel
                          : asg.targetCustomerName}
                        {asg.notes && (
                          <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                            {asg.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500">{asg.assignedAt}</td>
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => {
                            pricingCreditService.deleteRewardAssignment(asg.id);
                            refreshAll();
                            showToast('جایزه حذف شد.');
                          }}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ADD / EDIT PRICE LIST (A, B, C, D, E...)
         ===================================================================== */}
      {isPriceListModalOpen && editingPriceList && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="text-sm font-black">
                {priceLists.some(p => p.id === editingPriceList.id)
                  ? `ویرایش لیست قیمت ${editingPriceList.code}`
                  : 'افزودن لیست قیمت جدید (مثلاً E)'}
              </h4>
              <button
                type="button"
                onClick={() => setIsPriceListModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    کد لیست در پنل مدیریت (A / B / C / D / E) *
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editingPriceList.code}
                    onChange={e =>
                      setEditingPriceList({
                        ...editingPriceList,
                        code: e.target.value.toUpperCase(),
                      })
                    }
                    placeholder="E"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono font-black"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    عنوان لیست قیمت در مدیریت *
                  </label>
                  <input
                    type="text"
                    value={editingPriceList.adminTitle}
                    onChange={e =>
                      setEditingPriceList({ ...editingPriceList, adminTitle: e.target.value })
                    }
                    placeholder="لیست قیمت E (همکاران ویژه)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    سطح متناظر در پنل /account مشتری
                  </label>
                  <select
                    value={editingPriceList.customerTier}
                    onChange={e =>
                      setEditingPriceList({
                        ...editingPriceList,
                        customerTier: e.target.value as ClubPortalTier,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-bold"
                  >
                    <option value="gold">طلایی (Gold)</option>
                    <option value="silver">نقره‌ای (Silver)</option>
                    <option value="bronze">برنزی (Bronze)</option>
                    <option value="vip">الماس / VIP</option>
                    <option value="platinum">پلاتینیوم</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    برچسب نمایشی به مشتری در پنل /account
                  </label>
                  <input
                    type="text"
                    value={editingPriceList.customerTierLabel}
                    onChange={e =>
                      setEditingPriceList({
                        ...editingPriceList,
                        customerTierLabel: e.target.value,
                      })
                    }
                    placeholder="سطح طلایی (Gold)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    حداقل حجم خرید جهت دریافت این گرید (تومان)
                  </label>
                  <input
                    type="number"
                    value={editingPriceList.minPurchaseVolume}
                    onChange={e =>
                      setEditingPriceList({
                        ...editingPriceList,
                        minPurchaseVolume: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    درصد تخفیف پیش‌فرض نسبت به قیمت پایه (٪)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={80}
                    value={editingPriceList.defaultDiscountPercent}
                    onChange={e =>
                      setEditingPriceList({
                        ...editingPriceList,
                        defaultDiscountPercent: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات لیست قیمت</label>
                <textarea
                  rows={2}
                  value={editingPriceList.description}
                  onChange={e =>
                    setEditingPriceList({ ...editingPriceList, description: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                {!['plist-a', 'plist-b', 'plist-c', 'plist-d', 'plist-retail'].includes(
                  editingPriceList.id
                ) ? (
                  <button
                    type="button"
                    onClick={() => {
                      handleDeletePriceList(editingPriceList.id);
                      setIsPriceListModalOpen(false);
                    }}
                    className="px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 font-bold cursor-pointer"
                  >
                    حذف این لیست قیمت
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPriceListModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer"
                  >
                    انصراف
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePriceListModal}
                    className="px-5 py-2 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold cursor-pointer"
                  >
                    ذخیره لیست قیمت
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL: ADD / EDIT CLUB REWARD RULE
         ===================================================================== */}
      {isRewardRuleModalOpen && editingRewardRule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <h4 className="text-sm font-black">تعریف / ویرایش جایزه باشگاه مشتریان</h4>
              <button
                type="button"
                onClick={() => setIsRewardRuleModalOpen(false)}
                className="px-3 py-1 rounded-lg bg-white/10 text-xs font-bold cursor-pointer"
              >
                بستن
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">عنوان جایزه *</label>
                <input
                  type="text"
                  value={editingRewardRule.title}
                  onChange={e =>
                    setEditingRewardRule({ ...editingRewardRule, title: e.target.value })
                  }
                  placeholder="مثلاً: اعتبار خرید ۲۰ میلیون تومانی ویژه مشتریان طلایی"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">ارزش / برچسب جایزه *</label>
                <input
                  type="text"
                  value={editingRewardRule.valueLabel}
                  onChange={e =>
                    setEditingRewardRule({ ...editingRewardRule, valueLabel: e.target.value })
                  }
                  placeholder="۲۰,۰۰۰,۰۰۰ تومان اعتبار خرید"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">حداقل حجم خرید مورد نیاز (تومان)</label>
                <input
                  type="number"
                  value={editingRewardRule.minVolumeRequired}
                  onChange={e =>
                    setEditingRewardRule({
                      ...editingRewardRule,
                      minVolumeRequired: Number(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">توضیحات</label>
                <textarea
                  rows={2}
                  value={editingRewardRule.description}
                  onChange={e =>
                    setEditingRewardRule({ ...editingRewardRule, description: e.target.value })
                  }
                  className="w-full p-3 rounded-xl border border-slate-300"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRewardRuleModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 font-bold cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="button"
                  onClick={handleSaveRewardRuleModal}
                  className="px-5 py-2 rounded-xl bg-[#E06518] text-white font-bold cursor-pointer"
                >
                  ذخیره جایزه
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
