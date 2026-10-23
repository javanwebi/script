import {durableStorage,databaseStorageEnabled} from "./durableStorage";
import { portalRequest, hydratePortal, clearPortalCache } from './portalRepository';
import { persistPortalCache } from './portalRepository';
import { Product, Order, PriceInquiry, Customer, DiscountCode, SmsLog, AgencyApplication, Category, Brand, Ticket, Representative, OfficialInvoice } from '../types';
import {
  generateMockProducts,
  getManagedCatalogProducts,
  saveManagedFamily,
  deleteManagedFamily,
  resetManagedFamily,
  moveGalleryImageToFamily,
} from '../data/mockGenerator';
import { MOCK_DISCOUNT_CODES } from '../data/mockData';
import { CATEGORIES } from '../data/categories';
import { BRANDS } from '../data/brands';
import { agencyService } from './agencyService';

export type { SmsLog, OfficialInvoice };

export type AdminAuditLog = AuditLog;
export type InquiryRequest = PriceInquiry;

export interface AdminOrder {
  id: string;
  customerName: string;
  company?: string;
  phone: string;
  totalAmount: number;
  paymentMethod: 'online' | 'receipt' | 'credit';
  status: 'pending' | 'confirmed' | 'packing' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  items: {
    productCode: string;
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }[];
  receiptVerified?: boolean;
  receiptImageUrl?: string;
  receiptTrackingCode?: string;
  carrier?: string;
  trackingNumber?: string;
  shippingAddress?: string;
}

export interface SupportTicket {
  id: string;
  customerName: string;
  phone: string;
  subject: string;
  status: 'open' | 'in_progress' | 'answered' | 'closed';
  createdAt: string;
  messages: {
    id: string;
    sender: 'user' | 'admin';
    text: string;
    timestamp: string;
  }[];
}

export interface ActiveAgency {
  id: string;
  code: string;
  name: string;
  phone: string;
  province: string;
  city: string;
  creditLimit: number;
  currentBalance: number;
  nextCheckDate: string;
  contractStatus: 'valid' | 'expired' | 'pending_renewal';
}

export interface SupplyRequestItem {
  id: string;
  agencyName: string;
  productName: string;
  productCode: string;
  quantity: number;
  urgency: 'normal' | 'immediate';
  status: 'pending' | 'approved' | 'dispatched';
  createdAt: string;
}

export interface ClubMember {
  id: string;
  name: string;
  phone: string;
  points: number;
  level: string;
  joinedAt: string;
}

export interface RewardRequestItem {
  id: string;
  memberName: string;
  phone: string;
  rewardTitle: string;
  pointsCost: number;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

export interface AdminUser {
  id: string;
  username: string;
  name: string;
  role: 'super_admin' | 'sales_manager' | 'warehouse_operator';
  email: string;
  lastLogin: string;
  permissions?: string[];
}

export interface AuditLog {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  action: string;
  entity?: string;
  target?: string;
  details: string;
  timestamp: string;
  [key: string]: any;
}

export interface PriceHistoryRecord {
  id: string;
  productCode: string;
  productName: string;
  oldPrice: number;
  newPrice: number;
  changedBy: string;
  reason: string;
  date: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  code: string;
  name: string;
  brand: string;
  category: string;
  basePrice: number;
  retailPrice: number;
  wholesalePrice: number;
  dealerPrice: number;
  stock: number;
  status: 'new' | 'update' | 'error';
  errorMessage?: string;
  existingProduct?: Product;
}

export interface ImportResultReport {
  totalProcessed: number;
  newCount: number;
  newCreated?: number;
  updatedCount: number;
  updated?: number;
  errorCount: number;
  errorsCount?: number;
  errors: { row: number; code: string; message: string }[];
  errorDetails?: any[];
  timestamp: string;
}

export interface BannerItem {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: 'hero_slider' | 'middle_banner' | 'footer_banner';
  order: number;
  active: boolean;
  validUntil?: string;
}

export interface SmsTemplate {
  id: string;
  eventKey: 'register' | 'order_submit' | 'order_status' | 'agency_approve' | 'inquiry_answer' | 'custom_bulk';
  title: string;
  text: string;
  variables: string[];
}

export interface ClubConfig {
  pointsPer100kTomans: number; // e.g. 1 point per 100,000 Tomans
  tomanPerPointRedeem: number; // e.g. 5,000 Tomans per point discount
  bronzeThreshold: number;     // 0
  silverThreshold: number;     // 500
  goldThreshold: number;       // 1200
  welcomeGiftPoints: number;   // 50
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  author?: string;
  excerpt?: string;
  content: string;
  imageUrl: string;
  publishedAt?: string;
  published?: boolean;
  createdAt?: string;
  views?: number;
  tags?: string[];
}

export interface StaticPage {
  id: string;
  slug: string;
  title: string;
  content: string;
  lastUpdated: string;
}

export interface CampaignItem {
  id: string;
  title: string;
  description?: string;
  multiplier?: number;
  validUntil?: string;
  rewardType?: 'points' | 'discount_code' | 'free_gift';
  rewardValue?: string;
  startDate?: string;
  endDate?: string;
  targetTier?: 'all' | 'silver' | 'gold';
  active: boolean;
  participantsCount?: number;
}

export interface SystemSettings {
  paymentGateway?: {
    provider: 'mellat' | 'saman' | 'zarinpal';
    merchantId: string;
    terminalId: string;
    sandbox: boolean;
  };
  paymentGateways?: any;
  smsProvider?: {
    provider: 'kavenegar' | 'melipayamak' | 'farapayamak';
    apiKey: string;
    senderNumber: string;
  };
  smsConfig?: any;
  shippingMethods?: {
    barbari: boolean;
    tipax: boolean;
    expressPost: boolean;
    dedicatedFleet: boolean;
  };
  shippingMethodsConfig?: any;
  currency?: 'toman' | 'rial';
  seo?: {
    metaTitle: string;
    metaDescription: string;
    keywords: string;
    canonicalBase: string;
  };
  [key: string]: any;
}

const STORAGE_KEYS = {
  ADMIN_AUTH: 'atlas_admin_auth_v1',
  ADMIN_PRODUCTS: 'atlas_admin_products_v1',
  PRICE_LOGS: 'atlas_admin_price_logs_v1',
  AUDIT_LOGS: 'atlas_admin_audit_logs_v1',
  BANNERS: 'atlas_admin_banners_v1',
  SMS_TEMPLATES: 'atlas_admin_sms_templates_v1',
  CLUB_CONFIG: 'atlas_admin_club_config_v1',
  INQUIRIES: 'atlas_admin_inquiries_v1',
  ORDERS: 'atlas_admin_orders_v1',
  CUSTOMERS: 'atlas_admin_customers_v1',
  DISCOUNTS: 'atlas_admin_discounts_v1',
  CATEGORIES: 'atlas_admin_categories_v1',
  BRANDS: 'atlas_admin_brands_v1',
  DEALERS: 'atlas_admin_dealers_v1',
  TICKETS: 'atlas_admin_tickets_v1',
  BLOG: 'atlas_admin_blog_v1',
  PAGES: 'atlas_admin_pages_v1',
  CAMPAIGNS: 'atlas_admin_campaigns_v1',
  SETTINGS: 'atlas_admin_settings_v1',
};

// Initial Seed Data
const INITIAL_ADMINS: AdminUser[] = [];

const INITIAL_AUDIT_LOGS: AuditLog[] = [];

const INITIAL_PRICE_HISTORY: PriceHistoryRecord[] = [
  {
    id: 'ph-1',
    productCode: 'AT-751',
    productName: 'غلتک سرامیکی نسوز کوره مدل AT-751',
    oldPrice: 3200000,
    newPrice: 3450000,
    changedBy: 'مهندس مرتضوی',
    reason: 'افزایش هزینه ترخیص گمرکی و حمل',
    date: '۱۴۰۳/۰۶/۱۵',
  },
  {
    id: 'ph-2',
    productCode: 'SWR-230',
    productName: 'تسمه تایمینگ دنده‌ای HTD-8M-1760',
    oldPrice: 1550000,
    newPrice: 1650000,
    changedBy: 'خانم دهقان',
    reason: 'به‌روزرسانی طبق لیست رسمی ۲۰۲۴ شرکت SWR',
    date: '۱۴۰۳/۰۶/۱۰',
  },
];

export const INITIAL_BANNERS: BannerItem[] = [
  {
    id: 'ban-1',
    title: 'تخفیف شگفت‌انگیز تسمه‌های صنعتی SWR و FORZA',
    imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1200&q=80',
    linkUrl: '/category/swr-forza-exclusive',
    position: 'hero_slider',
    order: 1,
    active: true,
  },
  {
    id: 'ban-2',
    title: 'تأمین فوری قطعات کوره کارخانجات کاشی و سرامیک یزد',
    imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=1200&q=80',
    linkUrl: '/category/ceramic-tiles',
    position: 'hero_slider',
    order: 2,
    active: true,
  },
  {
    id: 'ban-3',
    title: 'جذب نمایندگی فعال و عاملیت فروش در سراسر کشور',
    imageUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&q=80',
    linkUrl: '/agency',
    position: 'middle_banner',
    order: 1,
    active: true,
  },
];

export const INITIAL_SMS_TEMPLATES: SmsTemplate[] = [
  {
    id: 'tpl-1',
    eventKey: 'register',
    title: 'خوش‌آمدگویی ثبت‌نام و باشگاه مشتریان',
    text: 'کاربر گرامی {customer_name}، به صنعت پیش خوش آمدید. ۵۰ امتیاز باشگاه و کد تخفیف ۱۰٪ اولین خرید (WELCOME10) به حساب شما واریز گردید.',
    variables: ['{customer_name}'],
  },
  {
    id: 'tpl-2',
    eventKey: 'order_status',
    title: 'اطلاع‌رسانی تغییر وضعیت سفارش',
    text: 'سفارش شما به شماره {order_number} به وضعیت «{new_status}» تغییر یافت. بارنامه: {tracking_code} | صنعت پیش',
    variables: ['{order_number}', '{new_status}', '{tracking_code}'],
  },
  {
    id: 'tpl-3',
    eventKey: 'inquiry_answer',
    title: 'پاسخ به استعلام قیمت قطعات صنعتی',
    text: 'مشتری گرامی {customer_name}، استعلام قیمت کالای {product_name} پاسخ داده شد. قیمت مصوب: {price} تومان (معتبر تا {validity_date}). جزئیات در پرتال: hypersanat.ir',
    variables: ['{customer_name}', '{product_name}', '{price}', '{validity_date}'],
  },
  {
    id: 'tpl-4',
    eventKey: 'agency_approve',
    title: 'تأیید درخواست نمایندگی و فعال‌سازی پرتال پخش',
    text: 'جناب {manager_name}، با تبریک، درخواست عاملیت شما برای واحد {company_name} تأیید شد. پرتال پخش و خرید با تخفیف نمایندگی فعال گردید: hypersanat.ir/dealer',
    variables: ['{manager_name}', '{company_name}'],
  },
];

export const INITIAL_CLUB_CONFIG: ClubConfig = {
  pointsPer100kTomans: 1,
  tomanPerPointRedeem: 5000,
  bronzeThreshold: 0,
  silverThreshold: 500,
  goldThreshold: 1200,
  welcomeGiftPoints: 50,
};

export const adminService = {
  // --- Admin Auth ---
  getCurrentAdmin(): AdminUser | null {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.ADMIN_AUTH);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return null;
  },

  getCurrentUser(): AdminUser | null {
    return this.getCurrentAdmin();
  },

  async login(username: string, pass: string): Promise<AdminUser | null> {
    const identity=await portalRequest({ action: 'admin_login', username, password: pass });
    await hydratePortal();
    const profile=identity.user || {};
    const role:AdminUser['role']=profile.role==='sales_manager'?'sales_manager':profile.role==='warehouse_operator'?'warehouse_operator':'super_admin';
    const user: AdminUser = { id:profile.authUserId||profile.id||'admin', username:profile.username||username, name:profile.fullName||'مدیریت صنعت پیش', role, email:profile.email||'', lastLogin:new Date().toISOString(), permissions:role==='super_admin'?undefined:(Array.isArray(profile.adminPermissions)?profile.adminPermissions:[]) };
    durableStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, JSON.stringify(user));
    return user;
  },
  logout(): void {
    void portalRequest({ action: 'logout' });
    clearPortalCache();
    durableStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  },
  switchAdminRole(_role: AdminUser['role']): AdminUser {
    return this.getCurrentAdmin()!;
  },

  // --- Audit Logs ---
  getAuditLogs(): AuditLog[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return databaseStorageEnabled()?[]:INITIAL_AUDIT_LOGS;
  },

  logAction(action: string, entity: string, details: string): void {
    const admin = this.getCurrentAdmin();
    if(!admin)return;
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: 'log-' + Date.now(),
      userId: admin.id,
      userName: admin.name,
      userRole: admin.role,
      action,
      entity,
      details,
      timestamp: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
    };
    logs.unshift(newLog);
    try {
      persistPortalCache(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(logs.slice(0, 100)));
    } catch {
      // ignore
    }
  },

  // --- Products Management (Full 1,383 Families + 10,435 SKUs + Custom Families) ---
  getProducts(): Product[] {
    return getManagedCatalogProducts({ includeInactive: true });
  },

  saveProduct(product: Product): Product {
    const list = this.getProducts();
    const existing = list.find(p => p.code.toLowerCase() === product.code.toLowerCase());
    const admin = this.getCurrentAdmin();

    if (existing) {
      if (existing.prices?.retail !== product.prices?.retail) {
        this.addPriceLog({
          productCode: product.code,
          productName: product.name,
          oldPrice: existing.prices?.retail || 0,
          newPrice: product.prices?.retail || 0,
          changedBy: admin?.name || 'مدیر سیستم',
          reason: 'ویرایش خانواده/کد کالا در پنل مدیریت',
        });
      }
      this.logAction('ویرایش خانواده محصول', `کد ${product.code}`, `خانواده «${product.name}» و کدهای زیرمجموعه به‌روزرسانی شد.`);
    } else {
      this.logAction('ایجاد خانواده محصول', `کد ${product.code}`, `خانواده جدید «${product.name}» ثبت شد.`);
    }

    saveManagedFamily(product);
    return product;
  },

  deleteProduct(code: string): void {
    deleteManagedFamily(code);
    this.logAction('حذف خانواده محصول', `کد ${code}`, `خانواده با کد ${code} از کاتالوگ حذف شد.`);
  },

  resetProductToDefault(code: string): void {
    resetManagedFamily(code);
    this.logAction('بازنشانی خانواده محصول', `کد ${code}`, `خانواده ${code} به اطلاعات اولیه کاتالوگ بازگردانده شد.`);
  },

  async moveImageBetweenFamilies(
    sourceFamilyCode: string,
    imageId: string,
    targetFamilyCode: string,
    targetVariantCode?: string
  ): Promise<boolean> {
    const ok = await moveGalleryImageToFamily(sourceFamilyCode, imageId, targetFamilyCode, targetVariantCode);
    if (ok) {
      this.logAction(
        'انتقال تصویر کالا',
        `${sourceFamilyCode} ← ${targetFamilyCode}`,
        `تصویر ${imageId} از خانواده ${sourceFamilyCode} به ${targetFamilyCode}${targetVariantCode ? ` (کد ${targetVariantCode})` : ''} منتقل شد.`
      );
    }
    return ok;
  },

  // --- Price Multipliers & Category Batch Update ---
  batchUpdateCategoryPrices(categorySlug: string, percentChange: number, reason: string): number {
    const list = this.getProducts();
    let updatedCount = 0;
    const factor = 1 + percentChange / 100;
    const admin = this.getCurrentAdmin();

    const updatedList = list.map(p => {
      if (categorySlug === 'all' || p.categorySlug === categorySlug) {
        const oldPrice = p.prices.retail;
        const newRetail = Math.round((p.prices.retail * factor) / 1000) * 1000;
        const newWholesale = Math.round((p.prices.wholesale * factor) / 1000) * 1000;
        const newDealer = Math.round((p.prices.dealer * factor) / 1000) * 1000;
        const newBase = Math.round((p.prices.base * factor) / 1000) * 1000;

        if (oldPrice !== newRetail) {
          this.addPriceLog({
            productCode: p.code,
            productName: p.name,
            oldPrice,
            newPrice: newRetail,
            changedBy: admin?.name || 'مدیر بازرگانی',
            reason: reason || `تغییر گروهی ${percentChange}% روی دسته`,
          });
          updatedCount++;
        }

        return {
          ...p,
          prices: {
            base: newBase,
            retail: newRetail,
            wholesale: newWholesale,
            dealer: newDealer,
          },
        };
      }
      return p;
    });

    try {
      persistPortalCache(STORAGE_KEYS.ADMIN_PRODUCTS, JSON.stringify(updatedList));
    } catch {
      // ignore
    }

    this.logAction('تغییر قیمت گروهی', `دسته: ${categorySlug}`, `اعمال ضریب ${percentChange}% روی ${updatedCount} کالا`);
    return updatedCount;
  },

  // --- Price History Logs ---
  getPriceHistory(): PriceHistoryRecord[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.PRICE_LOGS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return databaseStorageEnabled()?[]:INITIAL_PRICE_HISTORY;
  },

  addPriceLog(record: Omit<PriceHistoryRecord, 'id' | 'date'>): void {
    const logs = this.getPriceHistory();
    const newLog: PriceHistoryRecord = {
      ...record,
      id: 'ph-' + Date.now(),
      date: new Date().toLocaleDateString('fa-IR'),
    };
    logs.unshift(newLog);
    try {
      persistPortalCache(STORAGE_KEYS.PRICE_LOGS, JSON.stringify(logs.slice(0, 50)));
    } catch {
      // ignore
    }
  },

  // --- Bulk Import Engine ---
  getSampleCsvText(): string {
    return `کد کالا,نام محصول,برند,دسته‌بندی,قیمت پایه,موجودی
AT-751,غلتک سرامیکی نسوز کوره مدل AT-751 اطلس یزد,اطلس پاور,قطعات کاشی و سرامیک,2550000,60
SWR-230,تسمه تایمینگ دنده‌ای تقویت‌شده SWR آلمان مدل HTD-8M-1760,اس دبلیو آر (SWR),برندهای ویژه SWR و FORZA,1250000,150
FORZA-C85,تسمه پروانه‌ای استاندارد FORZA ایتالیا تیپ C طول ۲۱۵۰,فورزا (FORZA),برندهای ویژه SWR و FORZA,680000,220
AT-999,تسمه پلی‌یورتان اسپشیال با روکش لاستیکی نسوز کوره مدل AT-999,اطلس پاور,قطعات کاشی و سرامیک,3850000,30
TXT-404,شیطانک بافندگی نساجی ضد سایش دورنیه,پیکانول / اطلس,ماشین‌آلات نساجی,890000,75
ERR-001,تسمه بدون قیمت تستی,نامشخص,ناشناخته,0,-5`;
  },

  parseAndPreviewCsv(rawText: string): ImportPreviewRow[] {
    const existingList = this.getProducts();
    const existingMap = new Map<string, Product>();
    existingList.forEach(p => {
      existingMap.set(p.code.toUpperCase().trim(), p);
      existingMap.set(p.name.trim(), p);
    });

    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length <= 1) return [];

    const previewRows: ImportPreviewRow[] = [];

    // Parse lines (skipping header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 3) continue;

      const code = cols[0] || '';
      const name = cols[1] || '';
      const brand = cols[2] || 'اطلس';
      const category = cols[3] || 'تسمه‌های صنعتی';
      const rawPrice = Number(cols[4]?.replace(/[^0-9]/g, '')) || 0;
      const rawStock = Number(cols[5]?.replace(/[^0-9]/g, '')) || 0;

      let status: 'new' | 'update' | 'error' = 'new';
      let errorMessage: string | undefined;

      if (!code || !name) {
        status = 'error';
        errorMessage = 'کد کالا یا نام محصول خالی است';
      } else if (rawPrice <= 0) {
        status = 'error';
        errorMessage = 'قیمت پایه نامعتبر یا صفر است';
      }

      const existing = existingMap.get(code.toUpperCase()) || existingMap.get(name);
      if (status !== 'error') {
        if (existing) {
          status = 'update';
        } else {
          status = 'new';
        }
      }

      const basePrice = rawPrice;
      const retailPrice = Math.round(basePrice * 1.35);
      const wholesalePrice = Math.round(basePrice * 1.18);
      const dealerPrice = Math.round(basePrice * 1.08);

      previewRows.push({
        rowNumber: i,
        code,
        name,
        brand,
        category,
        basePrice,
        retailPrice,
        wholesalePrice,
        dealerPrice,
        stock: Math.max(0, rawStock),
        status,
        errorMessage,
        existingProduct: existing,
      });
    }

    return previewRows;
  },

  executeImport(previewRows: ImportPreviewRow[]): ImportResultReport {
    const products = this.getProducts();
    const admin = this.getCurrentAdmin();

    let newCount = 0;
    let updatedCount = 0;
    const errors: { row: number; code: string; message: string }[] = [];

    previewRows.forEach(row => {
      if (row.status === 'error') {
        errors.push({
          row: row.rowNumber,
          code: row.code,
          message: row.errorMessage || 'خطای نامشخص در داده',
        });
        return;
      }

      const existingIdx = products.findIndex(p => p.code.toUpperCase() === row.code.toUpperCase());

      if (existingIdx >= 0) {
        // Update
        const old = products[existingIdx];
        if (old.prices.retail !== row.retailPrice) {
          this.addPriceLog({
            productCode: row.code,
            productName: row.name,
            oldPrice: old.prices.retail,
            newPrice: row.retailPrice,
            changedBy: admin?.name || 'ایمپورت اکسل',
            reason: 'به‌روزرسانی قیمت از طریق فایل اکسل/CSV',
          });
        }

        products[existingIdx] = {
          ...old,
          name: row.name || old.name,
          brand: row.brand || old.brand,
          stock: row.stock,
          prices: {
            base: row.basePrice,
            retail: row.retailPrice,
            wholesale: row.wholesalePrice,
            dealer: row.dealerPrice,
          },
        };
        updatedCount++;
      } else {
        // Create new
        const newProduct: Product = {
          code: row.code,
          name: row.name,
          brand: row.brand || 'اطلس پاور',
          categorySlug: 'industrial-belts',
          categoryName: 'تسمه‌های صنعتی',
          subcategory: row.category || 'تسمه وارداتی',
          technicalSpecs: [
            { key: 'تأمین', value: 'واردات مستقیم بازرگانی اطلس' },
            { key: 'واحد', value: 'عدد' },
          ],
          prices: {
            base: row.basePrice,
            retail: row.retailPrice,
            wholesale: row.wholesalePrice,
            dealer: row.dealerPrice,
          },
          stock: row.stock,
          inquiryOnly: false,
          images: ['https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&q=80'],
          tags: ['جدید', 'واردات ۲۰۲۴'],
          unit: 'عدد',
          description: `کالای صنعتی جدید ${row.name} با تضمین اصالت و استاندارد بین‌المللی.`,
        };
        products.unshift(newProduct);
        newCount++;
      }
    });

    try {
      persistPortalCache(STORAGE_KEYS.ADMIN_PRODUCTS, JSON.stringify(products));
    } catch {
      // ignore
    }

    this.logAction(
      'ایمپورت گروهی محصولات',
      'کاتالوگ کالاها',
      `پردازش فایل: ${newCount} کالای جدید افزوده شد، ${updatedCount} کالا به‌روزرسانی شد و ${errors.length} خطا ثبت گردید.`
    );

    return {
      totalProcessed: previewRows.length,
      newCount,
      updatedCount,
      errorCount: errors.length,
      errors,
      timestamp: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR'),
    };
  },

  // --- Inquiries Management ---
  getInquiries(): PriceInquiry[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.INQUIRIES);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  answerInquiry(inquiryId: string, price: number, validityDays: number | string = 7): void {
    const inquiries = this.getInquiries();
    const idx = inquiries.findIndex(i => i.id === inquiryId);
    if (idx >= 0) {
      const inq = inquiries[idx];
      const validUntil = typeof validityDays === 'string' && !/^\d+$/.test(validityDays.trim())
        ? validityDays
        : new Date(Date.now() + (Number(validityDays) || 7) * 24 * 60 * 60 * 1000).toLocaleDateString('fa-IR');
      inquiries[idx] = {
        ...inq,
        status: 'answered',
        answeredPrice: price,
        priceValidityDate: validUntil,
      };

      try {
        persistPortalCache(STORAGE_KEYS.INQUIRIES, JSON.stringify(inquiries));
      } catch {
        // ignore
      }

      // Mock SMS to customer
      this.sendMockSms(
        inq.phone,
        `مشتری گرامی ${inq.customerName}، استعلام شما برای کالای «${inq.productName}» پاسخ داده شد: قیمت پیشنهادی: ${price.toLocaleString('fa-IR')} تومان (معتبر تا ${validUntil}). ورود به سایت: hypersanat.ir`
      );

      this.logAction('پاسخ استعلام قیمت', `شماره ${inq.inquiryNumber}`, `قیمت ${price.toLocaleString('fa-IR')} ت اعلام گردید.`);
    }
  },

  // --- Orders Management ---
  getOrders(): any[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.ORDERS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  updateOrderStatus(orderId: string, newStatus: any, trackingInfo?: string | { carrier?: string; trackingNumber?: string }): void {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx >= 0) {
      const order = orders[idx];
      const statusLabels: Record<string, string> = {
        registered: 'ثبت سفارش',
        processing: 'در حال آماده‌سازی در انبار',
        packing: 'بسته‌بندی در انبار',
        shipped: 'تحویل باربری و ارسال',
        delivered: 'تحویل مشتری گردید',
        cancelled: 'لغو سفارش',
        pending: 'در انتظار تأیید',
        confirmed: 'تأیید شده',
      };

      const trackingCode = typeof trackingInfo === 'string'
        ? trackingInfo
        : trackingInfo?.trackingNumber || order.trackingCode || `TRK-${Math.floor(100000 + Math.random() * 900000)}`;

      const carrier = typeof trackingInfo === 'object' ? trackingInfo.carrier : undefined;

      orders[idx] = {
        ...order,
        status: newStatus,
        trackingCode,
        ...(carrier ? { carrier } : {}),
      };

      try {
        persistPortalCache(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      } catch {
        // ignore
      }

      // Mock SMS
      const label = statusLabels[newStatus] || newStatus;
      this.sendMockSms(
        order.recipientPhone || '',
        `سفارش شما با شناسه ${order.orderNumber || order.id} به وضعیت «${label}» تغییر کرد. شرکت صنعت پیش یزد`
      );

      this.logAction('تغییر وضعیت سفارش', `شماره ${order.orderNumber || order.id}`, `وضعیت به «${label}» تغییر یافت.`);
    }
  },

  // --- Customers & CRM ---
  getCustomers(): Customer[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  saveCustomerNote(customerId: string, note: string): void {
    const customers = this.getCustomers();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx >= 0) {
      customers[idx] = {
        ...customers[idx],
        notes: note,
      } as any;
      try {
        persistPortalCache(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      } catch {
        // ignore
      }
      this.logAction('ثبت یادداشت CRM', `مشتری: ${customers[idx].fullName}`, note);
    }
  },

  // --- Agency Applications (Integrated with agencyService) ---
  getAgencyApplications(): AgencyApplication[] {
    return agencyService.getApplications();
  },

  // --- CMS Banners & Sliders ---
  getBanners(): BannerItem[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.BANNERS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return databaseStorageEnabled()?[]:INITIAL_BANNERS;
  },

  saveBanner(banner: BannerItem): void {
    const list = this.getBanners();
    const idx = list.findIndex(b => b.id === banner.id);
    if (idx >= 0) {
      list[idx] = banner;
    } else {
      list.push(banner);
    }
    try {
      persistPortalCache(STORAGE_KEYS.BANNERS, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.logAction('مدیریت بنر', banner.title, 'به‌روزرسانی بنر و اسلایدر صفحه اصلی');
  },

  deleteBanner(bannerId: string): void {
    const list = this.getBanners();
    const filtered = list.filter(b => b.id !== bannerId);
    try {
      persistPortalCache(STORAGE_KEYS.BANNERS, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },

  // --- Club Rules Config ---
  getClubConfig(): ClubConfig {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.CLUB_CONFIG);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    if(databaseStorageEnabled())throw new Error('تنظیمات باشگاه از دیتابیس دریافت نشده است.');
    return INITIAL_CLUB_CONFIG;
  },

  saveClubConfig(config: ClubConfig): void {
    try {
      persistPortalCache(STORAGE_KEYS.CLUB_CONFIG, JSON.stringify(config));
    } catch {
      // ignore
    }
    this.logAction('تنظیمات باشگاه مشتریان', 'قوانین امتیازدهی', 'قوانین امتیاز و نرخ تبدیل تخفیف به‌روزرسانی شد.');
  },

  // --- SMS Templates & Logs ---
  getSmsTemplates(): SmsTemplate[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.SMS_TEMPLATES);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return databaseStorageEnabled()?[]:INITIAL_SMS_TEMPLATES;
  },

  saveSmsTemplate(template: SmsTemplate): void {
    const list = this.getSmsTemplates();
    const idx = list.findIndex(t => t.id === template.id);
    if (idx >= 0) {
      list[idx] = template;
    } else {
      list.push(template);
    }
    try {
      persistPortalCache(STORAGE_KEYS.SMS_TEMPLATES, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.logAction('ویرایش قالب پیامک', template.title, 'قالب پیامکی ذخیره شد.');
  },

  sendMockSms(phone: string, text: string): void {
    const currentLogs = agencyService.getSmsLogs();
    agencyService.addSmsLog({
      recipientPhone: phone,
      template: 'custom',
      message: text,
    });
  },

  sendBulkSms(phones: string[], text: string): number {
    phones.forEach(p => {
      this.sendMockSms(p, text);
    });
    this.logAction('ارسال پیامک گروهی', `${phones.length} شماره`, text.slice(0, 40) + '...');
    return phones.length;
  },

  // --- Discounts Management ---
  getDiscounts(): DiscountCode[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.DISCOUNTS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return databaseStorageEnabled()?[]:MOCK_DISCOUNT_CODES;
  },

  saveDiscount(discount: DiscountCode): void {
    const list = this.getDiscounts();
    const idx = list.findIndex(d => d.code === discount.code);
    if (idx >= 0) {
      list[idx] = discount;
    } else {
      list.unshift(discount);
    }
    try {
      persistPortalCache(STORAGE_KEYS.DISCOUNTS, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.logAction('کد تخفیف', discount.code, `ثبت تخفیف ${discount.discountPercent}%`);
  },

  deleteDiscount(code: string): void {
    const list = this.getDiscounts();
    const filtered = list.filter(d => d.code !== code);
    try {
      persistPortalCache(STORAGE_KEYS.DISCOUNTS, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },

  // --- Categories CRUD ---
  getCategories(): Category[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.CATEGORIES);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return databaseStorageEnabled()?[]:CATEGORIES;
  },

  saveCategory(category: Category): void {
    const list = [...this.getCategories()];
    const idx = list.findIndex(c => c.id === category.id || c.slug === category.slug);
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...category };
    } else {
      list.push(category);
    }
    try {
      persistPortalCache(STORAGE_KEYS.CATEGORIES, JSON.stringify(list));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-categories-updated'));
        window.dispatchEvent(new CustomEvent('atlas-catalog-updated'));
      }
    } catch {
      // ignore
    }
    this.logAction('مدیریت دسته‌بندی', category.name, 'ذخیره و ویرایش مشخصات دسته‌بندی');
  },

  deleteCategory(slug: string): void {
    const list = this.getCategories();
    const filtered = list.filter(c => c.slug !== slug);
    try {
      persistPortalCache(STORAGE_KEYS.CATEGORIES, JSON.stringify(filtered));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-categories-updated'));
        window.dispatchEvent(new CustomEvent('atlas-catalog-updated'));
      }
    } catch {
      // ignore
    }
    this.logAction('حذف دسته‌بندی', slug, 'دسته‌بندی حذف شد');
  },

  // --- Brands CRUD ---
  getBrands(): Brand[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.BRANDS);
      if (stored) {
        const parsed: Brand[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(b => {
            const def = BRANDS.find(d => d.id === b.id);
            return {
              ...def,
              ...b,
              nameEn: b.nameEn || def?.nameEn || b.name,
              country: b.country || def?.country || 'ایران',
              isExclusive: b.isExclusive ?? def?.isExclusive ?? false,
              description: b.description || def?.description || '',
              image: b.image || b.logo || def?.image || def?.logo || '',
              logo: b.logo || b.image || def?.logo || def?.image || '',
              bannerImage: b.bannerImage || def?.bannerImage || '',
              active: b.active !== undefined ? b.active : true,
            };
          });
        }
      }
    } catch {
      // ignore
    }
    return databaseStorageEnabled()?[]:BRANDS;
  },

  saveBrand(brand: Brand): void {
    const list = [...this.getBrands()];
    const normalized: Brand = {
      ...brand,
      image: brand.image || brand.logo || '',
      logo: brand.logo || brand.image || '',
      active: brand.active !== undefined ? brand.active : true,
    };
    const idx = list.findIndex(b => b.id === normalized.id);
    if (idx >= 0) {
      list[idx] = normalized;
    } else {
      list.unshift(normalized);
    }
    try {
      persistPortalCache(STORAGE_KEYS.BRANDS, JSON.stringify(list));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-brands-updated'));
        window.dispatchEvent(new CustomEvent('atlas-catalog-updated'));
      }
    } catch {
      // ignore
    }
    this.logAction('مدیریت برند', normalized.name, 'ذخیره تصویر و مشخصات برند در سیستم');
  },

  deleteBrand(id: string): void {
    const list = this.getBrands();
    const filtered = list.filter(b => b.id !== id);
    try {
      persistPortalCache(STORAGE_KEYS.BRANDS, JSON.stringify(filtered));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-brands-updated'));
        window.dispatchEvent(new CustomEvent('atlas-catalog-updated'));
      }
    } catch {
      // ignore
    }
    this.logAction('حذف برند', id, 'برند از سیستم حذف شد');
  },

  // --- Active Dealers Management ---
  getActiveDealers(): (Representative & { creditLimit: number; seasonalTargetAchieved: number })[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.DEALERS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    const initial: (Representative & {creditLimit:number;seasonalTargetAchieved:number})[] = [];
    try {
      persistPortalCache(STORAGE_KEYS.DEALERS, JSON.stringify(initial));
    } catch {
      // ignore
    }
    return initial;
  },

  saveDealer(dealer: Representative & { creditLimit: number; seasonalTargetAchieved: number }): void {
    const list = this.getActiveDealers();
    const idx = list.findIndex(d => d.id === dealer.id);
    if (idx >= 0) {
      list[idx] = dealer;
    } else {
      list.push(dealer);
    }
    try {
      persistPortalCache(STORAGE_KEYS.DEALERS, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.logAction('مدیریت نماینده', dealer.name, `تنظیم سقف اعتبار ${dealer.creditLimit.toLocaleString('fa-IR')} ت`);
  },

  // --- Support Tickets Inbox ---
  getTickets(): any[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.TICKETS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    const initial: any[] = [];
    try {
      persistPortalCache(STORAGE_KEYS.TICKETS, JSON.stringify(initial));
    } catch {
      // ignore
    }
    return initial;
  },

  replyTicket(ticketId: string, replyText: string): void {
    const list = this.getTickets();
    const idx = list.findIndex(t => t.id === ticketId);
    if (idx >= 0) {
      const admin = this.getCurrentAdmin();
      const newMsg = {
        id: 'm-' + Date.now(),
        sender: 'support' as const,
        senderName: admin?.name || 'پشتیبانی فنی صنعت پیش',
        message: replyText,
        timestamp: new Date().toLocaleDateString('fa-IR') + ' - ' + new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      };
      const msgs = list[idx].messages || [];
      msgs.push(newMsg);
      list[idx] = {
        ...list[idx],
        status: 'answered',
        lastReplyAt: newMsg.timestamp,
        messages: msgs,
      };
      try {
        persistPortalCache(STORAGE_KEYS.TICKETS, JSON.stringify(list));
      } catch {
        // ignore
      }
      this.logAction('پاسخ به تیکت', list[idx].ticketNumber, replyText.slice(0, 40));
    }
  },

  // --- Blog & Static Pages ---
  getArticles(): BlogPost[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.BLOG);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    const initial: BlogPost[] = [
      {
        id: 'art-1',
        title: 'راهنمای جامع انتخاب تسمه‌های تایمینگ در خطوط تولید پرسرعت کاشی',
        slug: 'timing-belts-guide-tiles',
        category: 'آموزش فنی و مهندسی',
        author: 'مهندس مرتضوی',
        excerpt: 'بررسی تفاوت‌های گام‌های HTD، RPP و مقاومت کششی نخ‌های کولار و استیل در کوره‌های حرارتی.',
        content: 'تسمه‌های تایمینگ صنعتی از حساس‌ترین عناصر انتقال توان همگام در کارخانجات کاشی و سرامیک به شمار می‌روند...',
        imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&q=80',
        publishedAt: '۱۴۰۳/۰۶/۱۵',
        views: 1240,
      },
      {
        id: 'art-2',
        title: 'استانداردهای ضدسایش تسمه‌های انحصاری SWR آلمان و FORZA ایتالیا',
        slug: 'swr-forza-standards',
        category: 'اخبار و برندها',
        author: 'خانم دهقان',
        excerpt: 'چرا برندهای SWR و FORZA به انتخاب اول مهندسان تأسیسات صنعتی استان یزد و اصفهان تبدیل شده‌اند؟',
        content: 'ترکیبات پلیمری خاص و لایه‌های روکش پلی‌آمید و سیلیکون در تسمه‌های SWR سبب کاهش فرسایش تا ۴۰ درصد می‌گردد...',
        imageUrl: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&q=80',
        publishedAt: '۱۴۰۳/۰۶/۰۲',
        views: 980,
      },
    ];
    try {
      persistPortalCache(STORAGE_KEYS.BLOG, JSON.stringify(initial));
    } catch {
      // ignore
    }
    return initial;
  },

  saveArticle(article: BlogPost): void {
    const list = this.getArticles();
    const idx = list.findIndex(a => a.id === article.id);
    if (idx >= 0) {
      list[idx] = article;
    } else {
      list.unshift(article);
    }
    try {
      persistPortalCache(STORAGE_KEYS.BLOG, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.logAction('مدیریت وبلاگ', article.title, 'ذخیره مقاله در وبلاگ');
  },

  getBlogPosts(): BlogPost[] {
    return this.getArticles();
  },

  saveBlogPost(post: BlogPost): void {
    this.saveArticle(post);
  },

  deleteArticle(id: string): void {
    const list = this.getArticles();
    const filtered = list.filter(a => a.id !== id);
    try {
      persistPortalCache(STORAGE_KEYS.BLOG, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },

  getStaticPages(): StaticPage[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.PAGES);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    const initial: StaticPage[] = [
      {
        id: 'pg-about',
        slug: 'about-us',
        title: 'درباره بازرگانی تسمه اطلس',
        content: 'تأسیس سال ۱۳۶۶ در استان یزد با بیش از سه دهه تخصص در واردات، مهندسی و پخش تسمه‌های صنعتی، قطعات کوره کاشی و سرامیک و ماشین‌آلات نساجی.',
        lastUpdated: '۱۴۰۳/۰۶/۱۰',
      },
      {
        id: 'pg-contact',
        slug: 'contact-us',
        title: 'تماس با ما و دفاتر بازرگانی',
        content: 'برای هماهنگی مراجعه و ارتباط با صنعت پیش، صفحه تماس با ما را ببینید.',
        lastUpdated: '۱۴۰۳/۰۶/۱۵',
      },
      {
        id: 'pg-faq',
        slug: 'faq',
        title: 'سؤالات متداول کارخانجات و مشتریان',
        content: 'پاسخ به سؤالات درباره زمان تحویل سفارش‌های عمده، شرایط استعلام قیمت، اعتبارسنجی عاملیت و گارانتی اصالت کالا.',
        lastUpdated: '۱۴۰۳/۰۶/۰۵',
      },
    ];
    try {
      persistPortalCache(STORAGE_KEYS.PAGES, JSON.stringify(initial));
    } catch {
      // ignore
    }
    return initial;
  },

  saveStaticPage(page: StaticPage): void {
    const list = this.getStaticPages();
    const idx = list.findIndex(p => p.id === page.id);
    if (idx >= 0) {
      list[idx] = page;
    } else {
      list.push(page);
    }
    try {
      persistPortalCache(STORAGE_KEYS.PAGES, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.logAction('ویرایش صفحات ثابت', page.title, 'متن صفحه به‌روزرسانی شد');
  },

  // --- Campaigns Management ---
  getCampaigns(): CampaignItem[] {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.CAMPAIGNS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    const initial: CampaignItem[] = [
      {
        id: 'cmp-1',
        title: 'جشنواره پاییزه تأمین قطعات کارخانجات کاشی',
        description: '۵٪ تخفیف مازاد روی کلیه سفارش‌های تسمه کوره بالای ۵۰ میلیون تومان + ۲ برابر امتیاز باشگاه',
        rewardType: 'discount_code',
        rewardValue: 'کد AUTUMN-TILE',
        startDate: '۱۴۰۳/۰۶/۱۵',
        endDate: '۱۴۰۳/۰۷/۱۵',
        targetTier: 'all',
        active: true,
        participantsCount: 42,
      },
      {
        id: 'cmp-2',
        title: 'طرح ویژه اعضای طلایی: ارسال رایگان با باربری اختصاصی',
        description: 'ارسال رایگان تمام سفارش‌های بالای ۲۰ میلیون تومان برای اعضای دارای سطح طلایی VIP',
        rewardType: 'free_gift',
        rewardValue: 'حمل رایگان سراسری',
        startDate: '۱۴۰۳/۰۶/۰۱',
        endDate: '۱۴۰۳/۰۸/۳۰',
        targetTier: 'gold',
        active: true,
        participantsCount: 18,
      },
    ];
    try {
      persistPortalCache(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(initial));
    } catch {
      // ignore
    }
    return initial;
  },

  saveCampaign(campaign: CampaignItem): void {
    const list = this.getCampaigns();
    const idx = list.findIndex(c => c.id === campaign.id);
    if (idx >= 0) {
      list[idx] = campaign;
    } else {
      list.unshift(campaign);
    }
    try {
      persistPortalCache(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(list));
    } catch {
      // ignore
    }
    this.logAction('کمپین بازاریابی', campaign.title, 'ذخیره کمپین و تخفیف');
  },

  deleteCampaign(id: string): void {
    const list = this.getCampaigns();
    const filtered = list.filter(c => c.id !== id);
    try {
      persistPortalCache(STORAGE_KEYS.CAMPAIGNS, JSON.stringify(filtered));
    } catch {
      // ignore
    }
  },

  // --- General System Settings ---
  getSettings(): SystemSettings {
    try {
      const stored = durableStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    if(databaseStorageEnabled())throw new Error('تنظیمات سایت از دیتابیس دریافت نشده است.');
    const initial: SystemSettings = {
      paymentGateway: {
        provider: 'mellat',
        merchantId: '',
        terminalId: '',
        sandbox: true,
      },
      smsProvider: {
        provider: 'kavenegar',
        apiKey: '',
        senderNumber: '',
      },
      shippingMethods: {
        barbari: true,
        tipax: true,
        expressPost: true,
        dedicatedFleet: true,
      },
      currency: 'toman',
      seo: {
        metaTitle: 'صنعت پیش | پیش به صنعت - بازرگانی و ساخت قطعات صنعتی (تأسیس ۱۳۶۶)',
        metaDescription: 'سازنده و تأمین‌کننده مستقیم قطعات صنعتی، برندهای معتبر اطلس، FORZA و SWR با بیش از ۳۰,۰۰۰ قلم کالا و ارسال رایگان به سراسر کشور.',
        keywords: 'تسمه صنعتی, قطعات خطوط تولید, پولی و یاتاقان, SWR, FORZA, بازرگانی تسمه اطلس یزد, صنعت پیش',
        canonicalBase: 'https://sanatpish.ir',
      },
    };
    try {
      persistPortalCache(STORAGE_KEYS.SETTINGS, JSON.stringify(initial));
    } catch {
      // ignore
    }
    return initial;
  },

  saveSettings(settings: SystemSettings): void {
    try {
      persistPortalCache(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore
    }
    this.logAction('تنظیمات سامانه', 'پیکربندی عمومی', 'به‌روزرسانی درگاه، پیامک، روش‌های ارسال و متای سئو');
  },

  getAdminUsers(): AdminUser[] {
    return databaseStorageEnabled()?[]:INITIAL_ADMINS;
  },

  getOfficialInvoices(): OfficialInvoice[] {
    try {
      const stored = durableStorage.getItem('atlas_admin_official_invoices_v1');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  createOfficialInvoice(invoiceData: any): OfficialInvoice {
    const invoiceNumber = invoiceData.invoiceNumber || `INV-1403-${Math.floor(100 + Math.random() * 900)}`;
    const invoice: OfficialInvoice = {
      id: invoiceData.id || invoiceNumber,
      invoiceNumber,
      nationalTaxId: invoiceData.nationalTaxId || `TX-${Date.now()}`,
      issueDate: invoiceData.issueDate || new Date().toLocaleDateString('fa-IR'),
      validUntil: invoiceData.validUntil || '۷ روز کاری',
      seller: invoiceData.seller || {
        name: 'شرکت بازرگانی و تولیدی صنعت پیش اطلس یزد (سهامی خاص)',
        nationalId: '',
        economicCode: '',
        registrationNumber: '',
        address: '',
        postalCode: '',
        phone: '',
      },
      buyer: {
        name: invoiceData.buyer?.name || 'خریدار',
        companyName: invoiceData.buyer?.companyName || invoiceData.buyer?.company || 'سازمان خریدار',
        nationalId: invoiceData.buyer?.nationalId || '',
        economicCode: invoiceData.buyer?.economicCode || '',
        phone: invoiceData.buyer?.phone || '',
        address: invoiceData.buyer?.address || '',
        postalCode: invoiceData.buyer?.postalCode || '',
      },
      items: (invoiceData.items || []).map((item: any, idx: number) => ({
        row: idx + 1,
        productCode: item.productCode || item.code || `PRD-${idx + 1}`,
        productName: item.productName || item.name || 'کالای صنعتی',
        quantity: item.quantity || 1,
        unit: item.unit || 'عدد',
        unitPrice: item.unitPrice || 0,
        totalPrice: item.totalPrice || (item.unitPrice || 0) * (item.quantity || 1),
        discount: item.discount || 0,
        tax: item.tax || Math.round((item.totalPrice || 0) * 0.1),
        finalPrice: item.finalPrice || (item.totalPrice || 0) + Math.round((item.totalPrice || 0) * 0.1),
      })),
      subtotal: invoiceData.subtotal || 0,
      totalDiscount: invoiceData.discount || invoiceData.totalDiscount || 0,
      totalTax: invoiceData.tax || invoiceData.totalTax || 0,
      grandTotal: invoiceData.total || invoiceData.grandTotal || 0,
      paymentTerms: invoiceData.paymentTerms || 'نقد / اعتباری',
      status: invoiceData.status || 'issued',
    };
    const list = this.getOfficialInvoices();
    list.unshift(invoice);
    try {
      persistPortalCache('atlas_admin_official_invoices_v1', JSON.stringify(list));
    } catch {
      // ignore
    }
    this.logAction('صدور پیش‌فاکتور رسمی', invoice.invoiceNumber, `خریدار: ${invoice.buyer.companyName}`);
    return invoice;
  },

  saveInquiryReply(id: string, priceOrMap: any, validity?: any, terms?: any): void {
    const price = typeof priceOrMap === 'number' ? priceOrMap : (typeof priceOrMap === 'object' && priceOrMap ? Number(Object.values(priceOrMap)[0]) : 1000000);
    this.answerInquiry(id, Number(price) || 1000000, String(validity || '48 ساعت'));
    this.logAction('ثبت پاسخ استعلام', id, `قیمت: ${price} ت - اعتبار: ${terms || validity || '۴۸ ساعت'}`);
  },

  sendSms(to: string, template: any, params: any): void {
    const message = typeof params === 'string' ? params : `اطلاع‌رسانی سامانه صنعت پیش برای شماره ${to}`;
    const log: SmsLog = {
      id: 'sms-' + Date.now(),
      recipientPhone: to,
      template: 'custom',
      message: message,
      status: 'delivered',
      sentAt: new Date().toLocaleDateString('fa-IR'),
    };
    try {
      const logs = this.getSmsLogs();
      logs.unshift(log);
      persistPortalCache('atlas_admin_sms_logs_v1', JSON.stringify(logs));
    } catch {
      // ignore
    }
  },

  getSmsLogs(): SmsLog[] {
    try {
      const stored = durableStorage.getItem('atlas_admin_sms_logs_v1');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  verifyReceipt(orderId: string, approved: boolean, reason?: string): void {
    const orders = this.getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx >= 0) {
      orders[idx] = {
        ...orders[idx],
        status: approved ? 'processing' : 'pending',
        receiptVerified: approved,
      } as any;
      try {
        persistPortalCache(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
      } catch {
        // ignore
      }
      this.logAction('اعتبارسنجی فیش واریزی', orderId, approved ? 'فیش تأیید شد' : `فیش رد شد: ${reason}`);
    }
  },

  replyToTicket(ticketId: string, replyText: string, newStatus: SupportTicket['status'] = 'answered'): void {
    const tickets = this.getTickets();
    const idx = tickets.findIndex(t => t.id === ticketId);
    if (idx >= 0) {
      tickets[idx].status = newStatus;
      tickets[idx].messages.push({
        id: 'm-' + Date.now(),
        sender: 'admin',
        text: replyText,
        timestamp: new Date().toLocaleDateString('fa-IR'),
      });
      try {
        persistPortalCache(STORAGE_KEYS.TICKETS, JSON.stringify(tickets));
      } catch {
        // ignore
      }
      this.logAction('پاسخ به تیکت CRM', ticketId, replyText.slice(0, 40));
    }
  },

  updateCustomerTier(
    customerId: string,
    tier: any,
    creditLimit: number,
    discountPercent: number,
    extra?: {
      username?: string;
      phone?: string;
      password?: string;
      assignedPriceListCode?: string;
      clubTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
      totalPurchases?: number;
    }
  ): void {
    const customers = this.getCustomers();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx >= 0) {
      const updatedCust: Customer = {
        ...customers[idx],
        role: tier === 'dealer' ? 'dealer' : tier === 'colleague' || tier === 'factory' ? 'wholesale' : 'retail',
        tier: tier,
        clubTier:
          extra?.clubTier ||
          (tier === 'dealer' ? 'gold' : tier === 'colleague' || tier === 'factory' ? 'silver' : 'bronze'),
        assignedPriceListCode:
          extra?.assignedPriceListCode ||
          customers[idx].assignedPriceListCode ||
          (tier === 'dealer' ? 'A' : tier === 'factory' ? 'A' : 'B'),
        username: extra?.username?.trim() || customers[idx].username,
        phone: extra?.phone?.trim() || customers[idx].phone,
        mobile: extra?.phone?.trim() || customers[idx].phone,
        password: extra?.password?.trim() || customers[idx].password,
        totalPurchases:
          extra?.totalPurchases !== undefined
            ? extra.totalPurchases
            : customers[idx].totalPurchases || customers[idx].totalOrdersAmount || 0,
        totalOrdersAmount:
          extra?.totalPurchases !== undefined
            ? extra.totalPurchases
            : customers[idx].totalOrdersAmount || customers[idx].totalPurchases || 0,
        creditLimit,
        discountPercent,
        approvedB2B: tier !== 'regular',
        isLegacyCustomer: tier !== 'regular',
        onboardingCompleted: true,
      } as any;
      customers[idx] = updatedCust;
      try {
        persistPortalCache(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
        const storedStr = durableStorage.getItem('hyper_sanat_registered_users_v2');
        const registered: Customer[] = storedStr ? JSON.parse(storedStr) : [];
        const rIdx = registered.findIndex(r => r.id === customerId || r.phone === updatedCust.phone);
        if (rIdx >= 0) {
          registered[rIdx] = { ...registered[rIdx], ...updatedCust };
        } else {
          registered.unshift(updatedCust);
        }
        persistPortalCache('hyper_sanat_registered_users_v2', JSON.stringify(registered));

        const legRaw = durableStorage.getItem('atlas_legacy_customers_v1');
        const legacyList: Customer[] = legRaw ? JSON.parse(legRaw) : [];
        const lIdx = legacyList.findIndex(l => l.id === customerId || l.phone === updatedCust.phone);
        if (lIdx >= 0) {
          legacyList[lIdx] = { ...legacyList[lIdx], ...updatedCust };
        } else if (updatedCust.approvedB2B) {
          legacyList.unshift(updatedCust);
        }
        persistPortalCache('atlas_legacy_customers_v1', JSON.stringify(legacyList));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('atlas-pricing-updated'));
        }
      } catch {
        // ignore
      }
      this.logAction('تغییر سطح مشتری خرید بالا', customers[idx].fullName, `سطح: ${tier} - سقف: ${creditLimit}`);
    }
  },

  createB2bCustomer(payload: {
    fullName: string;
    companyName: string;
    username?: string;
    phone: string;
    password?: string;
    economicCode?: string;
    creditLimit?: number;
    totalPurchases?: number;
    assignedPriceListCode?: string;
    clubTier?: 'bronze' | 'silver' | 'gold' | 'platinum';
    role?: any;
    approvedB2B?: boolean;
  }): Customer {
    const customers = this.getCustomers();
    const cleanPhone = payload.phone.trim();
    const cleanUsername =
      (payload.username && payload.username.trim()) ||
      `vip_${cleanPhone.slice(-4)}`;
    const priceListCode = payload.assignedPriceListCode || 'B';
    const clubTier =
      payload.clubTier ||
      (priceListCode === 'D'
        ? 'platinum'
        : priceListCode === 'A'
        ? 'gold'
        : priceListCode === 'B'
        ? 'silver'
        : 'bronze');

    const newCust: Customer = {
      id: 'cust-b2b-' + Date.now().toString().slice(-6),
      name: payload.fullName,
      fullName: payload.fullName,
      companyName: payload.companyName,
      company: payload.companyName,
      username: cleanUsername,
      phone: cleanPhone,
      mobile: cleanPhone,
      password: payload.password || cleanPhone,
      economicCode: payload.economicCode || '',
      creditLimit: payload.creditLimit ?? 0,
      totalPurchases: payload.totalPurchases ?? 0,
      totalOrdersAmount: payload.totalPurchases ?? 0,
      assignedPriceListCode: priceListCode,
      role: payload.role || 'wholesale',
      tier: payload.role === 'factory' ? 'factory' : payload.role === 'dealer' ? 'dealer' : 'colleague',
      clubTier: clubTier === 'platinum' ? 'gold' : clubTier,
      clubPoints: 0,
      approvedB2B: payload.approvedB2B ?? true,
      isLegacyCustomer: true,
      onboardingCompleted: true,
      city: 'یزد',
      province: 'یزد',
      createdAt: new Date().toLocaleDateString('fa-IR'),
    };

    customers.unshift(newCust);
    try {
      persistPortalCache(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));

      const storedStr = durableStorage.getItem('hyper_sanat_registered_users_v2');
      const registered: Customer[] = storedStr ? JSON.parse(storedStr) : [];
      registered.unshift(newCust);
      persistPortalCache('hyper_sanat_registered_users_v2', JSON.stringify(registered));

      const legRaw = durableStorage.getItem('atlas_legacy_customers_v1');
      const legacyList: Customer[] = legRaw ? JSON.parse(legRaw) : [];
      legacyList.unshift(newCust);
      persistPortalCache('atlas_legacy_customers_v1', JSON.stringify(legacyList));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('atlas-pricing-updated'));
      }
    } catch {
      // ignore
    }

    this.logAction(
      'تعریف مشتری پنل خرید بالا (CRM)',
      payload.companyName,
      `مسئول: ${payload.fullName} | نام کاربری: ${cleanUsername} | شماره: ${cleanPhone}`
    );
    return newCust;
  },

  toggleB2bApproval(customerId: string): boolean {
    const customers = this.getCustomers();
    const idx = customers.findIndex(c => c.id === customerId);
    if (idx >= 0) {
      const current = Boolean(customers[idx].approvedB2B);
      customers[idx].approvedB2B = !current;
      try {
        persistPortalCache(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));

        const storedStr = durableStorage.getItem('hyper_sanat_registered_users_v2');
        const registered: Customer[] = storedStr ? JSON.parse(storedStr) : [];
        const rIdx = registered.findIndex((r: Customer) => r.id === customerId || r.phone === customers[idx].phone);
        if (rIdx >= 0) {
          registered[rIdx].approvedB2B = !current;
          persistPortalCache('hyper_sanat_registered_users_v2', JSON.stringify(registered));
        }
      } catch {}

      this.logAction('تغییر وضعیت تایید B2B', customers[idx].fullName, `وضعیت جدید: ${!current ? 'تاییدشده' : 'تعلیق‌یافته'}`);
      return !current;
    }
    return false;
  },

  getActiveAgencies(): ActiveAgency[] {
    try {
      const stored = durableStorage.getItem('atlas_admin_active_agencies_v1');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  saveActiveAgency(agency: ActiveAgency): void {
    const list = this.getActiveAgencies();
    const idx = list.findIndex(a => a.id === agency.id);
    if (idx >= 0) list[idx] = agency;
    else list.push(agency);
    try {
      persistPortalCache('atlas_admin_active_agencies_v1', JSON.stringify(list));
    } catch {
      // ignore
    }
  },

  approveAgency(appId: string, assignedCode: string, creditLimit: number, customPassword?: string): { username: string; password: string } | undefined {
    const res = agencyService.approveApplication(appId, {
      agencyCode: assignedCode,
      initialCreditLimit: creditLimit,
      password: customPassword,
    });
    if (!res) return undefined;

    const newActive: ActiveAgency = {
      id: 'ag-' + Date.now(),
      name: res.app.companyName,
      city: res.app.city,
      province: res.app.province,
      phone: res.app.phone,
      code: assignedCode,
      creditLimit: creditLimit,
      currentBalance: 0, // Zero Data
      nextCheckDate: 'تسویه ۳۰ روزه',
      contractStatus: 'valid',
    };
    this.saveActiveAgency(newActive);
    this.logAction('تأیید عاملیت و صدور پنل نمایندگی', appId, `کد: ${assignedCode} | سقف اعتبار: ${creditLimit} ت | پیامک رمز عبور ارسال شد`);

    return res.credentials;
  },

  rejectAgency(appId: string, reason: string): void {
    agencyService.rejectApplication(appId, reason);
    this.logAction('رد درخواست عاملیت', appId, reason);
  },

  getSupplyRequests(): SupplyRequestItem[] {
    try {
      const stored = durableStorage.getItem('atlas_admin_supply_reqs_v1');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return [];
  },

  updateSupplyRequestStatus(id: string, status: SupplyRequestItem['status']): void {
    const list = this.getSupplyRequests();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx].status = status;
      try {
        persistPortalCache('atlas_admin_supply_reqs_v1', JSON.stringify(list));
      } catch {
        // ignore
      }
      this.logAction('تغییر وضعیت حواله تأمین', id, `وضعیت: ${status}`);
    }
  },

  getClubMembers(): ClubMember[] {
    return this.getCustomers().map(customer=>({id:customer.id,name:customer.companyName||customer.fullName,phone:customer.phone,points:customer.clubPoints||0,level:customer.clubTier||'',joinedAt:customer.createdAt||''}));
  },

  getRewardRequests(): RewardRequestItem[] {
    return [];
  },

  updateRewardStatus(id: string, status: RewardRequestItem['status']): void {
    this.logAction('بررسی جایزه باشگاه', id, `وضعیت: ${status}`);
  },

  deleteBlogPost(id: string): void {
    const posts = this.getBlogPosts().filter(p => p.id !== id);
    try {
      persistPortalCache(STORAGE_KEYS.BLOG, JSON.stringify(posts));
    } catch {
      // ignore
    }
    this.logAction('حذف مقاله وبلاگ', id, 'مقاله از کاتالوگ حذف گردید');
  },

  exportBackupJson(): string {
    const fullBackup = {
      timestamp: new Date().toISOString(),
      products: this.getProducts(),
      categories: this.getCategories(),
      brands: this.getBrands(),
      orders: this.getOrders(),
      inquiries: this.getInquiries(),
      customers: this.getCustomers(),
      agencies: this.getActiveAgencies(),
      auditLogs: this.getAuditLogs(),
      settings: this.getSettings(),
    };
    return JSON.stringify(fullBackup, null, 2);
  },

  resetToInitial(): void {
    Object.values(STORAGE_KEYS).forEach(k => {
      try {
        durableStorage.removeItem(k);
      } catch {
        // ignore
      }
    });
    this.logAction('بازنشانی سیستم', 'تمام پایگاه داده', 'سامانه به داده‌های اولیه ریست شد.');
  },
};
