import {durableStorage,databaseStorageEnabled} from "./durableStorage";
import { persistPortalCache } from './portalRepository';
import * as XLSX from 'xlsx';
import { ClubTier, Customer, Product } from '../types';
import {
  getManagedCatalogProducts,
  saveManagedFamily,
} from '../data/mockGenerator';

export type ClubPortalTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface CustomerGrade {
  id: string;
  code: string; // 'A' | 'B' | 'C' | 'D' | ...
  name: string; // e.g. 'کرید A - مشتریان تراز اول و طلایی ویژه'
  clubTier: ClubPortalTier; // 'platinum' | 'gold' | 'silver' | 'bronze'
  clubTierLabel: string; // 'طلایی ویژه (الماس)' | 'طلایی' | 'نقره‌ای' | 'برنزی'
  priceListId: string; // شناسه لیست قیمت متناظر
  minPurchaseVolume: number; // حداقل حجم خرید تجمعی (تومان) برای این سطح
  creditLimit: number; // سقف اعتبار ریالی/تومانی
  settlementDays: number; // مهلت تسویه حساب به روز
  trustLevel: 'high' | 'medium' | 'restricted';
  description: string;
}

export interface DynamicPriceList {
  id: string;
  code: string; // 'A', 'B', 'C', 'D', 'RETAIL', etc. (برای پنل مدیریت)
  name: string; // e.g. 'لیست قیمت A (سطح طلایی ویژه / الماس)'
  adminTitle?: string;
  clubTier: ClubPortalTier; // برای پنل /account: برنزی، نقره‌ای، طلایی، طلایی ویژه
  clubTierLabel: string; // نام نمایشی در پنل /account مشتری
  customerTierLabel?: string;
  customerTier?: ClubPortalTier;
  defaultDiscountPercent?: number;
  minPurchaseVolume: number; // حداقل حجم خرید مشتری برای دریافت این لیست قیمت
  discountPercent: number; // درصد تخفیف پیش‌فرض از قیمت پایه/خرده‌فروشی در صورت عدم ثبت قیمت اختصاصی کد
  isDefault?: boolean;
  isRetailCash?: boolean; // آیا لیست قیمت نقدی خرده‌فروشی (/consumer-dashboard) است؟
  description: string;
  updatedAt?: string;
  customProductPrices?: Record<string, number>; // قیمت دقیق هر کد کالا (SKU Code -> Price in Tomans)
  skuPrices?: Record<string, number>;
  badgeColor?: string;
  active?: boolean;
}

export type PriceListDefinition = DynamicPriceList;

export interface CatalogUniqueSkuItem {
  code: string; // کد کالا (یکتا و بدون تکرار)
  name: string; // نام دقیق محصول
  familyCode: string;
  familyName: string;
  categoryName: string;
  size: string;
  brand: string;
  unit: string;
  baseRetailPrice: number; // قیمت پایه/خرده‌فروشی فعلی کد کالا
}

export type CatalogSkuPriceItem = CatalogUniqueSkuItem & { basePrice: number };

export interface CustomerRewardAssignment {
  portal?: "consumer" | "high_volume";
  id: string;
  rewardTitle: string;
  rewardValue: string;
  assignmentScope: 'individual' | 'collective';
  targetCustomerIds?: string[];
  targetTierLabel?: string;
  targetCustomerName?: string;
  assignedAt: string;
  notes?: string;
}

export interface ClubRewardRule {
  id: string;
  title: string;
  description: string;
  targetTier: ClubPortalTier | 'all';
  minVolumeRequired: number;
  rewardType: 'cashback' | 'discount_percent' | 'gift' | 'freight';
  valueLabel: string;
  active: boolean;
}

export interface PriceListDiffItem {
  code: string; // کد کالا (کلید اصلی قیمت‌گذاری)
  name: string; // نام محصول
  familyCode: string;
  familyName: string;
  categoryName: string;
  size: string;
  oldPrice: number; // قیمت قبلی در این لیست قیمت
  newPrice: number; // قیمت جدید واردشده در فایل اکسل
  diffAmount: number; // اختلاف قیمت (تومان)
  diffPercent: number; // درصد تغییر قیمت
  changeType: 'increase' | 'decrease' | 'newly_priced';
  status?: 'increased' | 'decreased' | 'newly_priced' | 'new_price' | 'unchanged' | 'not_found' | 'invalid';
  selected?: boolean; // آیا در پیش‌نمایش برای تایید نهایی انتخاب شده است؟
  errorMessage?: string;
}

export interface PriceListDiffPreview {
  priceListId: string;
  priceListCode: string;
  priceListName: string;
  priceListTitle?: string;
  fileName: string;
  totalUploadedRows: number;
  uniqueValidSkusCount: number;
  duplicateMergedCount: number; // تعداد ردیف‌های تکراری در اکسل که بر اساس کد کالا ادغام شدند
  changedItems: PriceListDiffItem[];
  unchangedCount: number;
  unmatchedCodes: Array<{ code: string; name: string; price: number }>;
}

export interface PriceListExcelPreviewResult {
  priceListId: string;
  priceListCode: string;
  priceListTitle: string;
  fileName: string;
  totalRowsRead: number;
  uniqueSkusProcessed: number;
  duplicateSkusMerged: Array<{ code: string; name: string }>;
  changedRowsCount: number;
  unchangedRowsCount: number;
  invalidRowsCount: number;
  rows: PriceListDiffItem[];
  changedItems?: PriceListDiffItem[];
  duplicateMergedCount?: number;
}

export interface PriceListHistoryRecord {
  id: string;
  createdAt: string;
  priceListId: string;
  priceListCode: string;
  priceListName: string;
  priceListTitle?: string;
  clubTierLabel: string;
  fileName: string;
  changedBy: string;
  editorName?: string;
  note?: string;
  notes?: string;
  sourceType?: string;
  totalProcessed: number;
  totalSkus?: number;
  changedCount: number;
  changedSkusCount?: number;
  duplicateMergedCount: number;
  increasedCount?: number;
  decreasedCount?: number;
  averageChangePercent?: number;
  changes: PriceListDiffItem[];
}

export interface CustomerApprovalRecord {
  id: string;
  fullName: string;
  companyName: string;
  phone: string;
  password?: string;
  province: string;
  city: string;
  activityField: string;
  monthlyPurchaseEstimate: string;
  totalPurchaseVolume: number; // حجم خرید کل تا کنون (تومان)
  isLegacyCustomer?: boolean; // مشتری قدیمی که از قبل با ما کار می‌کرده و مستقیم وارد سیستم شده
  economicCode?: string;
  registeredAt: string;
  status: 'pending' | 'approved' | 'rejected';
  assignedGradeId?: string;
  assignedPriceListId?: string;
  assignedPriceListCode?: string; // 'A' | 'B' | 'C' | 'D'
  assignedClubTier?: ClubPortalTier; // 'bronze' | 'silver' | 'gold' | 'platinum'
  assignedCreditLimit?: number;
  reviewedAt?: string;
  rejectionReason?: string;
  adminNotes?: string;
  isDealer?: boolean;
}

export interface ClubRewardAssignment {
  id: string;
  title: string; // عنوان جایزه یا پاداش
  description: string; // توضیحات جایزه
  rewardType: 'cash_credit' | 'discount_percent' | 'physical_gift' | 'free_freight' | 'bonus_points';
  rewardValue: string; // مثلاً '۵,۰۰۰,۰۰۰ تومان اعتبار خرید' یا 'پک ابزار مهندسی FORZA' یا '۳٪ تخفیف مازاد'
  numericValue?: number;
  targetType: 'individual' | 'collective'; // انتخاب تکی برای یک مشتری یا دسته‌جمعی برای یک گروه/سطح
  targetCustomerIds?: string[]; // در حالت تکی یا چند مشتری خاص
  targetCustomerNames?: string[];
  targetClubTier?: ClubPortalTier | 'all'; // در حالت دسته‌جمعی بر اساس سطح باشگاه (برنزی، نقره‌ای، طلایی، الماس)
  targetPriceListCode?: string; // در حالت دسته‌جمعی بر اساس لیست قیمت (A, B, C, D)
  minPurchaseRequired?: number; // حداقل حجم خرید برای دریافت جایزه
  createdAt: string;
  expiresAt?: string;
  active: boolean;
}

const GRADES_STORAGE_KEY = 'atlas_customer_grades_v2';
const PRICE_LISTS_STORAGE_KEY = 'atlas_price_lists_v2';
const PRICE_LIST_HISTORY_KEY = 'atlas_price_list_history_v2';
const CUSTOMERS_APPROVAL_KEY = 'atlas_customers_approval_v2';
const CLUB_REWARDS_STORAGE_KEY = 'atlas_club_rewards_v2';
const USER_INQUIRY_CACHE_KEY = 'atlas_user_inquiry_cache_v1';

const listeners = new Set<() => void>();
function notifyListeners() {
  listeners.forEach(fn => {
    try {
      fn();
    } catch {
      // ignore
    }
  });
}

// ۱. لیست‌های قیمت پیش‌فرض (A, B, C, D برای پنل مدیریت ↔ طلایی ویژه، طلایی، نقره‌ای، برنزی برای پنل /account)
export const INITIAL_PRICE_LISTS: DynamicPriceList[] = [
  {
    id: 'pl-grade-a',
    code: 'A',
    name: 'لیست قیمت A (مشتریان طلایی ویژه و قدیمی تراز اول)',
    clubTier: 'platinum',
    clubTierLabel: 'طلایی ویژه (VIP / الماس)',
    minPurchaseVolume: 0,
    discountPercent: 0,
    description: 'بالاترین سطح قیمت‌گذاری همکاری ویژه مشتریان پرمصرف تراز اول و مشتریان قدیمی خوش‌حساب (لیست A در پنل مدیریت / سطح طلایی ویژه در پرتال مشتری).',
    updatedAt: '۱۴۰۴/۰۷/۲۰',
    customProductPrices: {},
  },
  {
    id: 'pl-grade-b',
    code: 'B',
    name: 'لیست قیمت B (مشتریان سطح طلایی)',
    clubTier: 'gold',
    clubTierLabel: 'سطح طلایی (Gold)',
    minPurchaseVolume: 0,
    discountPercent: 0,
    description: 'نرخ ویژه مشتریان پرمصرف صنعتی با حجم خرید بالا (لیست B در پنل مدیریت / سطح طلایی در پرتال /account).',
    updatedAt: '۱۴۰۴/۰۷/۱۸',
    customProductPrices: {},
  },
  {
    id: 'pl-grade-c',
    code: 'C',
    name: 'لیست قیمت C (مشتریان سطح نقره‌ای)',
    clubTier: 'silver',
    clubTierLabel: 'سطح نقره‌ای (Silver)',
    minPurchaseVolume: 0,
    discountPercent: 0,
    description: 'نرخ همکاری مخصوص خریداران مستمر با حجم خرید متوسط رو به بالا (لیست C در پنل مدیریت / سطح نقره‌ای در پرتال /account).',
    updatedAt: '۱۴۰۴/۰۷/۱۵',
    customProductPrices: {},
  },
  {
    id: 'pl-grade-d',
    code: 'D',
    name: 'لیست قیمت D (مشتریان سطح برنزی / پایه عمده)',
    clubTier: 'bronze',
    clubTierLabel: 'سطح برنزی (Bronze)',
    minPurchaseVolume: 0,
    discountPercent: 0,
    isDefault: true,
    description: 'نرخ پایه مشتریان عمده و پرتال /account در ابتدای همکاری (لیست D در پنل مدیریت / سطح برنزی در پرتال مشتری).',
    updatedAt: '۱۴۰۴/۰۷/۱۲',
    customProductPrices: {},
  },
  {
    id: 'pl-retail-cash',
    code: 'RETAIL',
    name: 'لیست قیمت پایه نقدی (خرده‌فروشی /consumer-dashboard)',
    clubTier: 'bronze',
    clubTierLabel: 'خریدار نقدی (تک‌فروشی)',
    minPurchaseVolume: 0,
    discountPercent: 0,
    isRetailCash: true,
    description: 'قیمت مصوب نقدی برای خریداران خرده که بدون نیاز به کریدبندی وارد پنل /consumer-dashboard می‌شوند.',
    updatedAt: '۱۴۰۴/۰۷/۲۰',
    customProductPrices: {},
  },
];

// ۲. کریدهای مشتریان (متصل به لیست‌های قیمت A, B, C, D و سطوح باشگاه)
const INITIAL_GRADES: CustomerGrade[] = [];

// ۳. مشتریان کریدبندی‌شده (شامل مشتریان قدیمی که از قبل با شرکت کار می‌کردند + مشتریان جدید)
const INITIAL_CUSTOMER_APPROVALS: CustomerApprovalRecord[] = [];

// ۴. تاریخچه اولیه لیست قیمت‌ها (برای نمایش سوابق قبلی و قابلیت حذف)
const INITIAL_PRICE_LIST_HISTORY: PriceListHistoryRecord[] = [];

// ۵. جوایز و پاداش‌های باشگاه مشتریان (قابل تخصیص تکی به یک مشتری یا دسته‌جمعی به یک سطح/لیست قیمت)
const INITIAL_CLUB_REWARDS: ClubRewardAssignment[] = [];

function normalizeSkuCodeKey(code: string): string {
  return String(code || '')
    .trim()
    .replace(/^[Ff][Aa][Mm]-/, '')
    .toUpperCase();
}

export const pricingCreditService = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // --- Customer Grades (کریدبندی A, B, C, D) ---
  getGrades(): CustomerGrade[] {
    try {
      const stored = durableStorage.getItem(GRADES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    if(databaseStorageEnabled())return [];
    this.saveGrades(INITIAL_GRADES);
    return INITIAL_GRADES;
  },

  saveGrades(grades: CustomerGrade[]): void {
    try {
      persistPortalCache(GRADES_STORAGE_KEY, JSON.stringify(grades));
      notifyListeners();
    } catch {
      // ignore
    }
  },

  getGradeById(id: string): CustomerGrade | undefined {
    return this.getGrades().find(g => g.id === id);
  },

  addGrade(grade: Omit<CustomerGrade, 'id'>): CustomerGrade {
    const grades = this.getGrades();
    const newGrade: CustomerGrade = {
      ...grade,
      id: 'grade-' + Date.now(),
    };
    grades.push(newGrade);
    this.saveGrades(grades);
    return newGrade;
  },

  updateGrade(id: string, updates: Partial<CustomerGrade>): void {
    const grades = this.getGrades().map(g => (g.id === id ? { ...g, ...updates } : g));
    this.saveGrades(grades);
  },

  deleteGrade(id: string): void {
    const grades = this.getGrades().filter(g => g.id !== id);
    this.saveGrades(grades);
  },

  // --- Dynamic Price Lists (لیست‌های قیمت A, B, C, D و خرده‌فروشی) ---
  getPriceLists(): DynamicPriceList[] {
    let lists: DynamicPriceList[] | null = null;
    try {
      const stored = durableStorage.getItem(PRICE_LISTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) lists = parsed;
      }
    } catch {
      // ignore
    }
    if (!lists) {
      if(databaseStorageEnabled())return [];
      lists = INITIAL_PRICE_LISTS;
      this.savePriceLists(lists);
    }
    return lists.map(p => ({
      ...p,
      adminTitle: p.adminTitle || p.name || `لیست قیمت ${p.code}`,
      customerTierLabel: p.customerTierLabel || p.clubTierLabel || 'سطح عمده',
      customerTier: p.customerTier || p.clubTier || 'bronze',
      defaultDiscountPercent: p.defaultDiscountPercent ?? p.discountPercent ?? 0,
      discountPercent: p.discountPercent ?? p.defaultDiscountPercent ?? 0,
    }));
  },

  savePriceLists(lists: DynamicPriceList[]): void {
    try {
      persistPortalCache(PRICE_LISTS_STORAGE_KEY, JSON.stringify(lists));
      notifyListeners();
    } catch {
      // ignore
    }
  },

  savePriceList(list: DynamicPriceList): void {
    const lists = this.getPriceLists();
    const idx = lists.findIndex(p => p.id === list.id || (p.code && list.code && p.code.toUpperCase() === list.code.toUpperCase()));
    const formatted: DynamicPriceList = {
      id: list.id || 'plist-' + Date.now(),
      code: list.code,
      name: list.name || list.adminTitle || `لیست قیمت ${list.code}`,
      adminTitle: list.adminTitle || list.name || `لیست قیمت ${list.code}`,
      clubTier: list.clubTier || list.customerTier || 'bronze',
      clubTierLabel: list.clubTierLabel || list.customerTierLabel || 'برنزی',
      customerTierLabel: list.customerTierLabel || list.clubTierLabel || 'برنزی',
      customerTier: list.customerTier || list.clubTier || 'bronze',
      minPurchaseVolume: list.minPurchaseVolume || 0,
      discountPercent: list.discountPercent ?? list.defaultDiscountPercent ?? 0,
      defaultDiscountPercent: list.defaultDiscountPercent ?? list.discountPercent ?? 0,
      description: list.description || '',
      updatedAt: new Date().toLocaleDateString('fa-IR'),
      customProductPrices: list.customProductPrices || {},
    };
    if (idx >= 0) {
      lists[idx] = { ...lists[idx], ...formatted };
    } else {
      lists.push(formatted);
    }
    this.savePriceLists(lists);
  },

  getPriceListById(id: string): DynamicPriceList | undefined {
    return this.getPriceLists().find(p => p.id === id || p.code.toUpperCase() === id.toUpperCase());
  },

  getPriceListByCode(code: string): DynamicPriceList | undefined {
    const clean = String(code || '').trim().toUpperCase();
    return this.getPriceLists().find(p => p.code.toUpperCase() === clean || p.id === code);
  },

  addPriceList(list: Omit<DynamicPriceList, 'id'>): DynamicPriceList {
    const lists = this.getPriceLists();
    const newList: DynamicPriceList = {
      ...list,
      id: 'pl-' + Date.now(),
      updatedAt: new Date().toLocaleDateString('fa-IR'),
      customProductPrices: list.customProductPrices || {},
    };
    lists.push(newList);
    this.savePriceLists(lists);
    return newList;
  },

  updatePriceList(id: string, updates: Partial<DynamicPriceList>): void {
    const lists = this.getPriceLists().map(l =>
      l.id === id
        ? {
            ...l,
            ...updates,
            updatedAt: new Date().toLocaleDateString('fa-IR'),
          }
        : l
    );
    this.savePriceLists(lists);
  },

  deletePriceList(id: string): void {
    const lists = this.getPriceLists().filter(l => l.id !== id);
    this.savePriceLists(lists);
  },

  setSkuPriceInList(priceListId: string, skuCode: string, price: number): void {
    const cleanCode = String(skuCode || '').trim();
    if (!cleanCode) return;
    const lists = this.getPriceLists().map(l => {
      if (l.id !== priceListId) return l;
      const nextPrices = { ...(l.customProductPrices || {}) };
      if (price > 0) {
        nextPrices[cleanCode] = Math.round(price);
      } else {
        delete nextPrices[cleanCode];
      }
      return {
        ...l,
        customProductPrices: nextPrices,
        updatedAt: new Date().toLocaleDateString('fa-IR'),
      };
    });
    this.savePriceLists(lists);
  },

  // --- Unique Deduplicated SKU Catalog Extraction (تک‌به‌تک کدهای کالا بدون هیچ تکرار) ---
  getAllUniqueCatalogSkus(): CatalogUniqueSkuItem[] {
    const families = getManagedCatalogProducts({ includeInactive: true });
    const retailPl = this.getPriceLists().find(p => p.isRetailCash);
    const retailOverrides = retailPl?.customProductPrices || {};

    const seenCodes = new Map<string, CatalogUniqueSkuItem>();

    for (const fam of families) {
      const variants = fam.variants && fam.variants.length > 0 ? fam.variants : [];
      if (variants.length > 0) {
        for (const v of variants) {
          const rawCode = String(v.code || '').trim();
          if (!rawCode) continue;
          const normKey = rawCode.toUpperCase();
          if (seenCodes.has(normKey)) continue; // جلوگیری کامل از تکرار کد کالا

          const basePrice =
            retailOverrides[rawCode] ??
            (v.price && v.price > 0 ? v.price : v.prices?.retail && v.prices.retail > 0 ? v.prices.retail : 0);

          seenCodes.set(normKey, {
            code: rawCode,
            name: v.name || `${fam.name}${v.size ? ` (${v.size})` : ''}`,
            familyCode: fam.code,
            familyName: fam.name,
            categoryName: fam.categoryName,
            size: v.size || 'استاندارد',
            brand: v.brand || fam.brand || 'صنعت پیش',
            unit: v.unit || fam.unit || 'عدد',
            baseRetailPrice: basePrice,
          });
        }
      } else {
        const rawCode = String(fam.code || '').trim();
        if (!rawCode) continue;
        const normKey = rawCode.toUpperCase();
        if (seenCodes.has(normKey)) continue;

        const basePrice =
          retailOverrides[rawCode] ?? (fam.prices?.retail && fam.prices.retail > 0 ? fam.prices.retail : 0);

        seenCodes.set(normKey, {
          code: rawCode,
          name: fam.name,
          familyCode: fam.code,
          familyName: fam.name,
          categoryName: fam.categoryName,
          size: 'استاندارد',
          brand: fam.brand || 'صنعت پیش',
          unit: fam.unit || 'عدد',
          baseRetailPrice: basePrice,
        });
      }
    }

    return Array.from(seenCodes.values());
  },

  /**
   * Resolves the current price for a specific SKU code inside a given Price List.
   */
  resolveSkuPriceInList(sku: CatalogUniqueSkuItem, priceList: DynamicPriceList): number {
    const customMap = priceList.customProductPrices || {};
    if (customMap[sku.code] !== undefined && customMap[sku.code] >= 0) {
      return customMap[sku.code];
    }
    const stripped = normalizeSkuCodeKey(sku.code);
    if (customMap[stripped] !== undefined && customMap[stripped] >= 0) {
      return customMap[stripped];
    }
    if (sku.baseRetailPrice > 0) {
      const disc = priceList.discountPercent || 0;
      return Math.round((sku.baseRetailPrice * (1 - disc / 100)) / 1000) * 1000;
    }
    return 0;
  },

  // --- Excel (.xlsx & .csv) Export of All Unique SKUs for a Price List ---
  getExportRowsForPriceList(
    priceListId: string,
    options?: { categoryName?: string; searchQuery?: string; onlyPriced?: boolean }
  ) {
    const pl = this.getPriceListById(priceListId) || this.getPriceLists()[0];
    const allSkus = this.getAllUniqueCatalogSkus();
    const q = (options?.searchQuery || '').trim().toLowerCase();

    const filtered = allSkus.filter(sku => {
      if (options?.categoryName && options.categoryName !== 'all' && sku.categoryName !== options.categoryName) {
        return false;
      }
      if (q) {
        const hay = `${sku.code} ${sku.name} ${sku.familyName} ${sku.size}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      const price = this.resolveSkuPriceInList(sku, pl);
      if (options?.onlyPriced && price <= 0) return false;
      return true;
    });

    return filtered.map(sku => {
      const currentPrice = this.resolveSkuPriceInList(sku, pl);
      return {
        'کد کالا': sku.code,
        'نام محصول': sku.name,
        'قیمت محصول': currentPrice,
        'خانواده محصول': sku.familyName,
        'دسته‌بندی': sku.categoryName,
        'سایز / مشخصه': sku.size,
      };
    });
  },

  downloadPriceListExcel(
    priceListId: string,
    format: 'xlsx' | 'csv' = 'xlsx',
    options?: { categoryName?: string; searchQuery?: string; onlyPriced?: boolean }
  ): number {
    const pl = this.getPriceListById(priceListId) || this.getPriceLists()[0];
    const rows = this.getExportRowsForPriceList(pl.id, options);

    const worksheet = XLSX.utils.json_to_sheet(rows, {
      header: ['کد کالا', 'نام محصول', 'قیمت محصول', 'خانواده محصول', 'دسته‌بندی', 'سایز / مشخصه'],
    });

    worksheet['!cols'] = [
      { wch: 16 }, // کد کالا
      { wch: 42 }, // نام محصول
      { wch: 18 }, // قیمت محصول
      { wch: 24 }, // خانواده محصول
      { wch: 24 }, // دسته‌بندی
      { wch: 22 }, // سایز
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'لیست قیمت من');

    const dateStamp = new Date().toISOString().slice(0, 10);
    const safeCode = pl.code.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (format === 'csv') {
      const csvContent = '\uFEFF' + XLSX.utils.sheet_to_csv(worksheet);
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MyPriceList_${dateStamp}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      XLSX.writeFile(workbook, `MyPriceList_${dateStamp}.xlsx`);
    }

    return rows.length;
  },

  // --- Parse Uploaded Excel (.xlsx / .csv) & Generate Diff Preview (بدون تکرار بر اساس کد کالا) ---
  async parseAndPreviewExcelFile(file: File, targetPriceListId: string): Promise<PriceListDiffPreview> {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    const rawJson = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    return this.generateDiffPreviewFromRows(rawJson, targetPriceListId, file.name);
  },

  generateDiffPreviewFromRows(
    rawRows: Array<Record<string, any>>,
    targetPriceListId: string,
    fileName = 'لیست_قیمت_اکسل.xlsx'
  ): PriceListDiffPreview {
    const pl = this.getPriceListById(targetPriceListId) || this.getPriceLists()[0];
    const allSkus = this.getAllUniqueCatalogSkus();

    // Map catalog SKUs by normalized code (strictly keyed by کد کالا)
    const catalogByCode = new Map<string, CatalogUniqueSkuItem>();
    for (const s of allSkus) {
      catalogByCode.set(s.code.toUpperCase().trim(), s);
      catalogByCode.set(normalizeSkuCodeKey(s.code), s);
    }

    // Deduplicate uploaded rows strictly by کد کالا
    const deduplicatedInput = new Map<string, { code: string; name: string; price: number }>();
    let duplicateMergedCount = 0;

    for (const row of rawRows) {
      const rawCodeVal =
        row['کد کالا'] ??
        row['کد محصول'] ??
        row['کد'] ??
        row['code'] ??
        row['Code'] ??
        row['SKU'] ??
        Object.values(row)[0] ??
        '';
      const rawNameVal =
        row['نام محصول'] ??
        row['نام کالا'] ??
        row['نام'] ??
        row['name'] ??
        row['Name'] ??
        Object.values(row)[1] ??
        '';
      const rawPriceVal =
        row['قیمت محصول'] ??
        row['قیمت محصول (تومان)'] ??
        row['قیمت'] ??
        row['قیمت جدید'] ??
        row['price'] ??
        row['Price'] ??
        Object.values(row)[2] ??
        0;

      const cleanCode = String(rawCodeVal || '').trim();
      if (!cleanCode || cleanCode === 'کد کالا' || cleanCode === 'code') continue;

      // Convert Persian/Arabic digits if any in price or code
      const normalizedCode = cleanCode
        .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

      const priceStr = String(rawPriceVal ?? '')
        .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
        .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
        .replace(/[^0-9.-]/g, '');

      const parsedPrice = Math.max(0, Math.round(Number(priceStr) || 0));
      const key = normalizedCode.toUpperCase();

      if (deduplicatedInput.has(key)) {
        duplicateMergedCount++;
      }

      deduplicatedInput.set(key, {
        code: normalizedCode,
        name: String(rawNameVal || '').trim(),
        price: parsedPrice,
      });
    }

    const changedItems: PriceListDiffItem[] = [];
    let unchangedCount = 0;
    const unmatchedCodes: Array<{ code: string; name: string; price: number }> = [];

    for (const [, uploaded] of deduplicatedInput.entries()) {
      const matchedSku =
        catalogByCode.get(uploaded.code.toUpperCase()) ||
        catalogByCode.get(normalizeSkuCodeKey(uploaded.code));

      if (!matchedSku) {
        unmatchedCodes.push(uploaded);
        continue;
      }

      const oldPrice = this.resolveSkuPriceInList(matchedSku, pl);
      const newPrice = uploaded.price;

      if (oldPrice !== newPrice) {
        const diffAmount = newPrice - oldPrice;
        const diffPercent =
          oldPrice > 0 ? Number(((diffAmount / oldPrice) * 100).toFixed(1)) : 100;

        changedItems.push({
          code: matchedSku.code,
          name: matchedSku.name,
          familyCode: matchedSku.familyCode,
          familyName: matchedSku.familyName,
          categoryName: matchedSku.categoryName,
          size: matchedSku.size,
          oldPrice,
          newPrice,
          diffAmount,
          diffPercent,
          changeType:
            oldPrice === 0 && newPrice > 0
              ? 'newly_priced'
              : newPrice > oldPrice
              ? 'increase'
              : 'decrease',
          selected: true,
        });
      } else {
        unchangedCount++;
      }
    }

    return {
      priceListId: pl.id,
      priceListCode: pl.code,
      priceListName: pl.name,
      fileName,
      totalUploadedRows: rawRows.length,
      uniqueValidSkusCount: deduplicatedInput.size,
      duplicateMergedCount,
      changedItems,
      unchangedCount,
      unmatchedCodes,
    };
  },

  // --- Apply Confirmed Price List Changes & Log History ---
  applyConfirmedPriceListChanges(
    priceListId: string,
    confirmedItems: PriceListDiffItem[],
    meta?: { fileName?: string; note?: string; changedBy?: string; duplicateMergedCount?: number; totalProcessed?: number }
  ): PriceListHistoryRecord {
    const lists = this.getPriceLists();
    const targetIdx = lists.findIndex(l => l.id === priceListId);
    if (targetIdx < 0) {
      throw new Error('لیست قیمت مورد نظر یافت نشد.');
    }

    const targetPl = lists[targetIdx];
    const nextCustomPrices = { ...(targetPl.customProductPrices || {}) };

    // Group changes by familyCode in case we also need to sync base catalog prices
    const changesByFamily = new Map<string, Map<string, number>>();

    for (const item of confirmedItems) {
      if (item.selected === false) continue;
      const cleanCode = String(item.code).trim();
      if (item.newPrice > 0) {
        nextCustomPrices[cleanCode] = Math.round(item.newPrice);
      } else {
        delete nextCustomPrices[cleanCode];
      }

      if (!changesByFamily.has(item.familyCode)) {
        changesByFamily.set(item.familyCode, new Map());
      }
      changesByFamily.get(item.familyCode)!.set(cleanCode, Math.round(item.newPrice));
    }

    lists[targetIdx] = {
      ...targetPl,
      customProductPrices: nextCustomPrices,
      updatedAt: new Date().toLocaleDateString('fa-IR'),
    };
    this.savePriceLists(lists);

    // If updating the Retail/Base price list (or if the catalog SKU had no price yet), sync with catalog families so product pages show the price immediately
    const allFamilies = getManagedCatalogProducts({ includeInactive: true });
    for (const [familyCode, skuPriceMap] of changesByFamily.entries()) {
      const fam = allFamilies.find(f => f.code === familyCode);
      if (!fam) continue;

      let familyModified = false;
      const nextVariants = (fam.variants || []).map(v => {
        const newPr = skuPriceMap.get(v.code);
        if (newPr === undefined) return v;

        if (targetPl.isRetailCash || !v.price || v.price <= 0) {
          familyModified = true;
          return {
            ...v,
            price: newPr,
            inquiryOnly: newPr <= 0,
            prices: {
              base: Math.round(newPr * 0.8),
              retail: newPr,
              wholesale: Math.round(newPr * 0.9),
              dealer: Math.round(newPr * 0.84),
            },
          };
        }
        return v;
      });

      if (familyModified) {
        saveManagedFamily({
          ...fam,
          variants: nextVariants,
        });
      }
    }

    // Record in Price List History
    const appliedChanges = confirmedItems.filter(i => i.selected !== false);
    const historyRecord: PriceListHistoryRecord = {
      id: 'pl-hist-' + Date.now(),
      createdAt:
        new Date().toLocaleDateString('fa-IR') +
        ' - ' +
        new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      priceListId: targetPl.id,
      priceListCode: targetPl.code,
      priceListName: targetPl.name,
      priceListTitle: targetPl.adminTitle || targetPl.name,
      clubTierLabel: targetPl.clubTierLabel,
      fileName: meta?.fileName || `PriceList_${targetPl.code}.xlsx`,
      changedBy: meta?.changedBy || 'مدیر سیستم',
      editorName: meta?.changedBy || 'مدیر سیستم',
      note: meta?.note || `به‌روزرسانی لیست قیمت ${targetPl.code} از طریق فایل اکسل`,
      totalProcessed: meta?.totalProcessed || appliedChanges.length,
      totalSkus: meta?.totalProcessed || appliedChanges.length,
      changedCount: appliedChanges.length,
      changedSkusCount: appliedChanges.length,
      duplicateMergedCount: meta?.duplicateMergedCount || 0,
      changes: appliedChanges,
    };

    const historyList = this.getPriceListHistory();
    historyList.unshift(historyRecord);
    this.savePriceListHistory(historyList);

    return historyRecord;
  },

  exportPriceListToExcel(priceListId: string, format: 'xlsx' | 'csv' = 'xlsx', options?: any): number {
    return this.downloadPriceListExcel(priceListId, format, options);
  },

  async parsePriceListExcelFile(file: File, targetPriceListId: string): Promise<PriceListExcelPreviewResult> {
    const diff = await this.parseAndPreviewExcelFile(file, targetPriceListId);
    const pl = this.getPriceListById(targetPriceListId) || this.getPriceLists()[0];

    const rows: PriceListDiffItem[] = diff.changedItems.map(item => ({
      ...item,
      status: item.changeType === 'increase' ? 'increased' : item.changeType === 'decrease' ? 'decreased' : 'newly_priced',
      selected: item.selected !== false,
    }));

    const duplicates = Array.from({ length: diff.duplicateMergedCount }, (_, i) => ({
      code: `DUP-${i + 1}`,
      name: `ردیف تکراری ${i + 1}`,
    }));

    return {
      priceListId: pl.id,
      priceListCode: pl.code,
      priceListTitle: pl.adminTitle || pl.name,
      fileName: file.name,
      totalRowsRead: diff.totalUploadedRows,
      uniqueSkusProcessed: diff.uniqueValidSkusCount,
      duplicateSkusMerged: duplicates,
      changedRowsCount: rows.length,
      unchangedRowsCount: diff.unchangedCount,
      invalidRowsCount: diff.unmatchedCodes.length,
      rows,
      changedItems: diff.changedItems,
      duplicateMergedCount: diff.duplicateMergedCount,
    };
  },

  applyPriceListPreviewChanges(
    preview: PriceListExcelPreviewResult,
    options?: { updateBaseCatalogPrices?: boolean; changedBy?: string; notes?: string }
  ): PriceListHistoryRecord {
    const pl = this.getPriceListById(preview.priceListId) || this.getPriceLists()[0];
    const itemsToApply: PriceListDiffItem[] = (preview.rows || preview.changedItems || []).map(r => ({
      code: r.code,
      name: r.name,
      familyCode: r.familyCode || `FAM-${r.code}`,
      familyName: r.familyName || r.name,
      categoryName: r.categoryName || 'قطعات صنعتی',
      size: r.size || 'استاندارد',
      oldPrice: r.oldPrice,
      newPrice: r.newPrice,
      diffAmount: r.diffAmount ?? (r.newPrice - r.oldPrice),
      diffPercent: r.diffPercent ?? (r.oldPrice > 0 ? Math.round(((r.newPrice - r.oldPrice) / r.oldPrice) * 100) : 100),
      changeType: r.newPrice > r.oldPrice ? 'increase' : 'decrease',
      selected: r.selected !== false,
    }));

    return this.applyConfirmedPriceListChanges(pl.id, itemsToApply, {
      fileName: preview.fileName,
      note: options?.notes || `به‌روزرسانی اکسل ${preview.fileName}`,
      changedBy: options?.changedBy || 'مدیر سیستم',
      duplicateMergedCount: preview.duplicateSkusMerged?.length || preview.duplicateMergedCount || 0,
      totalProcessed: preview.totalRowsRead || preview.uniqueSkusProcessed || itemsToApply.length,
    });
  },

  getSkuPriceForList(
    skuCode: string,
    basePrice: number,
    priceList: DynamicPriceList
  ): number {
    if (!priceList) return basePrice || 0;
    const customMap = priceList.customProductPrices || {};
    if (customMap[skuCode] !== undefined && customMap[skuCode] >= 0) {
      return customMap[skuCode];
    }
    const stripped = normalizeSkuCodeKey(skuCode);
    if (customMap[stripped] !== undefined && customMap[stripped] >= 0) {
      return customMap[stripped];
    }
    if (basePrice > 0) {
      const disc = priceList.discountPercent ?? priceList.defaultDiscountPercent ?? 0;
      return Math.round((basePrice * (1 - disc / 100)) / 1000) * 1000;
    }
    return 0;
  },

  // --- Price List History Management (تاریخچه لیست قیمت‌های اضافه‌شده و قبلی + قابلیت حذف) ---
  getPriceListHistory(): PriceListHistoryRecord[] {
    try {
      const stored = durableStorage.getItem(PRICE_LIST_HISTORY_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.map((h: any) => ({
            ...h,
            priceListTitle: h.priceListTitle || h.priceListName,
            editorName: h.editorName || h.changedBy || 'مدیر سیستم',
            changedSkusCount: h.changedSkusCount ?? h.changedCount ?? (h.changes ? h.changes.length : 0),
            totalSkus: h.totalSkus ?? h.totalProcessed ?? 0,
          }));
        }
      }
    } catch {
      // ignore
    }
    if(databaseStorageEnabled())return [];
    this.savePriceListHistory(INITIAL_PRICE_LIST_HISTORY);
    return INITIAL_PRICE_LIST_HISTORY.map(h => ({
      ...h,
      priceListTitle: h.priceListTitle || h.priceListName,
      editorName: h.editorName || h.changedBy,
      changedSkusCount: h.changedCount,
      totalSkus: h.totalProcessed,
    }));
  },

  savePriceListHistory(records: PriceListHistoryRecord[]): void {
    try {
      persistPortalCache(PRICE_LIST_HISTORY_KEY, JSON.stringify(records));
      notifyListeners();
    } catch {
      // ignore
    }
  },

  deletePriceListHistory(historyId: string): void {
    const next = this.getPriceListHistory().filter(h => h.id !== historyId);
    this.savePriceListHistory(next);
  },

  deletePriceListHistoryRecord(historyId: string): void {
    this.deletePriceListHistory(historyId);
  },

  deleteMultipleHistoryRecords(historyIds: string[]): void {
    const next = this.getPriceListHistory().filter(h => !historyIds.includes(h.id));
    this.savePriceListHistory(next);
  },

  clearAllPriceListHistory(): void {
    this.savePriceListHistory([]);
  },

  saveLegacyCustomer(payload: {
    fullName: string;
    companyName: string;
    phone: string;
    province: string;
    city: string;
    activityField: string;
    totalPurchaseVolume: number;
    priceListId: string;
    creditLimit: number;
    adminNotes?: string;
  }): CustomerApprovalRecord {
    return this.addLegacyOrDirectCustomer(payload);
  },

  onboardLegacyCustomer(payload: {
    fullName: string;
    companyName?: string;
    phone: string;
    city?: string;
    assignedPriceListCode?: string;
    previousPurchaseVolume?: number;
    creditLimit?: number;
    notes?: string;
  }): CustomerApprovalRecord {
    return this.addLegacyOrDirectCustomer({
      fullName: payload.fullName,
      companyName: payload.companyName || payload.fullName,
      phone: payload.phone,
      province: 'یزد',
      city: payload.city || 'یزد',
      activityField: 'تولید و خدمات صنعتی',
      totalPurchaseVolume: payload.previousPurchaseVolume ?? 0,
      priceListId: this.getPriceListByCode(payload.assignedPriceListCode || 'C')?.id || '',
      creditLimit: payload.creditLimit ?? 0,
      adminNotes: payload.notes,
    });
  },

  deleteCustomer(customerId: string): void {
    const records = this.getCustomerApprovals().filter(c => c.id !== customerId);
    this.saveCustomerApprovals(records);
  },

  assignCustomerGradeAndPriceList(
    customerId: string,
    data: { priceListCode?: string; clubTier?: ClubPortalTier; gradeId?: string; creditLimit?: number }
  ): CustomerApprovalRecord | undefined {
    const crm = JSON.parse(durableStorage.getItem('atlas_admin_customers_v1') || '[]') as Customer[];
    const target = crm.find(c => c.id === customerId && c.approvedB2B === true);
    if (target) {
      const list = data.priceListCode ? this.getPriceListByCode(data.priceListCode) : undefined;
      if (list) { target.assignedPriceListCode = list.code; target.clubTier = list.clubTier === 'platinum' ? 'gold' : list.clubTier; }
      if (data.creditLimit !== undefined) target.creditLimit = data.creditLimit;
      persistPortalCache('atlas_admin_customers_v1', JSON.stringify(crm));
    }
    const records = this.getCustomerApprovals();
    const customer = records.find(c => c.id === customerId);
    if (!customer) return undefined;

    if (data.priceListCode) {
      const pl = this.getPriceListByCode(data.priceListCode);
      if (pl) {
        customer.assignedPriceListId = pl.id;
        customer.assignedPriceListCode = pl.code;
        customer.assignedClubTier = pl.clubTier;
      }
    }
    if (data.creditLimit !== undefined) customer.assignedCreditLimit = data.creditLimit;
    if (data.gradeId) {
      const g = this.getGradeById(data.gradeId);
      if (g) customer.assignedGradeId = g.id;
    }
    this.saveCustomerApprovals(records);
    return customer;
  },

  // --- Customer Registration Approvals & Legacy Customer Grading ---
  getCustomerApprovals(): CustomerApprovalRecord[] {
    try {
      const stored = durableStorage.getItem(CUSTOMERS_APPROVAL_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return [];
  },

  saveCustomerApprovals(records: CustomerApprovalRecord[]): void {
    try {
      persistPortalCache(CUSTOMERS_APPROVAL_KEY, JSON.stringify(records));
      notifyListeners();
    } catch {
      // ignore
    }
  },

  getCustomerByPhone(phone: string): CustomerApprovalRecord | undefined {
    const clean = phone.trim();
    return this.getCustomerApprovals().find(c => c.phone === clean);
  },

  /**
   * Automatically recommends the best Price List (A, B, C, D) and Club Tier based on purchase volume.
   */
  recommendPriceListByVolume(purchaseVolume: number): DynamicPriceList {
    const lists = this.getPriceLists()
      .filter(p => !p.isRetailCash)
      .sort((a, b) => (b.minPurchaseVolume || 0) - (a.minPurchaseVolume || 0));
    for (const pl of lists) {
      if (purchaseVolume >= (pl.minPurchaseVolume || 0)) {
        return pl;
      }
    }
    if(!lists.length && databaseStorageEnabled())throw new Error('لیست قیمت در دیتابیس تعریف نشده است.');
    return lists[lists.length - 1] || INITIAL_PRICE_LISTS[3];
  },

  registerCustomer(
    data: Omit<CustomerApprovalRecord, 'id' | 'registeredAt' | 'status' | 'totalPurchaseVolume'> & {
      totalPurchaseVolume?: number;
    }
  ): CustomerApprovalRecord {
    const records = this.getCustomerApprovals();
    const existing = records.find(r => r.phone === data.phone.trim());
    if (existing) {
      return existing;
    }

    const newRecord: CustomerApprovalRecord = {
      ...data,
      totalPurchaseVolume: data.totalPurchaseVolume || 0,
      id: 'cust-req-' + Date.now(),
      registeredAt: new Date().toLocaleDateString('fa-IR'),
      status: 'pending',
    };

    records.unshift(newRecord);
    this.saveCustomerApprovals(records);
    return newRecord;
  },

  /**
   * Adds an existing/legacy customer (مشتریان قدیمی که از قبل با ما کار می‌کردند) directly with their assigned Price List (A, B, C, D)
   */
  addLegacyOrDirectCustomer(payload: {
    fullName: string;
    companyName: string;
    phone: string;
    province: string;
    city: string;
    activityField: string;
    totalPurchaseVolume: number;
    priceListId: string;
    creditLimit: number;
    adminNotes?: string;
    isLegacyCustomer?: boolean;
  }): CustomerApprovalRecord {
    const records = this.getCustomerApprovals();
    const pl = this.getPriceListById(payload.priceListId) || this.getPriceLists()[0];
    const grades = this.getGrades();
    const matchedGrade = grades.find(g => g.priceListId === pl.id) || grades[0];

    const existingIdx = records.findIndex(r => r.phone.trim() === payload.phone.trim());
    const newRecord: CustomerApprovalRecord = {
      id: existingIdx >= 0 ? records[existingIdx].id : 'cust-legacy-' + Date.now(),
      fullName: payload.fullName.trim(),
      companyName: payload.companyName.trim() || 'مجموعه صنعتی همکار',
      phone: payload.phone.trim(),
      province: payload.province || 'یزد',
      city: payload.city || 'یزد',
      activityField: payload.activityField || 'صنایع و خطوط تولید',
      monthlyPurchaseEstimate:
        payload.totalPurchaseVolume >= 100000000
          ? 'بالای ۱۰۰ میلیون تومان'
          : payload.totalPurchaseVolume >= 30000000
          ? '۳۰ تا ۱۰۰ میلیون تومان'
          : '۱۰ تا ۳۰ میلیون تومان',
      totalPurchaseVolume: payload.totalPurchaseVolume,
      isLegacyCustomer: payload.isLegacyCustomer ?? true,
      registeredAt:
        existingIdx >= 0 ? records[existingIdx].registeredAt : new Date().toLocaleDateString('fa-IR'),
      reviewedAt: new Date().toLocaleDateString('fa-IR'),
      status: 'approved',
      assignedGradeId: matchedGrade?.id,
      assignedPriceListId: pl.id,
      assignedPriceListCode: pl.code,
      assignedClubTier: pl.clubTier,
      assignedCreditLimit: payload.creditLimit,
      adminNotes:
        payload.adminNotes ||
        `مشتری قدیمی اضافه‌شده به سامانه با لیست قیمت ${pl.code} (${pl.clubTierLabel})`,
    };

    if (existingIdx >= 0) {
      records[existingIdx] = newRecord;
    } else {
      records.unshift(newRecord);
    }

    this.saveCustomerApprovals(records);
    return newRecord;
  },

  approveAndGradeCustomer(
    customerId: string,
    gradeId: string,
    priceListId: string,
    creditLimit?: number,
    adminNotes?: string,
    totalPurchaseVolume?: number
  ): CustomerApprovalRecord | undefined {
    const records = this.getCustomerApprovals();
    const customer = records.find(c => c.id === customerId);
    if (!customer) return undefined;

    const grade = this.getGradeById(gradeId);
    const priceList = this.getPriceListById(priceListId) || this.getPriceLists()[0];

    customer.status = 'approved';
    customer.assignedGradeId = gradeId;
    customer.assignedPriceListId = priceList.id;
    customer.assignedPriceListCode = priceList.code;
    customer.assignedClubTier = priceList.clubTier;
    customer.assignedCreditLimit = creditLimit ?? grade?.creditLimit ?? 50000000;
    if (totalPurchaseVolume !== undefined) {
      customer.totalPurchaseVolume = totalPurchaseVolume;
    }
    customer.reviewedAt = new Date().toLocaleDateString('fa-IR');
    if (adminNotes) customer.adminNotes = adminNotes;
    delete customer.rejectionReason;

    this.saveCustomerApprovals(records);

    // Sync active session if logged in
    try {
      const activeUser = durableStorage.getItem('hyper_sanat_auth_state_v2');
      if (activeUser) {
        const parsed = JSON.parse(activeUser);
        if (parsed.phone === customer.phone) {
          parsed.approvedB2B = true;
          parsed.assignedGradeId = gradeId;
          parsed.assignedPriceListId = priceList.id;
          parsed.assignedPriceListCode = priceList.code;
          parsed.clubTier = priceList.clubTier === 'platinum' ? 'gold' : priceList.clubTier;
          parsed.creditLimit = customer.assignedCreditLimit;
          parsed.totalPurchases = customer.totalPurchaseVolume;
          persistPortalCache('hyper_sanat_auth_state_v2', JSON.stringify(parsed));
        }
      }
    } catch {
      // ignore
    }

    return customer;
  },

  rejectCustomer(customerId: string, reason: string): CustomerApprovalRecord | undefined {
    const records = this.getCustomerApprovals();
    const customer = records.find(c => c.id === customerId);
    if (!customer) return undefined;

    customer.status = 'rejected';
    customer.rejectionReason = reason;
    customer.reviewedAt = new Date().toLocaleDateString('fa-IR');
    this.saveCustomerApprovals(records);
    return customer;
  },

  // --- Club Rewards Management (انتخاب جوایز برای هر مشتری تکی یا دسته‌جمعی) ---
  getClubRewards(): ClubRewardAssignment[] {
    try {
      const stored = durableStorage.getItem(CLUB_REWARDS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    this.saveClubRewards(INITIAL_CLUB_REWARDS);
    return [];
  },

  saveClubRewards(rewards: ClubRewardAssignment[]): void {
    try {
      persistPortalCache(CLUB_REWARDS_STORAGE_KEY, JSON.stringify(rewards));
      notifyListeners();
    } catch {
      // ignore
    }
  },

  addClubReward(reward: Omit<ClubRewardAssignment, 'id' | 'createdAt'>): ClubRewardAssignment {
    const list = this.getClubRewards();
    const newReward: ClubRewardAssignment = {
      ...reward,
      id: 'rew-' + Date.now(),
      createdAt: new Date().toLocaleDateString('fa-IR'),
    };
    list.unshift(newReward);
    this.saveClubRewards(list);
    return newReward;
  },

  deleteClubReward(id: string): void {
    const list = this.getClubRewards().filter(r => r.id !== id);
    this.saveClubRewards(list);
  },

  toggleClubRewardActive(id: string): void {
    const list = this.getClubRewards().map(r => (r.id === id ? { ...r, active: !r.active } : r));
    this.saveClubRewards(list);
  },

  getClubRewardsFiltered(params: {
    customerId?: string;
    phone?: string;
    clubTier?: ClubPortalTier;
    priceListCode?: string;
    totalPurchaseVolume?: number;
  }): ClubRewardAssignment[] {
    const all = this.getClubRewards().filter(r => r.active);
    return all.filter(r => {
      if (r.targetType === 'individual') {
        if (params.customerId && r.targetCustomerIds?.includes(params.customerId)) return true;
        return false;
      }
      // Collective rewards
      const tierMatch =
        !r.targetClubTier ||
        r.targetClubTier === 'all' ||
        r.targetClubTier === params.clubTier;
      const plMatch =
        !r.targetPriceListCode ||
        r.targetPriceListCode === 'ALL' ||
        r.targetPriceListCode.toUpperCase() === (params.priceListCode || '').toUpperCase();
      return tierMatch || plMatch;
    });
  },

  // --- Dynamic Price Calculation Engine (بر اساس کد کالا و لیست قیمت A, B, C, D مشتری) ---
  calculateInquiryPrice(
    product: Product,
    priceListId?: string,
    gradeId?: string,
    variantCode?: string
  ): {
    calculatedPrice: number;
    retailPrice: number;
    savingsAmount: number;
    priceListCode: string;
    priceListName: string;
    clubTier: ClubPortalTier;
    clubTierLabel: string;
    gradeName: string;
    discountPercent: number;
    creditLimit: number;
    settlementDays: number;
  } | null {
    const targetVar = variantCode
      ? (product.variants || []).find(v => v.code === variantCode)
      : (product.variants || [])[0];

    const retailPl = this.getPriceLists().find(p => p.isRetailCash);
    const lookupCode = variantCode || targetVar?.code || product.code;

    const baseRetail =
      retailPl?.customProductPrices?.[lookupCode] ??
      (targetVar?.price && targetVar.price > 0
        ? targetVar.price
        : product.prices.retail > 0
        ? product.prices.retail
        : 0);

    if (!priceListId && !gradeId) return null;

    let targetPriceList: DynamicPriceList | undefined;
    let targetGrade: CustomerGrade | undefined;

    if (gradeId) {
      targetGrade = this.getGradeById(gradeId);
    }
    if (priceListId) {
      targetPriceList = this.getPriceListById(priceListId);
    } else if (targetGrade) {
      targetPriceList = this.getPriceListById(targetGrade.priceListId);
    }

    if (!targetPriceList) {
      targetPriceList = this.getPriceLists().find(p => p.isDefault) || (databaseStorageEnabled()?undefined:INITIAL_PRICE_LISTS[3]);
    }

    if(!targetPriceList)return null;
    const customMap = targetPriceList.customProductPrices || {};
    const strippedCode = normalizeSkuCodeKey(lookupCode);
    const exactSkuPrice =
      customMap[lookupCode] ?? customMap[strippedCode] ?? customMap[product.code];

    if (exactSkuPrice !== undefined && exactSkuPrice > 0) {
      const effectiveRetail = baseRetail > 0 ? baseRetail : Math.round(exactSkuPrice * 1.18);
      const savings = Math.max(0, effectiveRetail - exactSkuPrice);
      const effectiveDisc =
        effectiveRetail > 0 ? Math.round((savings / effectiveRetail) * 100) : targetPriceList.discountPercent;

      return {
        calculatedPrice: exactSkuPrice,
        retailPrice: effectiveRetail,
        savingsAmount: savings,
        priceListCode: targetPriceList.code,
        priceListName: targetPriceList.name,
        clubTier: targetPriceList.clubTier,
        clubTierLabel: targetPriceList.clubTierLabel,
        gradeName: targetGrade ? targetGrade.code : `کرید ${targetPriceList.code}`,
        discountPercent: effectiveDisc,
        creditLimit: targetGrade ? targetGrade.creditLimit : 100000000,
        settlementDays: targetGrade ? targetGrade.settlementDays : 30,
      };
    }

    if (baseRetail <= 0) return null;

    const discount = targetPriceList.discountPercent || 0;
    const finalPrice = Math.round((baseRetail * (1 - discount / 100)) / 1000) * 1000;

    return {
      calculatedPrice: finalPrice,
      retailPrice: baseRetail,
      savingsAmount: Math.max(0, baseRetail - finalPrice),
      priceListCode: targetPriceList.code,
      priceListName: targetPriceList.name,
      clubTier: targetPriceList.clubTier,
      clubTierLabel: targetPriceList.clubTierLabel,
      gradeName: targetGrade ? targetGrade.code : `کرید ${targetPriceList.code}`,
      discountPercent: discount,
      creditLimit: targetGrade ? targetGrade.creditLimit : 100000000,
      settlementDays: targetGrade ? targetGrade.settlementDays : 30,
    };
  },

  // Instant inquiry status cache
  getInquiryCache(): Record<string, boolean> {
    try {
      const stored = sessionStorage.getItem(USER_INQUIRY_CACHE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  },

  markProductInquired(productCode: string): void {
    try {
      const cache = this.getInquiryCache();
      cache[productCode] = true;
      sessionStorage.setItem(USER_INQUIRY_CACHE_KEY, JSON.stringify(cache));
    } catch {
      // ignore
    }
  },

  isProductInquired(productCode: string): boolean {
    const cache = this.getInquiryCache();
    return !!cache[productCode];
  },

  getAllCustomers(): Customer[] {
    try { return JSON.parse(durableStorage.getItem('atlas_admin_customers_v1') || '[]').filter((c: Customer) => c.approvedB2B === true); } catch { return []; }
  },

  getAllCatalogSkuItems(): CatalogSkuPriceItem[] {
    const products = getManagedCatalogProducts();
    const list: CatalogSkuPriceItem[] = [];
    products.forEach(p => {
      const vars = p.variants || [];
      if (vars.length > 0) {
        vars.forEach(v => {
          const basePr = v.price ?? v.prices?.retail ?? p.prices?.retail ?? 0;
          list.push({
            code: v.code,
            name: v.name,
            familyCode: p.code,
            familyName: p.name,
            categoryName: p.categoryName || 'تسمه‌های صنعتی',
            size: v.size || 'استاندارد',
            brand: v.brand || p.brand || 'ATLAS',
            unit: v.unit || p.unit || 'عدد',
            baseRetailPrice: basePr,
            basePrice: basePr,
          });
        });
      } else {
        const basePr = p.prices?.retail || 0;
        list.push({
          code: p.code.replace(/^FAM-/, ''),
          name: p.name,
          familyCode: p.code,
          familyName: p.name,
          categoryName: p.categoryName || 'تسمه‌های صنعتی',
          size: 'استاندارد',
          brand: p.brand || 'ATLAS',
          unit: p.unit || 'عدد',
          baseRetailPrice: basePr,
          basePrice: basePr,
        });
      }
    });
    return list;
  },

  getPriceListForCustomer(customer: Customer): PriceListDefinition | undefined {
    const code = (customer.assignedPriceListCode || 'C').toUpperCase();
    const found = this.getPriceLists().find(p => p.code.toUpperCase() === code);
    if (found) return found;
    return undefined;
  },

  getClubRewardRules(): ClubRewardRule[] {
    return [
      {
        id: 'rw-gold-credit',
        title: 'اعتبار خرید ویژه فصلی (۲۰ میلیون تومان)',
        description: 'قابل استفاده در فاکتورهای خرید عمده بعدی برای مشتریان طلایی',
        targetTier: 'gold',
        minVolumeRequired: 80000000,
        rewardType: 'cashback',
        valueLabel: '۲۰,۰۰۰,۰۰۰ تومان اعتبار خرید',
        active: true,
      },
      {
        id: 'rw-platinum-gift',
        title: 'پک ابزار تخصصی و دستگاه تست کششی تسمه FORZA',
        description: 'هدیه انحصاری مدیران ارشد برای مشتریان سطح الماس و قدیمی',
        targetTier: 'platinum',
        minVolumeRequired: 200000000,
        rewardType: 'gift',
        valueLabel: 'پک ابزار مهندسی ارزش ۳۵ میلیون تومان',
        active: true,
      },
      {
        id: 'rw-silver-freight',
        title: 'ارسال رایگان بدون محدودیت وزن تا انبار مشتری',
        description: 'معافیت کامل از هزینه باربری و تیپاکس اکسپرس',
        targetTier: 'silver',
        minVolumeRequired: 30000000,
        rewardType: 'freight',
        valueLabel: 'ارسال رایگان کلیه مرسولات',
        active: true,
      },
    ];
  },

  saveClubRewardRule(rule: ClubRewardRule): void {
    // mock save
  },

  getRewardAssignments(): CustomerRewardAssignment[] {
    try {
      const stored = durableStorage.getItem('atlas_customer_reward_assignments_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  },

  assignRewardToCustomers(payload: {
    reward: ClubRewardRule;
    assignmentScope: 'individual' | 'collective';
    targetCustomers?: Customer[];
    targetTierLabel?: string;
    notes?: string;
  }): CustomerRewardAssignment {
    const newAsg: CustomerRewardAssignment = {
      id: 'asg-' + Date.now(),
      rewardTitle: payload.reward.title,
      rewardValue: payload.reward.valueLabel,
      assignmentScope: payload.assignmentScope,
      targetCustomerIds: (payload.targetCustomers || []).map(c => c.id),
      targetCustomerName: payload.targetCustomers?.[0]?.companyName || payload.targetCustomers?.[0]?.fullName,
      targetTierLabel: payload.targetTierLabel || (payload.targetCustomers?.length ? `${payload.targetCustomers.length} مشتری` : 'گرید انتخابی'),
      assignedAt: new Date().toLocaleDateString('fa-IR'),
      notes: payload.notes,
    };
    try {
      const list = this.getRewardAssignments();
      list.unshift(newAsg);
      persistPortalCache('atlas_customer_reward_assignments_v1', JSON.stringify(list));
      notifyListeners();
    } catch {}
    return newAsg;
  },

  deleteRewardAssignment(id: string): void {
    try {
      const list = this.getRewardAssignments().filter(a => a.id !== id);
      persistPortalCache('atlas_customer_reward_assignments_v1', JSON.stringify(list));
      notifyListeners();
    } catch {}
  },

  getRewardsForCustomer(customer?: Customer): CustomerRewardAssignment[] {
    if (!customer || !customer.approvedB2B) return [];
    return this.getRewardAssignments().filter(a => (a.portal || "high_volume") === (customer.approvedB2B ? "high_volume" : "consumer") && a.targetCustomerIds?.includes(customer.id));
  },

  recommendGradeByPurchaseVolume(volume: number): { code: string; customerTierLabel: string } {
    if (volume >= 200000000) return { code: 'A', customerTierLabel: 'طلایی ویژه (VIP / الماس)' };
    if (volume >= 80000000) return { code: 'B', customerTierLabel: 'سطح طلایی (Gold)' };
    if (volume >= 30000000) return { code: 'C', customerTierLabel: 'سطح نقره‌ای (Silver)' };
    return { code: 'D', customerTierLabel: 'سطح برنزی (Bronze)' };
  },
};

