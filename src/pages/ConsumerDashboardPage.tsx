import { PortalInquiries } from "../components/portal/PortalInquiries";
import { PortalRecentOrders } from "../components/portal/PortalRecentOrders";
import { PortalTools } from "../components/portal/PortalTools";
import { PortalShell } from "../components/portal/PortalShell";
import { PortalClub } from "../components/portal/PortalClub";
import React, { useState, useMemo, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
  Search,
  ShoppingCart,
  ShieldCheck,
  ArrowLeft,
  Printer,
  RefreshCw,
  Plus,
  CreditCard,
  Zap,
  Sparkles,
  User,
  LogOut,
  Download,
  FileSpreadsheet,
  Tag,
  Bell,
  Layers,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getManagedCatalogProducts } from "../data/mockGenerator";
import { CATEGORIES } from "../data/categories";
import { toPersianDigits } from "../utils/formatters";
import { ProductImage } from "../components/product/ProductImage";
import {
  portalContentService,
  PortalBannerItem,
  PortalAnnouncementItem,
} from "../services/portalContentService";
import { pricingCreditService } from "../services/pricingCreditService";

const formatPrice = (amount: number | undefined) =>
  new Intl.NumberFormat("fa-IR").format(amount ?? 0);

interface CustomerOrderItem {
  id: string;
  orderNumber: string;
  date: string;
  status: "processing" | "shipped" | "delivered";
  paymentMethod: string;
  paymentRef: string;
  shippingMethod: string;
  trackingCode: string;
  totalAmount: number;
  receiverName: string;
  receiverAddress: string;
  items: {
    code: string;
    name: string;
    quantity: number;
    unit: string;
    unitPrice: number;
  }[];
}

export const ConsumerDashboardPage: React.FC = () => {
  const { currentUser, logout, updateProfile } = useAuth();
  const user = currentUser;
  const { addToCart, cart: cartItems = [], orders: customerOrders } = useCart();
  const navigate = useNavigate();

  // اگر کاربر متعلق به پنل خرید بالا (CRM) باشد، فقط به /account دسترسی دارد
  useEffect(() => {
    if (user && portalContentService.isHighVolumeCustomer(user)) {
      navigate("/account", { replace: true });
    }
  }, [user, navigate]);

  const [portalTick, setPortalTick] = useState(0);
  useEffect(() => {
    const onUpdate = () => setPortalTick((t) => t + 1);
    window.addEventListener("atlas-portal-content-updated", onUpdate);
    return () =>
      window.removeEventListener("atlas-portal-content-updated", onUpdate);
  }, []);

  const resolvedConfig = useMemo(
    () =>
      portalContentService.getResolvedConfigForCustomer("consumer", user?.id),
    [user?.id, portalTick],
  );

  const portalLabel = (text: string) => resolvedConfig.labels[text] ?? text;

  const activeBanners: PortalBannerItem[] = useMemo(
    () => portalContentService.getBannersForCustomer("consumer", user?.id),
    [user?.id, portalTick],
  );

  const activeAnnouncements: PortalAnnouncementItem[] = useMemo(
    () =>
      portalContentService.getAnnouncementsForCustomer("consumer", user?.id),
    [user?.id, portalTick],
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

  const orders: CustomerOrderItem[] = customerOrders
    .filter((o) => o.customerId === user?.id)
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      date: o.createdAt,
      status:
        o.status === "delivered"
          ? "delivered"
          : o.status === "shipped"
            ? "shipped"
            : "processing",
      paymentMethod: o.paymentMethod || "",
      paymentRef: "",
      shippingMethod: o.shippingMethod || "",
      trackingCode: o.trackingCode || "",
      totalAmount: o.finalAmount,
      receiverName: o.recipientName || o.customerName,
      receiverAddress: o.shippingAddress,
      items: o.items.map((item) => ({
        code: item.productCode,
        name: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
      })),
    }));
  const [selectedReceiptOrder, setSelectedReceiptOrder] =
    useState<CustomerOrderItem | null>(null);
  const [quickSkuQuery, setQuickSkuQuery] = useState("");
  const [selectedCategorySlug, setSelectedCategorySlug] =
    useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);

  const [addresses, setAddresses] = useState(() =>
    (user?.addresses || []).map((a) => ({
      id: a.id,
      title: a.title,
      receiver: a.recipientName,
      phone: a.recipientPhone,
      city: a.city,
      postalCode: a.postalCode,
      fullAddress: a.fullAddress,
      isDefault: a.isDefault,
    })),
  );

  const [newAddress, setNewAddress] = useState({
    title: "",
    receiver: "",
    phone: "",
    city: "",
    postalCode: "",
    fullAddress: "",
  });
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  // Catalog products with category filter & search
  const catalogProducts = useMemo(() => {
    const all = getManagedCatalogProducts().filter((p) => p.active !== false);
    const byCat =
      selectedCategorySlug === "all"
        ? all
        : all.filter((p) => p.categorySlug === selectedCategorySlug);
    const q = quickSkuQuery.trim().toLowerCase();
    const filtered = q
      ? byCat.filter(
          (p) =>
            p.code.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q) ||
            (p.variants || []).some(
              (v) =>
                v.code.toLowerCase().includes(q) ||
                v.name.toLowerCase().includes(q),
            ),
        )
      : byCat;
    return filtered.slice(0, 24);
  }, [quickSkuQuery, selectedCategorySlug]);

  const handleQuickAddProduct = (product: any) => {
    if (
      !resolvedConfig.permissions.allowQuickSkuOrder ||
      !enabledMenus.some((m) => m.id === "quick_buy")
    )
      return;
    navigate(`/product/${product.code}`);
    return;
  };

  const handleReorderItems = (order: CustomerOrderItem) => {
    if (!order || !resolvedConfig.permissions.allowQuickReorder) return;
    const catalog = getManagedCatalogProducts();
    order.items.forEach((item) => {
      const found = catalog.find(
        (p) =>
          p.code === item.code || p.variants?.some((v) => v.code === item.code),
      );
      if (found) {
        addToCart(
          {
            ...found,
            code: item.code,
            name: item.name,
            prices: {
              base: item.unitPrice,
              retail: item.unitPrice,
              wholesale: item.unitPrice,
              dealer: item.unitPrice,
            },
            inquiryOnly: false,
          },
          item.quantity,
        );
      }
    });
    showToast(
      `اقلام سفارش ${order.orderNumber} مجدداً به سبد خرید شما افزوده شد.`,
    );
  };

  const handleDownloadMyPriceListExcel = () => {
    if (
      !resolvedConfig.permissions.allowExcelPriceListDownload ||
      !enabledMenus.some((m) => m.id === "orders")
    )
      return;
    const lists = pricingCreditService.getPriceLists();
    const retailPl = lists.find((p) => p.code === "RETAIL" || p.isRetailCash);
    if (!retailPl) {
      showToast("لیست قیمت هنوز منتشر نشده است.");
      return;
    }
    if (retailPl) {
      pricingCreditService.exportPriceListToExcel(retailPl.id);
    }
    showToast("فایل «اکسل لیست قیمت من» (.xlsx) با موفقیت دانلود شد.");
  };

  const handleBannerAction = (banner: PortalBannerItem) => {
    if (banner.ctaLinkOrTab.startsWith("/")) {
      navigate(banner.ctaLinkOrTab);
    } else if (enabledMenus.some((m) => m.id === banner.ctaLinkOrTab)) {
      setActiveTab(banner.ctaLinkOrTab);
    } else {
      setActiveTab("quick_buy");
    }
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.title.trim() || !newAddress.fullAddress.trim()) return;
    const next = [
      ...addresses,
      {
        id: crypto.randomUUID(),
        ...newAddress,
        isDefault: addresses.length === 0,
      },
    ];
    setAddresses(next);
    updateProfile({
      addresses: next.map((a) => ({
        id: a.id,
        title: a.title,
        recipientName: a.receiver,
        recipientPhone: a.phone,
        city: a.city,
        province: user?.province || "",
        postalCode: a.postalCode,
        fullAddress: a.fullAddress,
        isDefault: a.isDefault,
      })),
    });
    setNewAddress({
      title: "",
      receiver: "",
      phone: "",
      city: "",
      postalCode: "",
      fullAddress: "",
    });
    setIsAddingAddress(false);
    showToast("آدرس جدید تحویل مرسوله ثبت شد.");
  };

  const totalSpent = orders.reduce((acc, o) => acc + o.totalAmount, 0);

  return (
    <div dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <PortalShell
        user={user!}
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
            value: "فعال",
            visible: resolvedConfig.permissions.showKpi1,
          },
          {
            label: resolvedConfig.uiTexts.kpi2Title,
            value: toPersianDigits(orders.length),
            visible: resolvedConfig.permissions.showKpi2,
          },
          {
            label: resolvedConfig.uiTexts.kpi3Title,
            value: `${formatPrice(totalSpent)} تومان`,
            visible: resolvedConfig.permissions.showKpi3,
          },
          {
            label: resolvedConfig.uiTexts.kpi4Title,
            value: "همراه شما",
            visible: resolvedConfig.permissions.showKpi4,
          },
        ]}
      >
        {/* Left Main Area */}
        <div className="space-y-6">
          {/* Active Announcements */}
          {resolvedConfig.permissions.showAnnouncements &&
            activeAnnouncements.length > 0 &&
            activeTab === "overview" && (
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
                                  : "اطلاعیه پنل خرده‌فروش")}
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

          {/* ===============================================================
              TAB 1: OVERVIEW (پیشخوان کاربری و رهگیری مرسوله)
             =============================================================== */}
          {["saved_products", "purchase_list"].includes(activeTab) && (
            <PortalTools tab={activeTab} labels={resolvedConfig.labels} />
          )}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {enabledMenus.some((m) => m.id === "orders") && (
                <>
                  <PortalInquiries labels={resolvedConfig.labels} />
                  <PortalRecentOrders
                    title={resolvedConfig.uiTexts.ordersSectionTitle}
                    labels={resolvedConfig.labels}
                    onOrders={() => setActiveTab("orders")}
                  />
                </>
              )}
              {resolvedConfig.permissions.showClubBarChart &&
                enabledMenus.some((m) => m.id === "club_rewards") && (
                  <PortalClub
                    portal="consumer"
                    user={user!}
                    texts={resolvedConfig.uiTexts}
                    labels={resolvedConfig.labels}
                    onDetails={() => setActiveTab("club_rewards")}
                  />
                )}
              {/* Active Shipment Live Tracker */}
              {orders[0] && (
                <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-bold text-emerald-700">
                          {portalLabel("تأیید و تسویه‌شده")}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span
                          className="font-mono font-black text-sm text-slate-900"
                          dir="ltr"
                        >
                          {orders[0]?.orderNumber}
                        </span>
                      </div>
                      <h2 className="text-base font-black text-slate-800 mt-1">
                        {portalLabel("وضعیت لحظه‌ای آخرین سفارش شما")}
                      </h2>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {resolvedConfig.permissions
                        .allowExcelPriceListDownload && (
                        <button
                          type="button"
                          onClick={handleDownloadMyPriceListExcel}
                          className="px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition"
                        >
                          <FileSpreadsheet className="w-3.5 h-3.5" />
                          <span>
                            {resolvedConfig.uiTexts.excelDownloadButtonLabel}
                          </span>
                        </button>
                      )}
                      {resolvedConfig.permissions.allowInvoicePrint && (
                        <button
                          type="button"
                          onClick={() => setSelectedReceiptOrder(orders[0])}
                          className="px-3.5 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{portalLabel("مشاهده و چاپ فاکتور")}</span>
                        </button>
                      )}
                      {resolvedConfig.permissions.allowQuickReorder && (
                        <button
                          type="button"
                          onClick={() => handleReorderItems(orders[0])}
                          className="px-3.5 py-2 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>{portalLabel("تکرار این سفارش")}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Visual Stepper */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    {[
                      {
                        step: "۱. ثبت و تأیید سفارش",
                        desc: "تأیید نهایی در سیستم",
                        done: true,
                      },
                      {
                        step: "۲. کنترل کیفی و بسته‌بندی",
                        desc: "تست اصالت در انبار مرکزی",
                        done: true,
                      },
                      {
                        step: "۳. تحویل به تیپاکس / باربری",
                        desc: `کد رهگیری: ${orders[0]?.trackingCode}`,
                        done: true,
                        active: true,
                      },
                      {
                        step: "۴. تحویل به آدرس شما",
                        desc: "در مسیر ارسال به مقصد",
                        done: false,
                      },
                    ].map((st, idx) => (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border text-xs ${
                          st.active
                            ? "border-[#E06518] bg-orange-50/70"
                            : st.done
                              ? "border-emerald-200 bg-emerald-50/50"
                              : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-black text-slate-800">
                            {st.step}
                          </span>
                          {st.done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Clock className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                        <div className="text-[11px] text-slate-600">
                          {st.desc}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Order Items Summary */}
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-slate-600 pb-2 border-b border-slate-200">
                      <span>
                        {portalLabel("روش ارسال:")}
                        <strong className="text-slate-900">
                          {orders[0]?.shippingMethod}
                        </strong>
                      </span>
                      <span>
                        {portalLabel("مبلغ کل سفارش:")}{" "}
                        <strong className="text-emerald-700 font-mono text-sm">
                          {formatPrice(orders[0]?.totalAmount)}
                          {portalLabel("تومان")}
                        </strong>
                      </span>
                    </div>
                    <div className="divide-y divide-slate-200/60">
                      {orders[0]?.items.map((item, i) => (
                        <div
                          key={i}
                          className="py-2 flex items-center justify-between"
                        >
                          <div>
                            <span
                              className="font-mono font-bold text-[#E06518] ml-2"
                              dir="ltr"
                            >
                              [{item.code}]
                            </span>
                            <span className="font-bold text-slate-800">
                              {item.name}
                            </span>
                          </div>
                          <div className="font-mono text-slate-700">
                            {toPersianDigits(item.quantity)} {item.unit} ×{" "}
                            {formatPrice(item.unitPrice)}
                            {portalLabel("ت")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Product Selection Grid */}
              {resolvedConfig.permissions.allowQuickSkuOrder && (
                <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                        <Zap className="w-5 h-5 text-[#E06518]" />
                        <span>
                          {resolvedConfig.uiTexts.priceListSectionTitle}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {portalLabel(
                          "قطعات و ملزومات پرمصرف صنعتی آماده افزودن مستقیم به سبد خرید شما",
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab("quick_buy")}
                      className="text-xs font-bold text-[#E06518] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <span>
                        {portalLabel("مشاهده همه کالاها و جستجو با کد فنی")}
                      </span>
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {catalogProducts.slice(0, 6).map((prod) => {
                      const firstVar = (prod.variants || [])[0];
                      const unitPrice =
                        (firstVar &&
                          (firstVar.price || firstVar.prices?.retail)) ||
                        prod.prices?.retail ||
                        0;
                      return (
                        <div
                          key={prod.code}
                          className="p-4 rounded-2xl border border-slate-200 hover:border-[#E06518] bg-slate-50/50 hover:bg-white transition-all flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-16 h-16 rounded-xl bg-white border border-slate-200 p-1.5 shrink-0 overflow-hidden">
                              <ProductImage
                                src={prod.images?.[0]}
                                alt={prod.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <span
                                className="inline-block font-mono text-[11px] font-black text-[#E06518]"
                                dir="ltr"
                              >
                                {portalLabel("کد:")}
                                {firstVar ? firstVar.code : prod.code}
                              </span>
                              <Link
                                to={`/product/${encodeURIComponent(prod.code)}`}
                                className="block font-black text-xs text-slate-800 hover:text-[#E06518] line-clamp-2 mt-0.5"
                              >
                                {prod.name}
                              </Link>
                            </div>
                          </div>

                          <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                            <div>
                              <span className="text-[10px] text-slate-500 block">
                                {portalLabel("قیمت واحد:")}
                              </span>
                              <span className="font-mono font-black text-xs text-emerald-700">
                                {unitPrice > 0
                                  ? `${formatPrice(unitPrice)} تومان`
                                  : portalLabel("استعلام قیمت")}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleQuickAddProduct(prod)}
                              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-[#E06518] text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{portalLabel("انتخاب کد و سفارش")}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===============================================================
              TAB 2: ORDERS & MY PRICE LIST DOWNLOAD
             =============================================================== */}
          {activeTab === "club_rewards" && (
            <PortalClub
              portal="consumer"
              user={user!}
              texts={resolvedConfig.uiTexts}
              labels={resolvedConfig.labels}
              details
              showChart={resolvedConfig.permissions.showClubBarChart}
            />
          )}
          {activeTab === "orders" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-base text-slate-800 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-[#E06518]" />
                    <span>{resolvedConfig.uiTexts.ordersSectionTitle}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {portalLabel(
                      "پیگیری وضعیت مرسولات، دریافت فاکتور و دانلود فایل اکسل لیست قیمت من",
                    )}
                  </p>
                </div>

                {resolvedConfig.permissions.allowExcelPriceListDownload && (
                  <button
                    type="button"
                    onClick={handleDownloadMyPriceListExcel}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black flex items-center gap-2 cursor-pointer shadow-sm transition"
                  >
                    <Download className="w-4 h-4" />
                    <span>
                      {resolvedConfig.uiTexts.excelDownloadButtonLabel} (.xlsx)
                    </span>
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {orders.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">
                    هنوز سفارشی برای این حساب ثبت نشده است.
                  </p>
                )}
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono font-black text-sm text-slate-900"
                            dir="ltr"
                          >
                            {order.orderNumber}
                          </span>
                          <span className="text-slate-300">•</span>
                          <span
                            className={`text-xs font-bold ${
                              order.status === "delivered"
                                ? "text-emerald-700"
                                : "text-amber-700"
                            }`}
                          >
                            {order.status === "delivered"
                              ? "تحویل‌شده به مشتری"
                              : "تحویل تیپاکس / در مسیر ارسال"}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {portalLabel("تاریخ ثبت:")}
                          {order.date}
                          {portalLabel("• کد رهگیری مرسوله:")}{" "}
                          <span
                            className="font-mono font-bold text-slate-800"
                            dir="ltr"
                          >
                            {order.trackingCode}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {resolvedConfig.permissions.allowInvoicePrint && (
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptOrder(order)}
                            className="px-3 py-1.5 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>{portalLabel("مشاهده فاکتور")}</span>
                          </button>
                        )}
                        {resolvedConfig.permissions.allowQuickReorder && (
                          <button
                            type="button"
                            onClick={() => handleReorderItems(order)}
                            className="px-3 py-1.5 rounded-xl bg-[#E06518] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{portalLabel("سفارش مجدد")}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 text-xs">
                      {order.items.map((it, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between"
                        >
                          <div>
                            <span
                              className="font-mono font-bold text-[#E06518] ml-1.5"
                              dir="ltr"
                            >
                              {it.code}
                            </span>
                            <span className="font-bold text-slate-800">
                              {it.name}
                            </span>
                          </div>
                          <div className="font-mono text-slate-700">
                            {toPersianDigits(it.quantity)} {it.unit} ×{" "}
                            {formatPrice(it.unitPrice)}
                            {portalLabel("ت")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 3: QUICK ORDER BY SKU CODE & CATEGORY
             =============================================================== */}
          {activeTab === "quick_buy" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black text-base text-slate-800">
                    {portalLabel(
                      "جستجو و ثبت سفارش سریع بر اساس کد کالا یا دسته‌بندی",
                    )}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {portalLabel(
                      "کد فنی قطعه (مثلاً 34265) یا نام آن را وارد کنید و مستقیماً به سبد خرید اضافه نمایید",
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="search"
                      value={quickSkuQuery}
                      onChange={(e) => setQuickSkuQuery(e.target.value)}
                      placeholder="جستجوی کد کالا یا نام محصول..."
                      className="w-full pr-9 pl-3 py-2 rounded-xl border border-slate-300 text-xs focus:border-[#E06518] outline-none"
                    />
                  </div>
                  {resolvedConfig.permissions.allowExcelPriceListDownload && (
                    <button
                      type="button"
                      onClick={handleDownloadMyPriceListExcel}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{portalLabel("اکسل لیست قیمت من")}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Category Filter Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-2">
                <button
                  type="button"
                  onClick={() => setSelectedCategorySlug("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition ${
                    selectedCategorySlug === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {portalLabel("همه دسته‌بندی‌ها")}
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => setSelectedCategorySlug(cat.slug)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 cursor-pointer transition ${
                      selectedCategorySlug === cat.slug
                        ? "bg-[#E06518] text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {catalogProducts.map((prod) => {
                  const firstVar = (prod.variants || [])[0];
                  const unitPrice =
                    (firstVar && (firstVar.price || firstVar.prices?.retail)) ||
                    prod.prices?.retail ||
                    0;
                  return (
                    <div
                      key={prod.code}
                      className="p-3.5 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3 bg-slate-50/40 hover:bg-white hover:border-[#E06518] transition"
                    >
                      <div>
                        <span
                          className="font-mono text-xs font-black text-[#E06518]"
                          dir="ltr"
                        >
                          {portalLabel("کد:")}
                          {firstVar ? firstVar.code : prod.code}
                        </span>
                        <div className="font-bold text-xs text-slate-800 mt-1">
                          {prod.name}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {prod.categoryName}
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                        <span className="font-mono font-black text-xs text-emerald-700">
                          {formatPrice(unitPrice)}
                          {portalLabel("ت")}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleQuickAddProduct(prod)}
                          className="px-3 py-1.5 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold cursor-pointer transition"
                        >
                          {portalLabel("+ افزودن به سبد")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 4: RECEIPTS & INVOICES
             =============================================================== */}
          {activeTab === "receipts" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-black text-base text-slate-800">
                  {portalLabel("رسیدهای پرداخت و فاکتورهای رسمی سفارشات من")}
                </h3>
                {resolvedConfig.permissions.allowExcelPriceListDownload && (
                  <button
                    type="button"
                    onClick={handleDownloadMyPriceListExcel}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>
                      {resolvedConfig.uiTexts.excelDownloadButtonLabel}
                    </span>
                  </button>
                )}
              </div>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-right border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-700">
                    <tr>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("شماره فاکتور")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("تاریخ ثبت")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("شماره پیگیری پرداخت")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("مبلغ کل (تومان)")}
                      </th>
                      <th className="py-3 px-4 font-bold">
                        {portalLabel("عملیات")}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td
                          className="py-3 px-4 font-mono font-black text-slate-900"
                          dir="ltr"
                        >
                          {o.orderNumber}
                        </td>
                        <td className="py-3 px-4">{o.date}</td>
                        <td className="py-3 px-4 font-mono text-slate-600">
                          {o.paymentRef}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-emerald-700">
                          {formatPrice(o.totalAmount)}
                          {portalLabel("ت")}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedReceiptOrder(o)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer"
                          >
                            {portalLabel("مشاهده و چاپ فاکتور")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 5: SHIPPING ADDRESSES
             =============================================================== */}
          {activeTab === "addresses" && (
            <div className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-base text-slate-800">
                  {portalLabel("آدرس‌های ثبت‌شده جهت ارسال مرسولات")}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddingAddress(!isAddingAddress)}
                  className="px-4 py-2 rounded-xl bg-[#E06518] text-white text-xs font-bold cursor-pointer"
                >
                  {portalLabel("+ افزودن آدرس جدید")}
                </button>
              </div>

              {isAddingAddress && (
                <form
                  onSubmit={handleAddAddress}
                  className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      placeholder="عنوان آدرس (مثلاً کارگاه مرکزی)"
                      value={newAddress.title}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, title: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      required
                      placeholder="نام تحویل‌گیرنده"
                      value={newAddress.receiver}
                      onChange={(e) =>
                        setNewAddress({
                          ...newAddress,
                          receiver: e.target.value,
                        })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="شماره تماس"
                      value={newAddress.phone}
                      onChange={(e) =>
                        setNewAddress({ ...newAddress, phone: e.target.value })
                      }
                      className="px-3 py-2 rounded-xl border border-slate-300 bg-white font-mono"
                    />
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="نشانی دقیق پستی..."
                    value={newAddress.fullAddress}
                    onChange={(e) =>
                      setNewAddress({
                        ...newAddress,
                        fullAddress: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold cursor-pointer"
                    >
                      {portalLabel("ذخیره آدرس")}
                    </button>
                  </div>
                </form>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {addresses.map((addr) => (
                  <div
                    key={addr.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-slate-900">
                        {addr.title}
                      </span>
                      {addr.isDefault && (
                        <span className="text-emerald-700 text-[11px] font-bold">
                          {portalLabel("آدرس پیش‌فرض")}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-600 leading-relaxed">
                      {addr.fullAddress}
                    </p>
                    <div className="text-[11px] text-slate-500 pt-1">
                      {portalLabel("تحویل‌گیرنده:")}
                      <strong>{addr.receiver}</strong>
                      {portalLabel("• تلفن:")}{" "}
                      <span className="font-mono">{addr.phone}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Printable Invoice Modal */}
        {selectedReceiptOrder && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-2xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
              <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
                <h4 className="text-sm font-black">
                  {portalLabel("فاکتور و رسید خرید —")}
                  {selectedReceiptOrder.orderNumber}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-3 py-1.5 rounded-lg bg-[#E06518] text-white text-xs font-bold cursor-pointer"
                  >
                    {portalLabel("چاپ فاکتور")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedReceiptOrder(null)}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-bold cursor-pointer"
                  >
                    {portalLabel("بستن")}
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4 text-xs">
                <div className="flex justify-between pb-3 border-b border-slate-200">
                  <div>
                    <div className="font-black text-sm text-slate-900">
                      {portalLabel("فروشگاه و بازرگانی هایپرصنعت اطلس یزد")}
                    </div>
                    <div className="text-slate-500 mt-0.5">
                      {portalLabel("خریدار:")}
                      {selectedReceiptOrder.receiverName}
                    </div>
                  </div>
                  <div className="text-left">
                    <div>
                      {portalLabel("تاریخ:")}
                      {selectedReceiptOrder.date}
                    </div>
                    <div className="text-emerald-700 font-bold mt-0.5">
                      {portalLabel("وضعیت: تسویه کامل")}
                    </div>
                  </div>
                </div>

                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="py-2">{portalLabel("کد کالا")}</th>
                      <th className="py-2">{portalLabel("شرح کالا")}</th>
                      <th className="py-2">{portalLabel("تعداد")}</th>
                      <th className="py-2">
                        {portalLabel("قیمت واحد (تومان)")}
                      </th>
                      <th className="py-2">{portalLabel("جمع (تومان)")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedReceiptOrder.items.map((it, i) => (
                      <tr key={i}>
                        <td
                          className="py-2.5 font-mono font-bold text-[#E06518]"
                          dir="ltr"
                        >
                          {it.code}
                        </td>
                        <td className="py-2.5 font-bold">{it.name}</td>
                        <td className="py-2.5">
                          {toPersianDigits(it.quantity)} {it.unit}
                        </td>
                        <td className="py-2.5 font-mono">
                          {formatPrice(it.unitPrice)}
                        </td>
                        <td className="py-2.5 font-mono font-bold">
                          {formatPrice(it.unitPrice * it.quantity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between font-black text-sm text-emerald-950">
                  <span>{portalLabel("جمع کل پرداخت‌شده:")}</span>
                  <span className="font-mono">
                    {formatPrice(selectedReceiptOrder.totalAmount)}
                    {portalLabel("تومان")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </PortalShell>
    </div>
  );
};
