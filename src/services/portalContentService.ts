import {durableStorage,databaseStorageEnabled} from "./durableStorage";
import { persistPortalCache } from "./portalRepository";
import { Customer } from "../types";

export type PortalTargetType = "consumer" | "high_volume";
export type AnnouncementPortalType = "storefront" | "consumer" | "high_volume";
export type ContentScopeType = "collective" | "individual" | "selected";
export type BannerThemeType =
  | "industrial_orange"
  | "royal_gold"
  | "emerald_trust"
  | "titanium_blue"
  | "ruby_crimson";

export interface PortalBannerItem {
  id: string;
  portal: PortalTargetType; // 'consumer' (/consumer-dashboard) | 'high_volume' (/account)
  scope: ContentScopeType; // 'collective' (همه مشتریان پنل) | 'individual' (مشتری خاص)
  targetCustomerId?: string; // در حالت تکی: شناسه مشتری
  targetCustomerName?: string;
  targetTierCode?: string; // اختیاری برای پنل خرید بالا: 'ALL' | 'C' | 'B' | 'A' | 'D'
  badgeText: string;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLinkOrTab: string; // e.g. 'orders', 'quick_buy', 'club_rewards', '/products'
  theme: BannerThemeType;
  backgroundImage?: string;
  // قانون تخفیف حجمی سبد خرید (اختیاری)
  minCartVolume?: number; // مثلاً 50000000 تومان
  cartDiscountPercent?: number; // مثلاً 5 درصد تخفیف روی کل سبد خرید
  promoCode?: string;
  active: boolean;
  createdAt: string;
}

export interface PortalAnnouncementItem {
  id: string;
  portal: AnnouncementPortalType; // 'storefront' (وب‌سایت عمومی) | 'consumer' (پنل خرده‌فروش) | 'high_volume' (پنل خرید بالا)
  scope: ContentScopeType; // 'collective' (همه) | 'individual' / 'selected' (مشتریان انتخاب‌شده)
  targetCustomerId?: string;
  targetCustomerName?: string;
  targetCustomerIds?: string[];
  targetCustomerNames?: string[];
  targetTierCode?: string;
  title: string;
  body: string;
  tag: string;
  priority?: "normal" | "important" | "urgent";
  pinned?: boolean;
  highlightValue?: string;
  actionLabel?: string;
  actionTab?: string;
  actionLink?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  expiresAt?: string | null;
  showEndTimeToCustomer?: boolean;
  archived?: boolean;
  archivedAt?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface ClubTierMilestoneConfig {
  code: "C" | "B" | "A" | "D";
  tierKey: "bronze" | "silver" | "gold" | "diamond";
  publicTitle: string; // نامی که مشتری می‌بیند: سطح برنزی، نقره‌ای، طلایی، الماس
  minPurchaseVolume: number; // حجم خرید لازم (تومان)
  discountPercent: number; // درصد تخفیف پایه
  barColor: string;
  badgeColor: string;
  summaryBenefit: string;
  rewardsList: string[]; // جوایز و اتفاق‌هایی که با رسیدن به این سطح دریافت می‌کنند
  specialEvents: string[]; // اتفاقات و مزایای ویژه این سطح
}

export interface PortalMenuItemConfig {
  id: string;
  label: string;
  enabled: boolean;
  order: number;
  badgeText?: string;
}

export interface PortalPermissionsConfig {
  showKpi1: boolean;
  showKpi2: boolean;
  showKpi3: boolean;
  showKpi4: boolean;
  showAnnouncements: boolean;
  allowExcelPriceListDownload: boolean; // دانلود اکسل لیست قیمت من در بخش سفارشات
  showClubBarChart: boolean; // نمایش نمودار میله‌ای باشگاه مشتریان
  allowQuickSkuOrder: boolean; // ثبت سفارش سریع با کد فنی
  showCreditLimitCard: boolean; // نمایش کادر سقف خرید
  allowQuickReorder: boolean; // دکمه تکرار سفارش قبلی
  allowInvoicePrint: boolean; // چاپ و مشاهده فاکتور
  showPromotionalBanners: boolean; // نمایش جایگاه بنرها
}

export interface PortalUiTextsConfig {
  heroWelcomePrefix: string;
  heroSubtitle: string;
  primaryCtaLabel: string;
  excelDownloadButtonLabel: string; // پیش‌فرض: «دانلود اکسل لیست قیمت من»
  clubChartTitle: string;
  clubChartSubtitle: string;
  clubDetailsButtonLabel: string; // دکمه زیر نمودار میله‌ای
  ordersSectionTitle: string;
  priceListSectionTitle: string;
  kpi1Title: string;
  kpi2Title: string;
  kpi3Title: string;
  kpi4Title: string;
  headerAccentTheme:
    "navy_orange" | "charcoal_gold" | "slate_emerald" | "deep_royal";
}

export interface PortalAppearanceConfig {
  glass: "subtle" | "solid";
  density: "comfortable" | "compact";
}

export interface PortalLayoutConfig {
  appearance?: PortalAppearanceConfig;
  portal: PortalTargetType;
  labels?: Record<string, string>;
  menus: PortalMenuItemConfig[];
  permissions: PortalPermissionsConfig;
  uiTexts: PortalUiTextsConfig;
}

export interface CustomerIndividualOverride {
  customerId: string;
  customerName: string;
  portal: PortalTargetType;
  customWelcomeTitle?: string;
  customWelcomeSubtitle?: string;
  customCartDiscountRule?: {
    minVolume: number;
    discountPercent: number;
    description: string;
  };
  appearanceOverride?: PortalAppearanceConfig;
  permissionsOverride?: Partial<PortalPermissionsConfig>;
  disabledMenuIds?: string[];
  menus?: PortalMenuItemConfig[];
  uiTextsOverride?: Partial<PortalUiTextsConfig>;
  labelsOverride?: Record<string, string>;
  updatedAt: string;
}

const STORAGE_KEYS = {
  BANNERS: "atlas_portal_content_banners_v1",
  ANNOUNCEMENTS: "atlas_portal_content_announcements_v1",
  CLUB_MILESTONES: "atlas_portal_club_milestones_v1",
  PORTAL_CONFIGS: "atlas_portal_layout_configs_v1",
  CUSTOMER_OVERRIDES: "atlas_portal_customer_overrides_v1",
};

export const DEFAULT_CLUB_MILESTONES: ClubTierMilestoneConfig[] = [
  {
    code: "C",
    tierKey: "bronze",
    publicTitle: "سطح برنزی",
    minPurchaseVolume: 80000000,
    discountPercent: 5,
    barColor: "from-amber-700 to-amber-500",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
    summaryBenefit:
      "فعالسازی لیست قیمت همکاری + ۵٪ تخفیف پایه و اولویت پردازش انبار",
    rewardsList: [
      "۵٪ تخفیف مستقیم روی تمامی اقلام لیست قیمت من",
      "ارسال رایگان برای سفارش‌های بالای ۳۰ میلیون تومان از انبار مرکزی",
      "بسته‌بندی صنعتی تقویت‌شده رایگان جهت حمل باربری",
    ],
    specialEvents: [
      "دریافت فایل اکسل لیست قیمت به‌روزرسانی‌شده در بخش سفارشات",
      "مشاوره فنی رایگان انتخاب تسمه و قطعات جایگزین",
    ],
  },
  {
    code: "B",
    tierKey: "silver",
    publicTitle: "سطح نقره‌ای",
    minPurchaseVolume: 250000000,
    discountPercent: 10,
    barColor: "from-slate-500 to-slate-400",
    badgeColor: "bg-slate-200 text-slate-900 border-slate-400",
    summaryBenefit:
      "۱۰٪ تخفیف لیست قیمت + ۳٪ تخفیف مازاد سبد خرید و سهمیه کالای کمیاب",
    rewardsList: [
      "۱۰٪ تخفیف مستقیم روی تمامی کدهای کالا در لیست قیمت من",
      "۳٪ تخفیف تشویقی مازاد روی کل سبد خرید برای سفارش‌های بالای ۵۰ میلیون تومان",
      "پک هدیه ابزار دقیق و کاتالوگ فنی مهندسی SWR و FORZA",
    ],
    specialEvents: [
      "تخصیص کارشناس فروش مستقیم جهت پیگیری لحظه‌ای بارنامه‌ها",
      "امکان رزرو موجودی انبار تا ۷۲ ساعت پیش از تسویه نهایی",
    ],
  },
  {
    code: "A",
    tierKey: "gold",
    publicTitle: "سطح طلایی",
    minPurchaseVolume: 500000000,
    discountPercent: 16,
    barColor: "from-amber-500 to-yellow-400",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-400",
    summaryBenefit: "۱۶٪ تخفیف ویژه + ارسال رایگان سراسری و پاداش نقدی فصلی",
    rewardsList: [
      "۱۶٪ تخفیف تجاری مستقیم در لیست قیمت من",
      "ارسال رایگان اکسپرس و بیمه کامل محموله به سراسر کشور",
      "پاداش اعتبار خرید ۱۵ میلیون تومانی در پایان هر فصل",
      "۵٪ تخفیف مازاد روی کل سبد خرید در سفارش‌های بالای ۱۰۰ میلیون تومان",
    ],
    specialEvents: [
      "اولویت اول تأمین قطعات اورجینال وارداتی در زمان کمبود بازار",
      "بازدید دوره‌ای رایگان تیم فنی از خطوط تولید و بررسی سلامت تسمه‌ها",
    ],
  },
  {
    code: "D",
    tierKey: "diamond",
    publicTitle: "سطح الماس (VIP)",
    minPurchaseVolume: 1200000000,
    discountPercent: 22,
    barColor: "from-indigo-600 via-sky-500 to-emerald-400",
    badgeColor: "bg-indigo-100 text-indigo-950 border-indigo-300",
    summaryBenefit:
      "بالاترین سطح مزایا: ۲۲٪ تخفیف، تامین اختصاصی و شرایط تسویه ویژه",
    rewardsList: [
      "۲۲٪ تخفیف حداکثری روی تمام محصولات و قطعات کاتالوگ",
      "تخصیص اعتبار خرید و شرایط تسویه توافقی بلندمدت",
      "پاداش ویژه سالانه ۴۰ میلیون تومانی اعتبار خرید کالا",
      "۷٪ تخفیف مازاد روی کل سبد خرید برای سفارش‌های پروژه‌ای",
    ],
    specialEvents: [
      "تأمین و واردات سفارشی قطعات خاص خطوط تولید بدون کارمزد بازرگانی",
      "خط مستقیم مدیریت بازرگانی و تضمین قیمت ثابت فصلی",
    ],
  },
];

export const DEFAULT_CONSUMER_CLUB_MILESTONES: ClubTierMilestoneConfig[] =
  DEFAULT_CLUB_MILESTONES.map((m, index) => ({
    ...m,
    publicTitle: ["همراه", "نقره‌ای", "طلایی", "پلاتینیوم"][index],
    minPurchaseVolume: [0, 10000000, 50000000, 100000000][index],
    discountPercent: 0,
    summaryBenefit: "",
    rewardsList: [],
    specialEvents: [],
  }));

export const DEFAULT_BANNERS: PortalBannerItem[] = [
  ...(["consumer", "high_volume"] as const).map((portal) => ({
    id: `bnr-discover-${portal}`,
    portal,
    scope: "collective" as const,
    badgeText: "برای ادامه تولید",
    title: "قطعه مناسب، با انتخاب دقیق‌تر",
    subtitle:
      "کدها، سایزها و مشخصات قطعات را ببینید؛ برای انتخاب همراه شما هستیم.",
    ctaText: "جستجو در محصولات",
    ctaLinkOrTab: "/products",
    theme: "industrial_orange" as const,
    backgroundImage: "",
    active: true,
    createdAt: "",
  })),
  {
    id: "bnr-consumer-1",
    portal: "consumer",
    scope: "collective",
    badgeText: "پیشنهاد ویژه سبد خرید",
    title:
      "با خرید بالای ۱۵ میلیون تومان، ۴٪ تخفیف مستقیم به کل سبد خرید شما اضافه می‌شود",
    subtitle:
      "تمامی سفارش‌های ثبت‌شده در پنل کاربری شما با ضمانت اصالت ۱۰۰٪ و ارسال مستقیم از انبار مرکزی پردازش می‌گردند.",
    ctaText: "ثبت سفارش سریع و بهره‌مندی از تخفیف",
    ctaLinkOrTab: "quick_buy",
    theme: "industrial_orange",
    minCartVolume: 15000000,
    cartDiscountPercent: 4,
    promoCode: "ATLAS-4",
    active: false,
    createdAt: "۱۴۰۳/۰۷/۱۸",
  },
  {
    id: "bnr-highvol-1",
    portal: "high_volume",
    scope: "collective",
    targetTierCode: "ALL",
    badgeText: "طرح تشویقی خریدهای حجمی",
    title:
      "در سفارش‌های بالای ۱۰۰ میلیون تومان، ۵٪ تخفیف مازاد روی کل سبد خرید شما اعمال می‌گردد",
    subtitle:
      "علاوه بر قیمت‌های ثبت‌شده در «لیست قیمت من»، این تخفیف تشویقی به صورت خودکار در فاکتور شما کسر شده و امتیاز حجم خرید شما در باشگاه مشتریان ثبت می‌شود.",
    ctaText: "مشاهده لیست قیمت من و ثبت سفارش",
    ctaLinkOrTab: "orders_pricelist",
    theme: "royal_gold",
    minCartVolume: 100000000,
    cartDiscountPercent: 5,
    promoCode: "VIP-BULK5",
    active: false,
    createdAt: "۱۴۰۳/۰۷/۱۸",
  },
];

export const DEFAULT_ANNOUNCEMENTS: PortalAnnouncementItem[] = [
  {
    id: "ann-storefront-1",
    portal: "storefront",
    scope: "collective",
    title: "تأمین مستقیم تسمه‌های صنعتی SWR و قطعات انتقال قدرت FORZA",
    body: "ارسال مستقیم از انبار مرکزی صنعت پیش به سراسر کشور همراه با ضمانت اصالت فنی و مشاوره مهندسی رایگان.",
    tag: "اطلاعیه عمومی",
    priority: "important",
    pinned: true,
    highlightValue: "ارسال سراسری",
    actionLabel: "مشاهده کاتالوگ قطعات",
    actionLink: "/products",
    showEndTimeToCustomer: false,
    archived: false,
    active: true,
    createdAt: "2026-10-18T08:00:00.000Z",
  },
  {
    id: "ann-consumer-1",
    portal: "consumer",
    scope: "collective",
    title: "شارژ مجدد تسمه‌های انتقال قدرت SWR و FORZA با قیمت جدید",
    body: "موجودی سایزهای پرمصرف صنعتی در انبار مرکزی تکمیل شد و آماده ارسال فوری به آدرس منتخب شماست.",
    tag: "اطلاعیه موجودی",
    priority: "normal",
    highlightValue: "ارسال ۲۴ ساعته",
    actionLabel: "مشاهده کالاها",
    actionTab: "quick_buy",
    showEndTimeToCustomer: true,
    archived: false,
    active: true,
    createdAt: "2026-10-19T09:30:00.000Z",
  },
  {
    id: "ann-highvol-1",
    portal: "high_volume",
    scope: "collective",
    title: "به‌روزرسانی فایل «اکسل لیست قیمت من» ویژه مشتریان خرید بالا",
    body: "جدول قیمت کدهای کالا به‌روزرسانی گردید. هم‌اکنون می‌توانید نسخه جدید اکسل لیست قیمت من را از بخش سفارشات دانلود نمایید.",
    tag: "بروزرسانی لیست قیمت",
    priority: "important",
    highlightValue: "آماده دانلود (.xlsx)",
    actionLabel: "بخش سفارشات و لیست قیمت من",
    actionTab: "orders_pricelist",
    showEndTimeToCustomer: false,
    archived: false,
    active: true,
    createdAt: "2026-10-20T10:00:00.000Z",
  },
];

export const DEFAULT_PORTAL_CONFIGS: Record<PortalTargetType, PortalLayoutConfig> = {
  consumer: {
    portal: "consumer",
    menus: [
      {
        id: "saved_products",
        label: "محصولات نشان‌شده",
        enabled: true,
        order: 6,
      },
      {
        id: "purchase_list",
        label: "لیست خرید چندکدی",
        enabled: true,
        order: 7,
      },
      { id: "overview", label: "پیشخوان کاربری", enabled: true, order: 1 },
      {
        id: "orders",
        label: "سفارشات و رهگیری مرسوله",
        enabled: true,
        order: 2,
      },
      { id: "quick_buy", label: "ثبت سفارش سریع", enabled: true, order: 3 },
      {
        id: "club_rewards",
        label: "باشگاه مشتریان",
        enabled: true,
        order: 2.5,
      },
      { id: "receipts", label: "فاکتورها و رسیدها", enabled: true, order: 4 },
      {
        id: "addresses",
        label: "آدرس‌ها و اطلاعات تحویل",
        enabled: true,
        order: 5,
      },
    ],
    permissions: {
      showKpi1: true,
      showKpi2: true,
      showKpi3: true,
      showKpi4: true,
      showAnnouncements: true,
      allowExcelPriceListDownload: true,
      showClubBarChart: true,
      allowQuickSkuOrder: true,
      showCreditLimitCard: false,
      allowQuickReorder: true,
      allowInvoicePrint: true,
      showPromotionalBanners: true,
    },
    uiTexts: {
      heroWelcomePrefix: "حساب خرید شما",
      heroSubtitle:
        "سفارش‌ها، فاکتورها و آدرس‌های خود را از اینجا مدیریت کنید.",
      primaryCtaLabel: "مشاهده کاتالوگ محصولات",
      excelDownloadButtonLabel: "دانلود اکسل لیست قیمت من",
      clubChartTitle: "مسیر رشد شما",
      clubChartSubtitle: "با خریدهای ثبت‌شده، به مزایای بیشتری دست پیدا کنید.",
      clubDetailsButtonLabel: "مشاهده مزایا",
      ordersSectionTitle: "سفارشات من و رهگیری مرسولات",
      priceListSectionTitle: "ثبت سفارش سریع قطعات",
      kpi1Title: "وضعیت حساب کاربری",
      kpi2Title: "سفارشات ثبت‌شده",
      kpi3Title: "مجموع خریدهای من",
      kpi4Title: "پشتیبانی و ضمانت اصالت",
      headerAccentTheme: "navy_orange",
    },
  },
  high_volume: {
    portal: "high_volume",
    menus: [
      {
        id: "saved_products",
        label: "محصولات نشان‌شده",
        enabled: true,
        order: 6,
      },
      {
        id: "purchase_list",
        label: "لیست خرید چندکدی",
        enabled: true,
        order: 7,
      },
      {
        id: "overview",
        label: "پیشخوان و وضعیت حساب",
        enabled: true,
        order: 1,
      },
      {
        id: "orders_pricelist",
        label: "سفارشات و لیست قیمت من",
        enabled: true,
        order: 2,
      },
      {
        id: "club_rewards",
        label: "باشگاه مشتریان و جوایز",
        enabled: true,
        order: 3,
      },
      {
        id: "profile_addresses",
        label: "مشخصات و آدرس‌های تحویل",
        enabled: true,
        order: 4,
      },
    ],
    permissions: {
      showKpi1: true,
      showKpi2: true,
      showKpi3: true,
      showKpi4: true,
      showAnnouncements: true,
      allowExcelPriceListDownload: true,
      showClubBarChart: true,
      allowQuickSkuOrder: true,
      showCreditLimitCard: true,
      allowQuickReorder: true,
      allowInvoicePrint: true,
      showPromotionalBanners: true,
    },
    uiTexts: {
      heroWelcomePrefix: "پنل مدیریت سفارشات و باشگاه مشتریان",
      heroSubtitle:
        "دسترسی مستقیم به لیست قیمت من، ثبت سفارش سریع بر اساس کد فنی کالا، پیگیری مرسولات و مشاهده نمودار پیشرفت و جوایز باشگاه مشتریان.",
      primaryCtaLabel: "ثبت سفارش جدید",
      excelDownloadButtonLabel: "دانلود اکسل لیست قیمت من",
      clubChartTitle: "نمودار حجم خرید و مراحل ارتقای سطح باشگاه مشتریان",
      clubChartSubtitle:
        "بر اساس مجموع خریدهای ثبت‌شده، جایگاه فعلی شما و میزان خرید باقی‌مانده تا سطح بعدی و جوایز آن مشخص شده است.",
      clubDetailsButtonLabel:
        "مشاهده جوایز، مزایا و برنامه کامل باشگاه مشتریان",
      ordersSectionTitle: "سفارشات و لیست قیمت من",
      priceListSectionTitle: "جدول کامل «لیست قیمت من» و ثبت سریع در سفارش",
      kpi1Title: "سطح فعلی باشگاه مشتریان",
      kpi2Title: "حجم کل خرید ثبت‌شده",
      kpi3Title: "سقف خرید اعتباری فعال",
      kpi4Title: "جوایز و مشوق‌های فعال من",
      headerAccentTheme: "charcoal_gold",
    },
  },
};

function emitPortalContentUpdate() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("atlas-portal-content-updated"));
  }
}

export const portalContentService = {
  subscribe(listener: () => void): () => void {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("atlas-portal-content-updated", listener);
    return () => {
      window.removeEventListener("atlas-portal-content-updated", listener);
    };
  },
  getCartDiscountPercent(user: Customer | null, subtotal: number): number {
    if (!user || !Number.isFinite(subtotal) || subtotal <= 0) return 0;
    const portal = this.isHighVolumeCustomer(user) ? "high_volume" : "consumer";
    const banners = this.getBannersForCustomer(
      portal,
      user.id,
      user.assignedPriceListCode,
    );
    const rules = banners.map((b) => ({
      minimum: b.minCartVolume,
      percent: b.cartDiscountPercent,
    }));
    const custom = this.getCustomerOverride(
      user.id,
      portal,
    )?.customCartDiscountRule;
    if (custom)
      rules.push({
        minimum: custom.minVolume,
        percent: custom.discountPercent,
      });
    // Use the strongest eligible campaign; campaigns never stack with one another.
    return rules.reduce(
      (best, rule) =>
        Number.isFinite(rule.minimum) &&
        Number.isFinite(rule.percent) &&
        rule.minimum! > 0 &&
        subtotal >= rule.minimum! &&
        rule.percent! >= 0 &&
        rule.percent! <= 100
          ? Math.max(best, rule.percent!)
          : best,
      0,
    );
  },
  /**
   * تشخیص اینکه آیا کاربر متعلق به پنل خرید بالا (/account) است یا پنل مشتریان (/consumer-dashboard)
   */
  isHighVolumeCustomer(user: Customer | null | undefined): boolean {
    if (!user) return false;
    if (user.approvedB2B === true) return true;
    return false;
  },

  // --- BANNERS (طراحی بنر جمعی و تکی برای هر دو پنل) ---
  getBanners(): PortalBannerItem[] {
    try {
      const raw = durableStorage.getItem(STORAGE_KEYS.BANNERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return databaseStorageEnabled()?[]:DEFAULT_BANNERS;
  },

  getBannersForCustomer(
    portal: PortalTargetType,
    customerId?: string,
    tierCode?: string,
  ): PortalBannerItem[] {
    const all = this.getBanners().filter(
      (b) => b.portal === portal && b.active,
    );
    return all.filter((b) => {
      if (b.scope === "individual") {
        return Boolean(customerId && b.targetCustomerId === customerId);
      }
      // collective
      if (
        portal === "high_volume" &&
        b.targetTierCode &&
        b.targetTierCode !== "ALL" &&
        b.targetTierCode
      ) {
        return b.targetTierCode === tierCode;
      }
      return true;
    });
  },

  saveBanner(banner: PortalBannerItem): PortalBannerItem[] {
    const list = [...this.getBanners()];
    const idx = list.findIndex((b) => b.id === banner.id);
    if (idx >= 0) {
      list[idx] = banner;
    } else {
      list.unshift(banner);
    }
    try {
      persistPortalCache(STORAGE_KEYS.BANNERS, JSON.stringify(list));
    } catch {}
    emitPortalContentUpdate();
    return list;
  },

  deleteBanner(bannerId: string): PortalBannerItem[] {
    const list = this.getBanners().filter((b) => b.id !== bannerId);
    try {
      persistPortalCache(STORAGE_KEYS.BANNERS, JSON.stringify(list));
    } catch {}
    emitPortalContentUpdate();
    return list;
  },

  // --- ANNOUNCEMENTS & CONTENT CARDS (اطلاعیه‌های ۳ سطحی: وب‌سایت، خرده‌فروشی، خرید بالا + زمان‌بندی و بایگانی خودکار) ---
  getAnnouncementLifecycleStatus(
    item: PortalAnnouncementItem,
    now = Date.now(),
  ): "active" | "scheduled" | "archived" | "inactive" {
    if (item.archived === true) return "archived";
    const endIso = item.endsAt || item.expiresAt || null;
    if (endIso) {
      const endMs = Date.parse(endIso);
      if (Number.isFinite(endMs) && endMs <= now) {
        return "archived";
      }
    }
    if (!item.active) return "inactive";
    if (item.startsAt) {
      const startMs = Date.parse(item.startsAt);
      if (Number.isFinite(startMs) && startMs > now) {
        return "scheduled";
      }
    }
    return "active";
  },

  getAnnouncements(): PortalAnnouncementItem[] {
    let items: PortalAnnouncementItem[] = [];
    try {
      const raw = durableStorage.getItem(STORAGE_KEYS.ANNOUNCEMENTS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) items = parsed;
      } else {
        items = databaseStorageEnabled() ? [] : DEFAULT_ANNOUNCEMENTS;
      }
    } catch {
      items = databaseStorageEnabled() ? [] : DEFAULT_ANNOUNCEMENTS;
    }

    const now = Date.now();
    return items.map((item) => {
      const endIso = item.endsAt || item.expiresAt || null;
      if (!item.archived && endIso) {
        const endMs = Date.parse(endIso);
        if (Number.isFinite(endMs) && endMs <= now) {
          return {
            ...item,
            archived: true,
            archivedAt: item.archivedAt || endIso,
          };
        }
      }
      return item;
    });
  },

  syncExpiredAnnouncementsToArchive(): PortalAnnouncementItem[] {
    const now = Date.now();
    let changed = false;
    const list = this.getAnnouncements().map((item) => {
      const endIso = item.endsAt || item.expiresAt || null;
      if (endIso) {
        const endMs = Date.parse(endIso);
        if (Number.isFinite(endMs) && endMs <= now && (!item.archived || item.active)) {
          changed = true;
          return {
            ...item,
            archived: true,
            active: false,
            archivedAt: item.archivedAt || endIso,
          };
        }
      }
      return item;
    });
    if (changed) {
      try {
        persistPortalCache(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
      } catch {}
      emitPortalContentUpdate();
    }
    return list;
  },

  matchesAnnouncementCustomer(
    item: PortalAnnouncementItem,
    customerId?: string,
  ): boolean {
    if (!item.scope || item.scope === "collective") return true;
    if (!customerId) return false;
    if (item.targetCustomerId && item.targetCustomerId === customerId) return true;
    if (
      Array.isArray(item.targetCustomerIds) &&
      item.targetCustomerIds.includes(customerId)
    ) {
      return true;
    }
    return false;
  },

  getAnnouncementsForCustomer(
    portal: AnnouncementPortalType,
    customerId?: string,
    tierCode?: string,
  ): PortalAnnouncementItem[] {
    const now = Date.now();
    return this.getAnnouncements().filter((a) => {
      if (a.portal !== portal) return false;
      if (this.getAnnouncementLifecycleStatus(a, now) !== "active") return false;
      if (portal === "storefront") {
        return !a.scope || a.scope === "collective";
      }
      if (!this.matchesAnnouncementCustomer(a, customerId)) return false;
      if (
        portal === "high_volume" &&
        a.targetTierCode &&
        a.targetTierCode !== "ALL" &&
        tierCode
      ) {
        return a.targetTierCode === tierCode;
      }
      return true;
    });
  },

  getStorefrontAndUserAnnouncements(
    userOrOptions?:
      | Customer
      | {
          userId?: string | null;
          portal?: PortalTargetType | null;
          tierCode?: string | null;
        }
      | null,
  ): PortalAnnouncementItem[] {
    const storefrontList = this.getAnnouncementsForCustomer("storefront");
    if (!userOrOptions) {
      return storefrontList;
    }

    let userId: string | undefined;
    let userPortal: PortalTargetType | null = null;
    let tierCode: string | undefined;

    if ("id" in userOrOptions && typeof userOrOptions.id === "string") {
      userId = userOrOptions.id;
      userPortal = this.isHighVolumeCustomer(userOrOptions)
        ? "high_volume"
        : "consumer";
      tierCode = userOrOptions.assignedPriceListCode;
    } else if ("userId" in userOrOptions || "portal" in userOrOptions) {
      userId = userOrOptions.userId || undefined;
      userPortal = userOrOptions.portal || null;
      tierCode = userOrOptions.tierCode || undefined;
    }

    if (!userPortal) {
      return storefrontList;
    }

    const portalList = this.getAnnouncementsForCustomer(
      userPortal,
      userId,
      tierCode,
    );
    const merged = [...portalList, ...storefrontList];
    const seen = new Set<string>();
    return merged
      .filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .sort((a, b) => {
        if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
  },

  saveAnnouncement(item: PortalAnnouncementItem): PortalAnnouncementItem[] {
    const normalized: PortalAnnouncementItem = {
      ...item,
      startsAt: item.startsAt?.trim() ? item.startsAt : null,
      endsAt: item.endsAt?.trim() ? item.endsAt : null,
      expiresAt: item.endsAt?.trim()
        ? item.endsAt
        : item.expiresAt?.trim()
          ? item.expiresAt
          : null,
      targetCustomerIds: Array.isArray(item.targetCustomerIds)
        ? item.targetCustomerIds
        : item.targetCustomerId
          ? [item.targetCustomerId]
          : [],
      targetCustomerId:
        item.targetCustomerId ||
        (Array.isArray(item.targetCustomerIds) && item.targetCustomerIds.length === 1
          ? item.targetCustomerIds[0]
          : item.targetCustomerId),
      updatedAt: new Date().toISOString(),
    };
    const endIso = normalized.endsAt || normalized.expiresAt;
    if (endIso && Date.parse(endIso) <= Date.now()) {
      normalized.archived = true;
      normalized.archivedAt = normalized.archivedAt || endIso;
    }
    const list = [...this.getAnnouncements()];
    const idx = list.findIndex((a) => a.id === normalized.id);
    if (idx >= 0) list[idx] = normalized;
    else list.unshift(normalized);
    try {
      persistPortalCache(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch {}
    emitPortalContentUpdate();
    return list;
  },

  archiveAnnouncement(id: string): PortalAnnouncementItem[] {
    const list = this.getAnnouncements().map((a) =>
      a.id === id
        ? {
            ...a,
            archived: true,
            active: false,
            archivedAt: new Date().toISOString(),
          }
        : a,
    );
    try {
      persistPortalCache(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch {}
    emitPortalContentUpdate();
    return list;
  },

  restoreAnnouncementFromArchive(
    id: string,
    newEndsAt?: string | null,
  ): PortalAnnouncementItem[] {
    const list = this.getAnnouncements().map((a) => {
      if (a.id !== id) return a;
      const endIso = newEndsAt !== undefined ? newEndsAt : a.endsAt || a.expiresAt;
      const isStillPast = endIso ? Date.parse(endIso) <= Date.now() : false;
      return {
        ...a,
        archived: false,
        archivedAt: null,
        active: true,
        endsAt: isStillPast ? null : endIso || null,
        expiresAt: isStillPast ? null : endIso || null,
      };
    });
    try {
      persistPortalCache(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch {}
    emitPortalContentUpdate();
    return list;
  },

  deleteAnnouncement(id: string): PortalAnnouncementItem[] {
    const list = this.getAnnouncements().filter((a) => a.id !== id);
    try {
      persistPortalCache(STORAGE_KEYS.ANNOUNCEMENTS, JSON.stringify(list));
    } catch {}
    emitPortalContentUpdate();
    return list;
  },

  // --- CLUB TIER MILESTONES & REWARDS (نمودار میله‌ای و جوایز سطوح باشگاه) ---
  getClubMilestones(
    portal: PortalTargetType = "high_volume",
  ): ClubTierMilestoneConfig[] {
    try {
      const raw = durableStorage.getItem(STORAGE_KEYS.CLUB_MILESTONES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && portal === "high_volume") return parsed;
        if (Array.isArray(parsed?.[portal])) return parsed[portal];
      }
    } catch {}
    if(databaseStorageEnabled())return [];
    // Independent consumer milestones never inherit wholesale discounts or rewards.
    return portal === "consumer"
      ? DEFAULT_CONSUMER_CLUB_MILESTONES
      : DEFAULT_CLUB_MILESTONES;
  },

  saveClubMilestones(
    milestones: ClubTierMilestoneConfig[],
    portal: PortalTargetType = "high_volume",
  ): ClubTierMilestoneConfig[] {
    try {
      persistPortalCache(
        STORAGE_KEYS.CLUB_MILESTONES,
        JSON.stringify({
          consumer: this.getClubMilestones("consumer"),
          high_volume: this.getClubMilestones("high_volume"),
          [portal]: milestones,
        }),
      );
    } catch {}
    emitPortalContentUpdate();
    return milestones;
  },

  // --- PORTAL LAYOUT, MENUS, UI TEXTS & PERMISSIONS ---
  getPortalConfigs(): Record<PortalTargetType, PortalLayoutConfig> {
    try {
      const raw = durableStorage.getItem(STORAGE_KEYS.PORTAL_CONFIGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (parsed.consumer || parsed.high_volume)) {
          return {
            consumer: {
              ...DEFAULT_PORTAL_CONFIGS.consumer,
              ...parsed.consumer,
              menus:
                parsed.consumer?.menus &&
                !parsed.consumer.menus.some(
                  (m: PortalMenuItemConfig) => m.id === "club_rewards",
                )
                  ? [
                      ...parsed.consumer.menus,
                      {
                        id: "club_rewards",
                        label: "باشگاه مشتریان",
                        enabled: true,
                        order: 2.5,
                      },
                    ]
                  : parsed.consumer?.menus ||
                    DEFAULT_PORTAL_CONFIGS.consumer.menus,
              permissions: {
                ...DEFAULT_PORTAL_CONFIGS.consumer.permissions,
                ...(parsed.consumer?.permissions || {}),
              },
              uiTexts: {
                ...DEFAULT_PORTAL_CONFIGS.consumer.uiTexts,
                ...(parsed.consumer?.uiTexts || {}),
              },
            },
            high_volume: {
              ...DEFAULT_PORTAL_CONFIGS.high_volume,
              ...parsed.high_volume,
              permissions: {
                ...DEFAULT_PORTAL_CONFIGS.high_volume.permissions,
                ...(parsed.high_volume?.permissions || {}),
              },
              uiTexts: {
                ...DEFAULT_PORTAL_CONFIGS.high_volume.uiTexts,
                ...(parsed.high_volume?.uiTexts || {}),
              },
            },
          };
        }
      }
    } catch {}
    return DEFAULT_PORTAL_CONFIGS;
  },

  getPortalConfig(portal: PortalTargetType): PortalLayoutConfig {
    return this.getPortalConfigs()[portal];
  },

  savePortalConfig(portal: PortalTargetType, config: PortalLayoutConfig): void {
    const all = this.getPortalConfigs();
    all[portal] = config;
    try {
      persistPortalCache(STORAGE_KEYS.PORTAL_CONFIGS, JSON.stringify(all));
    } catch {}
    emitPortalContentUpdate();
  },

  // --- INDIVIDUAL CUSTOMER OVERRIDES (شخصی‌سازی تکی دسترسی‌ها و کادرها برای یک مشتری خاص) ---
  getCustomerOverrides(): CustomerIndividualOverride[] {
    try {
      const raw = durableStorage.getItem(STORAGE_KEYS.CUSTOMER_OVERRIDES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  },

  getCustomerOverride(
    customerId?: string,
    portal?: PortalTargetType,
  ): CustomerIndividualOverride | undefined {
    if (!customerId) return undefined;
    return this.getCustomerOverrides().find(
      (o) => o.customerId === customerId && (!portal || o.portal === portal),
    );
  },

  saveCustomerOverride(
    override: CustomerIndividualOverride,
  ): CustomerIndividualOverride[] {
    const list = [...this.getCustomerOverrides()];
    const idx = list.findIndex(
      (o) =>
        o.customerId === override.customerId && o.portal === override.portal,
    );
    if (idx >= 0) list[idx] = override;
    else list.unshift(override);
    try {
      persistPortalCache(STORAGE_KEYS.CUSTOMER_OVERRIDES, JSON.stringify(list));
    } catch {}
    emitPortalContentUpdate();
    return list;
  },

  deleteCustomerOverride(
    customerId: string,
    portal: PortalTargetType,
  ): CustomerIndividualOverride[] {
    const list = this.getCustomerOverrides().filter(
      (o) => o.customerId !== customerId || o.portal !== portal,
    );
    try {
      persistPortalCache(STORAGE_KEYS.CUSTOMER_OVERRIDES, JSON.stringify(list));
    } catch {}
    emitPortalContentUpdate();
    return list;
  },

  /**
   * ترکیب تنظیمات عمومی پنل با تنظیمات تکی مشتری (در صورت وجود)
   */
  getResolvedConfigForCustomer(
    portal: PortalTargetType,
    customerId?: string,
  ): {
    appearance: PortalAppearanceConfig;
    labels: Record<string, string>;
    menus: PortalMenuItemConfig[];
    permissions: PortalPermissionsConfig;
    uiTexts: PortalUiTextsConfig;
    customCartDiscountRule?: CustomerIndividualOverride["customCartDiscountRule"];
  } {
    const base = this.getPortalConfig(portal);
    const ov = this.getCustomerOverride(customerId, portal);

    const disabledSet = new Set(ov?.disabledMenuIds || []);
    const configuredMenus = [...(ov?.menus || base.menus)];
    for (const extra of DEFAULT_PORTAL_CONFIGS[portal].menus.filter((m) =>
      ["saved_products", "purchase_list"].includes(m.id),
    )) {
      if (!configuredMenus.some((m) => m.id === extra.id))
        configuredMenus.push(extra);
    }
    const menus = configuredMenus
      .map((m) => ({
        ...m,
        enabled: disabledSet.has(m.id) ? false : m.enabled,
      }))
      .sort((a, b) => a.order - b.order);

    const permissions: PortalPermissionsConfig = {
      ...base.permissions,
      ...(ov?.permissionsOverride || {}),
    };

    const uiTexts: PortalUiTextsConfig = {
      ...base.uiTexts,
      ...ov?.uiTextsOverride,
      ...(ov?.customWelcomeTitle
        ? { heroWelcomePrefix: ov.customWelcomeTitle }
        : {}),
      ...(ov?.customWelcomeSubtitle
        ? { heroSubtitle: ov.customWelcomeSubtitle }
        : {}),
    };

    return {
      appearance: {
        glass: "subtle",
        density: "comfortable",
        ...base.appearance,
        ...ov?.appearanceOverride,
      },
      labels: { ...base.labels, ...ov?.labelsOverride },
      menus,
      permissions,
      uiTexts,
      customCartDiscountRule: ov?.customCartDiscountRule,
    };
  },
};
