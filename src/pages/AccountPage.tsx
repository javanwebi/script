import { PortalInquiries } from "../components/portal/PortalInquiries";
import { PortalRecentOrders } from "../components/portal/PortalRecentOrders";
import { PortalTools } from "../components/portal/PortalTools";
import { PortalShell } from "../components/portal/PortalShell";
import { PortalClub } from "../components/portal/PortalClub";
import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Award,
  FileSpreadsheet,
  Download,
  ShoppingCart,
  Search,
  Gift,
  TrendingUp,
  CheckCircle2,
  Package,
  FileText,
  Sparkles,
  ShieldCheck,
  ArrowLeft,
  Plus,
  Clock,
  Building2,
  LogOut,
  Layers,
  CreditCard,
  BarChart3,
  Tag,
  Bell,
  MapPin,
  Truck,
  Printer,
  RefreshCw,
  User,
  Lock,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import {
  pricingCreditService,
  PriceListDefinition,
  CatalogSkuPriceItem,
  CustomerRewardAssignment,
} from "../services/pricingCreditService";
import {
  portalContentService,
  PortalBannerItem,
  PortalAnnouncementItem,
  ClubTierMilestoneConfig,
} from "../services/portalContentService";
import { getManagedCatalogProducts } from "../data/mockGenerator";
import { CATEGORIES } from "../data/categories";
import { Customer } from "../types";
import { toPersianDigits } from "../utils/formatters";

const formatPrice = (amount: number | undefined) =>
  new Intl.NumberFormat("fa-IR").format(amount ?? 0);

interface HighVolumeOrderItem {
  id: string;
  orderNumber: string;
  date: string;
  totalAmount: number;
  status: "shipped" | "delivered" | "processing";
  statusText: string;
  trackingCode: string;
  carrier: string;
  itemsCount: number;
}

export const AccountPage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { addToCart, cart: cartItems = [], orders: customerOrders } = useCart();
  const navigate = useNavigate();

  // اگر کاربر عادی (ثبت‌نامی) باشد، اجازه ورود به پنل خرید بالا (/account) را ندارد و به /consumer-dashboard هدایت می‌شود
  useEffect(() => {
    if (
      currentUser &&
      !portalContentService.isHighVolumeCustomer(currentUser)
    ) {
      navigate("/consumer-dashboard", { replace: true });
    }
  }, [currentUser, navigate]);

  // Sync with pricingCreditService & portalContentService
  const [priceLists, setPriceLists] = useState<PriceListDefinition[]>(() =>
    pricingCreditService.getPriceLists(),
  );
  const [allCustomers, setAllCustomers] = useState<Customer[]>(() =>
    pricingCreditService.getAllCustomers(),
  );
  const [catalogSkus, setCatalogSkus] = useState<CatalogSkuPriceItem[]>(() =>
    pricingCreditService.getAllCatalogSkuItems(),
  );
  const [clubMilestones, setClubMilestones] = useState<
    ClubTierMilestoneConfig[]
  >(() => portalContentService.getClubMilestones());
  const [portalTick, setPortalTick] = useState(0);

  const refreshData = () => {
    setPriceLists(pricingCreditService.getPriceLists());
    setAllCustomers(pricingCreditService.getAllCustomers());
    setCatalogSkus(pricingCreditService.getAllCatalogSkuItems());
    setClubMilestones(portalContentService.getClubMilestones());
    setPortalTick((t) => t + 1);
  };

  useEffect(() => {
    window.addEventListener("atlas-pricing-updated", refreshData);
    window.addEventListener("atlas-catalog-updated", refreshData);
    window.addEventListener("atlas-portal-content-updated", refreshData);
    return () => {
      window.removeEventListener("atlas-pricing-updated", refreshData);
      window.removeEventListener("atlas-catalog-updated", refreshData);
      window.removeEventListener("atlas-portal-content-updated", refreshData);
    };
  }, []);

  // مشتری فعلی بر اساس کاربر لاگین‌شده از CRM (بدون هیچ‌گونه سوئیچر دستی برای مشتری)
  const currentCustomer = currentUser!;

  const activePriceList: PriceListDefinition = useMemo(() => {
    const pl = pricingCreditService.getPriceListForCustomer(currentCustomer);
    return (
      pl || {
        id: "pl-default",
        code: "UNASSIGNED",
        name: "لیست قیمت من",
        adminTitle: "لیست قیمت B",
        clubTier: "silver",
        clubTierLabel: "سطح نقره‌ای",
        customerTierLabel: "سطح نقره‌ای",
        customerTier: "silver",
        minPurchaseVolume: 0,
        discountPercent: 0,
        defaultDiscountPercent: 0,
        description: "",
      }
    );
  }, [currentCustomer, priceLists]);

  // تنظیمات محتوا و دسترسی‌های پنل (ترکیب عمومی + تکی برای این مشتری)
  const resolvedConfig = useMemo(
    () =>
      portalContentService.getResolvedConfigForCustomer(
        "high_volume",
        currentCustomer.id,
      ),
    [currentCustomer.id, portalTick],
  );

  const portalLabel = (text: string) => resolvedConfig.labels[text] ?? text;

  const activeBanners: PortalBannerItem[] = useMemo(
    () =>
      portalContentService.getBannersForCustomer(
        "high_volume",
        currentCustomer.id,
        activePriceList.code,
      ),
    [currentCustomer.id, activePriceList.code, portalTick],
  );

  const activeAnnouncements: PortalAnnouncementItem[] = useMemo(
    () =>
      portalContentService.getAnnouncementsForCustomer(
        "high_volume",
        currentCustomer.id,
        activePriceList.code,
      ),
    [currentCustomer.id, activePriceList.code, portalTick],
  );

  const enabledMenus = useMemo(
    () =>
      resolvedConfig.menus.filter(
        (m) =>
          m.enabled &&
          (m.id !== "purchase_list" ||
            resolvedConfig.permissions.allowQuickSkuOrder),
      ),
    [resolvedConfig.menus, resolvedConfig.permissions.allowQuickSkuOrder],
  );

  const [entryParams] = useSearchParams();
  const [activeTab, setActiveTabState] = useState<string>("overview");
  useEffect(() => {
    const requested = entryParams.get("tab");
    if (requested && enabledMenus.some((m) => m.id === requested))
      setActiveTabState(requested);
  }, [entryParams, enabledMenus]);

  const setActiveTab = (id: string) => {
    if (enabledMenus.some((m) => m.id === id)) setActiveTabState(id);
  };
  useEffect(() => {
    if (!enabledMenus.some((m) => m.id === activeTab)) {
      setActiveTabState(enabledMenus[0]?.id || "");
    }
  }, [enabledMenus, activeTab]);

  const myRewards: CustomerRewardAssignment[] = useMemo(() => {
    const res = pricingCreditService.getRewardsForCustomer(currentCustomer);
    return Array.isArray(res) ? res : [];
  }, [currentCustomer, priceLists, portalTick]);

  // محاسبه دقیق وضعیت حجم خرید و نمودار میله‌ای باشگاه مشتریان (بدون امکان تغییر دستی سطح توسط مشتری)
  const clubChartData = useMemo(() => {
    const vol = Math.max(
      0,
      currentCustomer.totalPurchases ?? currentCustomer.totalOrdersAmount ?? 0,
    );
    const milestones = [...clubMilestones].sort(
      (a, b) => a.minPurchaseVolume - b.minPurchaseVolume,
    );
    const maxVolume = Math.max(
      ...milestones.map((m) => m.minPurchaseVolume),
      vol,
      1200000000,
    );

    // پیدا کردن سطح فعلی بر اساس حجم خرید یا تخصیص مدیریت
    let currentMilestone: ClubTierMilestoneConfig | undefined;
    for (const m of milestones) {
      if (vol >= m.minPurchaseVolume) {
        currentMilestone = m;
      }
    }

    const nextMilestone = milestones.find((m) => m.minPurchaseVolume > vol);
    const remainingToNext = nextMilestone
      ? Math.max(0, nextMilestone.minPurchaseVolume - vol)
      : 0;
    const overallProgressPercent =
      milestones.length === 0
        ? 0
        : nextMilestone
          ? Math.min(
              100,
              Math.round((vol / nextMilestone.minPurchaseVolume) * 100),
            )
          : 100;

    return {
      vol,
      milestones,
      maxVolume,
      currentMilestone,
      nextMilestone,
      remainingToNext,
      overallProgressPercent,
    };
  }, [currentCustomer, clubMilestones, activePriceList.code]);

  // Search, Category Filter & Pagination for "لیست قیمت من"
  const [skuSearch, setSkuSearch] = useState("");
  const [selectedCategoryName, setSelectedCategoryName] =
    useState<string>("all");
  const [skuPage, setSkuPage] = useState(1);
  const [orderQuantities, setOrderQuantities] = useState<
    Record<string, number>
  >({});
  const orders: HighVolumeOrderItem[] = customerOrders
    .filter((o) => o.customerId === currentCustomer.id)
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      date: o.createdAt,
      totalAmount: o.finalAmount,
      status:
        o.status === "delivered"
          ? "delivered"
          : o.status === "shipped"
            ? "shipped"
            : "processing",
      statusText:
        o.status === "delivered"
          ? "تحویل شده"
          : o.status === "shipped"
            ? "ارسال شده"
            : "در حال پردازش",
      trackingCode: o.trackingCode || "",
      carrier: o.shippingMethod || "",
      itemsCount: o.items.length,
    }));
  const [toast, setToast] = useState<string | null>(null);
  const skusPerPage = 14;

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const availableFamilyCategories = useMemo(() => {
    const set = new Set<string>();
    catalogSkus.forEach((s) => {
      if (s.categoryName) set.add(s.categoryName);
    });
    return Array.from(set);
  }, [catalogSkus]);

  const filteredSkus = useMemo(() => {
    if (activePriceList.id === "pl-default") return [];
    const byCat =
      selectedCategoryName === "all"
        ? catalogSkus
        : catalogSkus.filter((s) => s.categoryName === selectedCategoryName);
    const q = skuSearch.trim().toLowerCase();
    if (!q) return byCat;
    return byCat.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.familyName.toLowerCase().includes(q),
    );
  }, [catalogSkus, skuSearch, selectedCategoryName, activePriceList.id]);

  useEffect(() => {
    setSkuPage(1);
  }, [skuSearch, selectedCategoryName]);
  const totalSkuPages = Math.max(
    1,
    Math.ceil(filteredSkus.length / skusPerPage),
  );
  const paginatedSkus = filteredSkus.slice(
    (skuPage - 1) * skusPerPage,
    skuPage * skusPerPage,
  );

  const handleAddSkuToCart = (skuItem: CatalogSkuPriceItem) => {
    if (
      !resolvedConfig.permissions.allowQuickSkuOrder ||
      !enabledMenus.some((m) => m.id === "orders_pricelist")
    )
      return;
    if (activePriceList.id === "pl-default") return;
    const qty = Math.max(1, orderQuantities[skuItem.code] || 5);
    const myUnitPrice = pricingCreditService.getSkuPriceForList(
      skuItem.code,
      skuItem.basePrice,
      activePriceList,
    );
    const catalog = getManagedCatalogProducts();
    const fam = catalog.find((p) => p.code === skuItem.familyCode);
    if (!fam) return;

    addToCart(
      {
        ...fam,
        code: skuItem.code,
        name: skuItem.name,
        prices: {
          base: myUnitPrice,
          retail: myUnitPrice,
          wholesale: myUnitPrice,
          dealer: myUnitPrice,
        },
        inquiryOnly: myUnitPrice <= 0,
      },
      qty,
    );
    showToast(
      `${toPersianDigits(qty)} ${skuItem.unit} از کد ${skuItem.code} (${formatPrice(myUnitPrice)} ت) به سبد سفارش شما اضافه شد.`,
    );
  };

  // دانلود اکسل لیست قیمت من (بدون کلمه «اختصاصی» یا کدهای داخلی)
  const handleDownloadMyPriceListExcel = () => {
    if (
      !resolvedConfig.permissions.allowExcelPriceListDownload ||
      !enabledMenus.some((m) => m.id === "orders_pricelist")
    )
      return;
    if (activePriceList.id === "pl-default") {
      showToast("لیست قیمت هنوز منتشر نشده است.");
      return;
    }
    pricingCreditService.exportPriceListToExcel(activePriceList.id);
    showToast(
      "فایل «اکسل لیست قیمت من» (.xlsx) شامل تمامی کدهای کالا با موفقیت دانلود شد.",
    );
  };

  const handleBannerAction = (banner: PortalBannerItem) => {
    if (banner.ctaLinkOrTab.startsWith("/")) {
      navigate(banner.ctaLinkOrTab);
    } else if (enabledMenus.some((m) => m.id === banner.ctaLinkOrTab)) {
      setActiveTab(banner.ctaLinkOrTab);
    } else {
      setActiveTab("orders_pricelist");
    }
  };

  // رندر نمودار میله‌ای بصری باشگاه مشتریان (قابل استفاده در پیشخوان و تب باشگاه)
  const renderClubMilestoneBarChart = (showEnterClubButton: boolean) =>
    enabledMenus.some((m) => m.id === "club_rewards") ? (
      <PortalClub
        portal="high_volume"
        user={currentCustomer}
        texts={resolvedConfig.uiTexts}
        labels={resolvedConfig.labels}
        onDetails={
          showEnterClubButton ? () => setActiveTab("club_rewards") : undefined
        }
      />
    ) : null;

  return (
    <div dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-5 z-50 max-w-md bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-amber-500/40 flex items-center gap-2.5 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* =====================================================================
          TOP HEADER FOR HIGH-VOLUME CUSTOMERS (/account)
         ===================================================================== */}
      <PortalShell
        user={currentCustomer}
        menus={enabledMenus}
        activeTab={activeTab}
        onTab={setActiveTab}
        onLogout={() => {
          logout();
          navigate("/");
        }}
        texts={resolvedConfig.uiTexts}
        labels={resolvedConfig.labels}
        appearance={resolvedConfig.appearance}
        showDiscovery={resolvedConfig.permissions.showPromotionalBanners}
        discountRule={
          resolvedConfig.permissions.showPromotionalBanners
            ? resolvedConfig.customCartDiscountRule
            : undefined
        }
        banners={
          resolvedConfig.permissions.showPromotionalBanners ? activeBanners : []
        }
        onBanner={handleBannerAction}
        metrics={[
          {
            label: resolvedConfig.uiTexts.kpi1Title,
            value: clubChartData.currentMilestone?.publicTitle || "عضو باشگاه",
            visible: resolvedConfig.permissions.showKpi1,
          },
          {
            label: resolvedConfig.uiTexts.kpi2Title,
            value: `${formatPrice(clubChartData.vol)} تومان`,
            visible: resolvedConfig.permissions.showKpi2,
          },
          {
            label: resolvedConfig.uiTexts.kpi3Title,
            value: `${formatPrice(currentCustomer.creditLimit)} تومان`,
            visible:
              resolvedConfig.permissions.showKpi3 &&
              resolvedConfig.permissions.showCreditLimitCard,
          },
          {
            label: resolvedConfig.uiTexts.kpi4Title,
            value: toPersianDigits(myRewards.length),
            visible: resolvedConfig.permissions.showKpi4,
          },
        ]}
      >
        {/* ===================================================================
            TAB 1: OVERVIEW (پیشخوان، نمودار میله‌ای باشگاه مشتریان، اطلاعیه‌ها و خلاصه سفارشات)
           =================================================================== */}
        {["saved_products", "purchase_list"].includes(activeTab) && (
          <PortalTools tab={activeTab} labels={resolvedConfig.labels} />
        )}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {enabledMenus.some((m) => m.id === "orders_pricelist") && (
              <>
                <PortalInquiries labels={resolvedConfig.labels} />
                <PortalRecentOrders
                  title={resolvedConfig.uiTexts.ordersSectionTitle}
                  labels={resolvedConfig.labels}
                  onOrders={() => setActiveTab("orders_pricelist")}
                />
              </>
            )}
            {/* Active Announcements */}
            {resolvedConfig.permissions.showAnnouncements &&
              activeAnnouncements.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeAnnouncements.map((ann) => {
                    const endLabel =
                      ann.showEndTimeToCustomer && ann.endsAt
                        ? new Date(ann.endsAt).toLocaleString("fa-IR", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : null;
                    return (
                      <div
                        key={ann.id}
                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap text-[11px] text-[#E06518] font-bold">
                            <Bell className="w-3.5 h-3.5" />
                            <span>
                              {ann.tag ||
                                (ann.priority === "urgent"
                                  ? "اطلاعیه فوری"
                                  : ann.priority === "important"
                                    ? "اطلاعیه مهم"
                                    : "اطلاعیه پنل خرید بالا")}
                            </span>
                            {ann.highlightValue && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="text-emerald-700">
                                  {ann.highlightValue}
                                </span>
                              </>
                            )}
                          </div>
                          <h4 className="font-black text-xs sm:text-sm text-slate-900">
                            {ann.title}
                          </h4>
                          <p className="text-xs text-slate-600 leading-relaxed">
                            {ann.body}
                          </p>
                          {endLabel && (
                            <div className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>اعتبار تا: {endLabel}</span>
                            </div>
                          )}
                        </div>
                        {ann.actionLabel && ann.actionTab && (
                          <button
                            type="button"
                            onClick={() => setActiveTab(ann.actionTab!)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#E06518] text-white text-[11px] font-bold shrink-0 cursor-pointer transition"
                          >
                            {ann.actionLabel}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

            {/* نمودار میله‌ای حجم خرید و سطوح باشگاه مشتریان + دکمه ورود به صفحه جوایز در زیر آن */}
            {resolvedConfig.permissions.showClubBarChart &&
              renderClubMilestoneBarChart(true)}

            {/* Quick Access Card to Orders & My Price List Excel */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                  <span>
                    {portalLabel("بخش سفارشات و «اکسل لیست قیمت من»")}
                  </span>
                </h3>
                <p className="text-xs text-slate-500">
                  {portalLabel(
                    "در بخش سفارشات می‌توانید فایل اکسل کامل لیست قیمت من را دانلود کرده و اقلام مورد نیاز خود را به صورت سریع ثبت نمایید.",
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                {resolvedConfig.permissions.allowExcelPriceListDownload && (
                  <button
                    type="button"
                    onClick={handleDownloadMyPriceListExcel}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {resolvedConfig.uiTexts.excelDownloadButtonLabel}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setActiveTab("orders_pricelist")}
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-[#E06518] text-white text-xs font-black flex items-center gap-2 cursor-pointer transition"
                >
                  <span>{portalLabel("ورود به سفارشات و لیست قیمت من")}</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 2: ORDERS & MY PRICE LIST (سفارشات و لیست قیمت من + دانلود اکسل لیست قیمت من در همینجا)
           =================================================================== */}
        {activeTab === "orders_pricelist" && (
          <div className="space-y-6">
            {/* بخش ۱: سفارشات ثبت‌شده و دکمه مستقیم دانلود «اکسل لیست قیمت من» */}
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-[#E06518]" />
                    <span>{resolvedConfig.uiTexts.ordersSectionTitle}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {portalLabel(
                      "مشاهده وضعیت سفارش‌های ثبت‌شده، پیش‌فاکتورها و دریافت مستقیم فایل اکسل لیست قیمت من",
                    )}
                  </p>
                </div>

                {resolvedConfig.permissions.allowExcelPriceListDownload && (
                  <button
                    type="button"
                    onClick={handleDownloadMyPriceListExcel}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-md transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {resolvedConfig.uiTexts.excelDownloadButtonLabel} (.xlsx)
                    </span>
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("شماره سفارش / فاکتور")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("تاریخ ثبت")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("تعداد اقلام")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("مبلغ کل سفارش (تومان)")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("کد رهگیری باربری")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("وضعیت ارسال")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-6 text-center text-sm text-slate-500"
                        >
                          هنوز سفارشی برای این حساب ثبت نشده است.
                        </td>
                      </tr>
                    )}
                    {orders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50">
                        <td
                          className="py-3 px-4 font-mono font-black text-slate-900"
                          dir="ltr"
                        >
                          {ord.orderNumber}
                        </td>
                        <td className="py-3 px-4">{ord.date}</td>
                        <td className="py-3 px-4 font-mono">
                          {toPersianDigits(ord.itemsCount)}
                          {portalLabel("قلم کالا")}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-emerald-700">
                          {formatPrice(ord.totalAmount)}
                          {portalLabel("تومان")}
                        </td>
                        <td
                          className="py-3 px-4 font-mono text-slate-600"
                          dir="ltr"
                        >
                          {ord.trackingCode}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-emerald-700 font-bold text-xs">
                            {ord.statusText}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* بخش ۲: جدول کامل «لیست قیمت من» و ثبت سریع در سفارش */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4">
              <div className="p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-slate-50/60">
                <div>
                  <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                    <span>{resolvedConfig.uiTexts.priceListSectionTitle}</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {portalLabel(
                      "می‌توانید فایل «اکسل لیست قیمت من» را دانلود کنید یا هر کد کالا را با تعداد دلخواه مستقیماً به سبد سفارش اضافه نمایید.",
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={skuSearch}
                      onChange={(e) => {
                        setSkuSearch(e.target.value);
                        setSkuPage(1);
                      }}
                      placeholder="جستجوی کد کالا (مثلاً 34265) یا نام قطعه..."
                      className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 bg-white text-xs focus:border-[#E06518] focus:outline-none"
                    />
                  </div>
                  {resolvedConfig.permissions.allowExcelPriceListDownload && (
                    <button
                      type="button"
                      onClick={handleDownloadMyPriceListExcel}
                      className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>
                        {resolvedConfig.uiTexts.excelDownloadButtonLabel}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* فیلتر دسته‌بندی کالاها */}
              <div className="px-5 flex items-center gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryName("all");
                    setSkuPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition ${
                    selectedCategoryName === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {portalLabel("همه دسته‌بندی‌ها (")}
                  {toPersianDigits(catalogSkus.length)})
                </button>
                {availableFamilyCategories.map((catName) => (
                  <button
                    key={catName}
                    type="button"
                    onClick={() => {
                      setSelectedCategoryName(catName);
                      setSkuPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition ${
                      selectedCategoryName === catName
                        ? "bg-[#E06518] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {catName}
                  </button>
                ))}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("کد کالا (SKU)")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("شرح و مشخصات قطعه")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("گروه کالا")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("واحد")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("قیمت واحد در لیست قیمت من")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("ثبت در سفارش")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paginatedSkus.map((sku) => {
                      const myPrice = pricingCreditService.getSkuPriceForList(
                        sku.code,
                        sku.basePrice,
                        activePriceList,
                      );
                      const qty = orderQuantities[sku.code] ?? 5;

                      return (
                        <tr key={sku.code} className="hover:bg-orange-50/30">
                          <td
                            className="py-3 px-4 font-mono font-black text-[#E06518]"
                            dir="ltr"
                          >
                            {sku.code}
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <Link
                              to={`/product/${encodeURIComponent(sku.familyCode)}`}
                              className="hover:text-[#E06518]"
                            >
                              {sku.name}
                            </Link>
                          </td>
                          <td className="py-3 px-4 text-slate-500">
                            {sku.categoryName || sku.familyName}
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            {sku.unit}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-emerald-700 text-sm">
                            {myPrice > 0
                              ? `${formatPrice(myPrice)} تومان`
                              : "تماس جهت پیش‌فاکتور"}
                          </td>
                          <td className="py-3 px-4">
                            {resolvedConfig.permissions.allowQuickSkuOrder ? (
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="number"
                                  min={1}
                                  value={qty}
                                  onChange={(e) =>
                                    setOrderQuantities({
                                      ...orderQuantities,
                                      [sku.code]: Math.max(
                                        1,
                                        Number(e.target.value) || 1,
                                      ),
                                    })
                                  }
                                  className="w-16 px-2 py-1.5 rounded-lg border border-slate-300 text-center font-mono font-bold bg-white"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddSkuToCart(sku)}
                                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#E06518] text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>{portalLabel("افزودن")}</span>
                                </button>
                              </div>
                            ) : (
                              <span className="text-slate-400">
                                {portalLabel("فعال")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">
                  {portalLabel("صفحه")}
                  {toPersianDigits(skuPage)}
                  {portalLabel("از")}
                  {toPersianDigits(totalSkuPages)}
                  {portalLabel("(کل کدهای کالا:")}{" "}
                  {toPersianDigits(filteredSkus.length)})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={skuPage <= 1}
                    onClick={() => setSkuPage((p) => Math.max(1, p - 1))}
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 font-bold cursor-pointer"
                  >
                    {portalLabel("قبلی")}
                  </button>
                  <button
                    type="button"
                    disabled={skuPage >= totalSkuPages}
                    onClick={() =>
                      setSkuPage((p) => Math.min(totalSkuPages, p + 1))
                    }
                    className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 font-bold cursor-pointer"
                  >
                    {portalLabel("بعدی")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            TAB 3: CUSTOMER CLUB, BAR CHART & FULL REWARDS / EVENTS PAGE
           =================================================================== */}
        {activeTab === "club_rewards" && (
          <PortalClub
            portal="high_volume"
            user={currentCustomer}
            texts={resolvedConfig.uiTexts}
            labels={resolvedConfig.labels}
            details
            showChart={resolvedConfig.permissions.showClubBarChart}
          />
        )}

        {activeTab === "profile_addresses" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <User className="w-5 h-5 text-[#E06518]" />
                <span>{portalLabel("مشخصات حساب کاربری و اطلاعات ورود")}</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">
                    {portalLabel("نام مجموعه / شرکت:")}
                  </span>
                  <strong className="text-slate-900">
                    {currentCustomer.companyName ||
                      currentCustomer.company ||
                      "—"}
                  </strong>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">
                    {portalLabel("نام مسئول خرید:")}
                  </span>
                  <strong className="text-slate-900">
                    {currentCustomer.fullName}
                  </strong>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">
                    {portalLabel("نام کاربری ورود به پنل:")}
                  </span>
                  <strong className="font-mono text-[#E06518]" dir="ltr">
                    {currentCustomer.username || currentCustomer.phone}
                  </strong>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-500">
                    {portalLabel("شماره تماس ثبت‌شده:")}
                  </span>
                  <strong className="font-mono text-slate-900" dir="ltr">
                    {currentCustomer.phone}
                  </strong>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs space-y-4">
              <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#E06518]" />
                <span>{portalLabel("آدرس‌های تحویل باربری و انبار")}</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  {(currentCustomer.addresses || []).length === 0 && (
                    <p>{portalLabel("آدرس تحویل هنوز ثبت نشده است.")}</p>
                  )}
                  {(currentCustomer.addresses || []).map((address) => (
                    <div
                      key={address.id}
                      className="space-y-2 border-b border-slate-200 py-3 last:border-0"
                    >
                      <strong>{address.title}</strong>
                      <p>{address.fullAddress}</p>
                      <p>
                        {address.recipientName} — {address.recipientPhone}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </PortalShell>
    </div>
  );
};
