import { PortalShell } from "../components/portal/PortalShell";
import { ParcelArt, InvoiceArt, LocationArt } from "../components/portal/ConsumerReferenceArt";
import { STORE_ASSETS } from "../assets/images";
import { ConsumerOrderTimeline, orderStatusLabels } from "../components/portal/ConsumerOrderTimeline";
import React, { useState, useMemo, useEffect, useRef, useDeferredValue, Suspense } from "react";
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
  Heart,
  ChevronLeft,
  Bell,
  Layers,
  Headphones,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { getManagedCatalogProducts, getProductByCode, subscribeCatalogChanges } from "../data/mockGenerator";
import { searchConsumerProducts, resolveCurrentRetailReorder } from "../utils/consumerCatalogView";

import { toPersianDigits } from "../utils/formatters";
import { getCurrentCustomerSkuPrice } from "../utils/customerPricing";
import { ProductImage } from "../components/product/ProductImage";
import {
  portalContentService,
  PortalBannerItem,
  PortalAnnouncementItem,
} from "../services/portalContentService";
import { pricingCreditService } from "../services/pricingCreditService";
import type { Product } from "../types";
const PortalInquiries = React.lazy(() => import("../components/portal/PortalInquiries").then((m) => ({ default: m.PortalInquiries })));
const PortalRecentOrders = React.lazy(() => import("../components/portal/PortalRecentOrders").then((m) => ({ default: m.PortalRecentOrders })));
const PortalTools = React.lazy(() => import("../components/portal/PortalTools").then((m) => ({ default: m.PortalTools })));
const PortalClub = React.lazy(() => import("../components/portal/PortalClub").then((m) => ({ default: m.PortalClub })));
const panelFallback = <div className="consumer-panel-skeleton" role="status" aria-live="polite">در حال آماده‌سازی بخش انتخاب‌شده…</div>;


const formatPrice = (amount: number | undefined) =>
  new Intl.NumberFormat("fa-IR").format(amount ?? 0);

interface CustomerOrderItem {
  id: string;
  orderNumber: string;
  date: string;
  status: "registered" | "processing" | "shipped" | "delivered" | "cancelled";
  paymentStatus: string;
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
  const [catalogTick, setCatalogTick] = useState(0);
  // Catalog normalisation is O(families + SKUs). Do it once per catalog revision.
  const catalog = useMemo(() => getManagedCatalogProducts().filter((p) => p.active !== false), [catalogTick]);
  const suggestedProducts = useMemo(() => catalog.slice(0, 2), [catalog]);
  useEffect(() => subscribeCatalogChanges(() => setCatalogTick((tick) => tick + 1)), []);
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

  const orders: CustomerOrderItem[] = useMemo(() => customerOrders
    .filter((o) => o.customerId === user?.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      date: o.createdAt,
      status: o.status,
      paymentStatus: o.paymentStatus || "pending_review",
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
    })), [customerOrders, user?.id]);
  const [orderFilter, setOrderFilter] = useState<"all" | "processing" | "shipped" | "delivered">("all");
  const [receiptFilter, setReceiptFilter] = useState<"all" | "paid" | "pending">("all");
  const orderImageByCode = useMemo(() => {
    const codes = new Set(orders.map((order) => order.items[0]?.code).filter((code): code is string => Boolean(code)));
    const images = new Map<string, string>();
    codes.forEach((code) => {
      const product = getProductByCode(code);
      const variant = product?.variants?.find((entry) => entry.code.toLowerCase() === code.toLowerCase());
      const image = variant?.images?.[0] || product?.images?.[0];
      if (image) images.set(code, image);
    });
    return images;
  }, [catalogTick, orders]);
  const receiptDialogRef = useRef<HTMLDivElement>(null);
  const [selectedReceiptOrder, setSelectedReceiptOrder] =
    useState<CustomerOrderItem | null>(null);
  useEffect(() => {
    if (selectedReceiptOrder) receiptDialogRef.current?.focus();
  }, [selectedReceiptOrder]);
  const [quickSkuQuery, setQuickSkuQuery] = useState("");
  const deferredQuickSkuQuery = useDeferredValue(quickSkuQuery);
  const [visibleProductCount, setVisibleProductCount] = useState(6);
  const [selectedCategorySlug, setSelectedCategorySlug] =
    useState<string>("all");
  const [toast, setToast] = useState<string | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); }, []);
  useEffect(() => { setVisibleProductCount(6); }, [quickSkuQuery, selectedCategorySlug]);

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
  const [extraOpen, setExtraOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast(msg);
    toastTimeout.current = setTimeout(() => { setToast(null); toastTimeout.current = null; }, 3500);
  };

  const availableCategories = useMemo(() => {
    const categories = new Map<string, string>();
    for (const product of catalog) {
      if (product.categorySlug && product.categoryName)
        categories.set(product.categorySlug, product.categoryName);
    }
    return [...categories].map(([slug, name]) => ({ slug, name }));
  }, [catalog]);

  // Search the entire real catalog, but never search hidden tabs or render all results.
  const catalogProducts = useMemo(() => (
    activeTab === "quick_buy"
      ? searchConsumerProducts(catalog, deferredQuickSkuQuery, selectedCategorySlug)
      : []
  ), [catalog, deferredQuickSkuQuery, selectedCategorySlug, activeTab]);

  const handleQuickAddProduct = (product: Product) => {
    if (
      !resolvedConfig.permissions.allowQuickSkuOrder ||
      !enabledMenus.some((m) => m.id === "quick_buy")
    )
      return;
    navigate(`/consumer-dashboard/product/${encodeURIComponent(product.code)}`);
    return;
  };

  const handleReorderItems = (order: CustomerOrderItem) => {
    if (!resolvedConfig.permissions.allowQuickReorder) return;
    let added = 0;
    for (const item of order.items) {
      const current = resolveCurrentRetailReorder(item.code, item.quantity, getProductByCode);
      if (!current) continue;
      addToCart(current.product, current.quantity);
      added += 1;
    }
    const missing = order.items.length - added;
    showToast(added
      ? `${toPersianDigits(added)} قلم با قیمت فعلی کاتالوگ به سبد افزوده شد${missing ? `؛ ${toPersianDigits(missing)} قلم نیاز به انتخاب یا استعلام مجدد دارد.` : "."}`
      : "کدهای این سفارش اکنون قابل خرید مستقیم نیستند؛ لطفاً کالاها را دوباره از کاتالوگ انتخاب کنید.");
  };

  const handleDownloadMyPriceListExcel = () => {
    if (!resolvedConfig.permissions.allowExcelPriceListDownload) return;
    if (user?.canViewPrices !== true) {
      showToast("دسترسی مشاهده قیمت برای این حساب فعال نیست؛ با پشتیبانی تماس بگیرید.");
      return;
    }
    pricingCreditService.downloadCurrentCustomerPriceListExcel("xlsx");
    showToast("فایل «اکسل قیمت‌های به‌روز حساب شما» (.xlsx) با موفقیت آماده شد.");
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

  const persistAddresses = (next: typeof addresses) => {
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
  };

  const handleAddAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAddress.title.trim() || !newAddress.fullAddress.trim() || !newAddress.city.trim() || !newAddress.receiver.trim()) return;
    const next = editingAddressId
      ? addresses.map((a) => a.id === editingAddressId ? { ...a, ...newAddress } : a)
      : [...addresses, { id: crypto.randomUUID(), ...newAddress, isDefault: addresses.length === 0 }];
    persistAddresses(next);
    setNewAddress({ title: "", receiver: "", phone: "", city: "", postalCode: "", fullAddress: "" });
    setIsAddingAddress(false);
    setEditingAddressId(null);
    showToast("درخواست ذخیره آدرس ارسال شد.");
  };
  const handleEditAddress = (address: (typeof addresses)[number]) => {
    setEditingAddressId(address.id);
    setNewAddress({
      title: address.title, receiver: address.receiver, phone: address.phone,
      city: address.city, postalCode: address.postalCode, fullAddress: address.fullAddress,
    });
    setIsAddingAddress(true);
  };
  const handleSetDefaultAddress = (id: string) => {
    persistAddresses(addresses.map((a) => ({ ...a, isDefault: a.id === id })));
    showToast("درخواست تغییر آدرس پیش‌فرض ارسال شد.");
  };
  useEffect(() => {
    setAddresses((user?.addresses || []).map((a) => ({
      id: a.id, title: a.title, receiver: a.recipientName, phone: a.recipientPhone,
      city: a.city, postalCode: a.postalCode, fullAddress: a.fullAddress, isDefault: a.isDefault,
    })));
  }, [user?.addresses]);

  const totalSpent = useMemo(() => orders.filter((o) => o.paymentStatus === "paid")
    .reduce((acc, o) => acc + o.totalAmount, 0), [orders]);
  const activeOrder = orders.find((o) => o.status !== "cancelled" && o.status !== "delivered") || orders.find((o) => o.status === "delivered");
  const filteredOrders = orders.filter((o) => orderFilter === "all" || (orderFilter === "processing" ? o.status === "registered" || o.status === "processing" : o.status === orderFilter));
  const filteredReceipts = orders.filter((o) => receiptFilter === "all" || (receiptFilter === "paid" ? o.paymentStatus === "paid" : o.paymentStatus !== "paid"));
  const paidCount = useMemo(() => orders.filter((o) => o.paymentStatus === "paid").length, [orders]);

  return (
    <div dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center gap-2.5 text-xs font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      <PortalShell
        variant="consumer"
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
              <div className="consumer-announcement-list grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Suspense fallback={panelFallback}>
              <PortalTools tab={activeTab} labels={resolvedConfig.labels} referenceConsumer />
            </Suspense>
          )}
          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* Screenshot reference: shipment first, then 2×2 account cards, then tracking. */}
              {activeOrder ? (
                <section className="consumer-overview-shipment" aria-label="سفارش فعال">
                  <span className="consumer-shipment-package"><ParcelArt /></span>
                  <div className="consumer-shipment-copy">
                    <strong><span className="consumer-live-dot" /> {activeOrder.status === "delivered" ? "آخرین سفارش شما" : "سفارش فعال شما"}</strong>
                    <span>شماره سفارش: <bdi dir="ltr">{activeOrder.orderNumber}</bdi></span>
                    <small>{orderStatusLabels[activeOrder.status]}</small>
                  </div>
                  <button type="button" onClick={() => setActiveTab("orders")} className="consumer-shipment-track">
                    <Truck size={18} aria-hidden="true" /> پیگیری سفارش <ChevronLeft size={16} />
                  </button>
                </section>
              ) : (
                <section className="consumer-overview-shipment is-empty">
                  <span className="consumer-shipment-package"><ParcelArt /></span>
                  <div className="consumer-shipment-copy"><strong>هنوز سفارش فعالی ندارید</strong><small>قطعات موردنیاز را از کاتالوگ انتخاب کنید.</small></div>
                  <button type="button" className="consumer-shipment-track" onClick={() => setActiveTab("quick_buy")}>شروع خرید <ChevronLeft size={16} /></button>
                </section>
              )}

              <section className="consumer-overview-stats" aria-label="خلاصه حساب شما">
                <button type="button" onClick={() => setActiveTab("receipts")}>
                  <CreditCard size={29} aria-hidden="true" /><span><b>وضعیت حساب</b><small>حساب فعال</small></span><ChevronLeft size={16} />
                </button>
                <button type="button" onClick={() => navigate("/ai-forza")}>
                  <Headphones size={29} aria-hidden="true" /><span><b>پشتیبانی</b><small>مشاوره و راهنمایی قطعات</small></span><ChevronLeft size={16} />
                </button>
                <button type="button" onClick={() => setActiveTab("orders")}>
                  <Package size={29} aria-hidden="true" /><span><b>سفارش‌های من</b><small>{toPersianDigits(orders.filter((o) => o.status !== "cancelled" && o.status !== "delivered").length)} سفارش فعال</small></span><ChevronLeft size={16} />
                </button>
                <button type="button" onClick={() => setActiveTab("receipts")}>
                  <ShoppingCart size={29} aria-hidden="true" /><span><b>مجموع خرید</b><small>{formatPrice(totalSpent)} تومان پرداخت‌شده</small></span><ChevronLeft size={16} />
                </button>
              </section>

              {activeOrder && (
                <section className="consumer-overview-tracker">
                  <div className="consumer-section-head">
                    <div><span>وضعیت مرسوله</span><h2>آخرین سفارش</h2></div>
                    <bdi dir="ltr" className="consumer-order-chip">{activeOrder.orderNumber}</bdi>
                  </div>
                  <ConsumerOrderTimeline status={activeOrder.status} shippingMethod={activeOrder.shippingMethod} trackingCode={activeOrder.trackingCode} />
                  <div className="consumer-overview-tracker-actions">
                    {resolvedConfig.permissions.allowInvoicePrint && <button type="button" onClick={() => setSelectedReceiptOrder(activeOrder)}><FileText size={15}/> مشاهده فاکتور</button>}
                    {resolvedConfig.permissions.allowQuickReorder && <button type="button" onClick={() => handleReorderItems(activeOrder)}><RefreshCw size={15}/> سفارش مجدد</button>}
                    <button type="button" onClick={() => setActiveTab("orders")}><Truck size={15}/> اطلاعات مرسوله</button>
                  </div>
                </section>
              )}

              {!activeOrder && (
                <section className="consumer-overview-tracker is-awaiting-order" aria-label="پیگیری مرسوله">
                  <div className="consumer-section-head">
                    <div><span>رهگیری سفارش</span><h2><Package size={19} /> آخرین سفارش</h2></div>
                    <span className="consumer-order-chip">هنوز سفارشی ندارید</span>
                  </div>
                  <ol className="consumer-empty-timeline" aria-label="مراحل ارسال سفارش">
                    {[{Icon:ShoppingBag,label:"ثبت سفارش"},{Icon:Package,label:"بسته‌بندی"},{Icon:Truck,label:"ارسال"},{Icon:CheckCircle2,label:"تحویل"}].map(({Icon,label}) => (
                      <li key={label}><span><Icon size={17}/></span><small>{label}</small></li>
                    ))}
                  </ol>
                  <p className="consumer-empty-shipment-note"><Truck size={17}/> به‌محض ثبت اولین سفارش، وضعیت واقعی مرسوله شما اینجا نمایش داده می‌شود.</p>
                </section>
              )}

              <section className="consumer-dash-quick" aria-label="دسترسی سریع">
                <div className="consumer-section-head">
                  <div><span>کارهای روزانه شما</span><h2>دسترسی سریع</h2></div>
                  <button type="button" onClick={() => setActiveTab("quick_buy")}>مشاهده کالاها <ChevronLeft size={16} /></button>
                </div>
                <div className="consumer-dash-quick-grid">
                  {[
                    { id: "orders", title: "سفارش‌های من", Icon: Package },
                    { id: "quick_buy", title: "خرید سریع", Icon: Zap },
                    { id: "receipts", title: "فاکتورها", Icon: FileText },
                    { id: "addresses", title: "آدرس‌ها", Icon: MapPin },
                  ].filter((x) => enabledMenus.some((m) => m.id === x.id)).map(({ id, title, Icon }) => (
                    <button type="button" key={id} onClick={() => setActiveTab(id)}>
                      <Icon size={23} aria-hidden="true" /><span>{title}</span>
                    </button>
                  ))}
                </div>
              </section>
              {/* Quick Product Selection Grid */}
              {resolvedConfig.permissions.allowQuickSkuOrder && (
                <div className="consumer-home-recommendations">
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

                  <div className="consumer-home-product-grid">
                    {!suggestedProducts.length && <p className="consumer-home-no-products" role="status">هنوز کالای قابل نمایش در کاتالوگ منتشر نشده است.</p>}
                    {suggestedProducts.map((prod) => {
                      // A family with many SKUs must not advertise the first SKU's price
                      // as though it were the customer's chosen technical variant.
                      const needsSkuSelection = Boolean(prod.variants?.length);
                      const unitPrice = !needsSkuSelection
                        ? getCurrentCustomerSkuPrice(prod, user, true)
                        : 0;
                      return (
                        <div
                          key={prod.code}
                          className="consumer-home-product-card"
                        >
                          <div className="consumer-home-product-main">
                            <div className="consumer-home-product-photo">
                              <ProductImage
                                src={prod.images?.[0]}
                                alt={prod.name}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="consumer-home-product-info">
                              <span
                                className="inline-block font-mono text-[11px] font-black text-[#E06518]"
                                dir="ltr"
                              >
                                {portalLabel("کد:")}
                                {prod.code}
                              </span>
                              <Link
                                to={`/consumer-dashboard/product/${encodeURIComponent(prod.code)}`}
                                className="block font-black text-xs text-slate-800 hover:text-[#E06518] line-clamp-2 mt-0.5"
                              >
                                {prod.name}
                              </Link>
                            </div>
                          </div>

                          <div className="consumer-home-product-bottom">
                            <div>
                              <span className="text-[10px] text-slate-500 block">
                                {portalLabel("قیمت واحد:")}
                              </span>
                              <span className="font-mono font-black text-xs text-emerald-700">
                                {user?.canViewPrices !== true
                                  ? portalLabel("دسترسی مشاهده قیمت فعال نیست")
                                  : !needsSkuSelection && !prod.inquiryOnly && unitPrice > 0
                                    ? `${formatPrice(unitPrice)} تومان`
                                    : portalLabel("انتخاب کد و استعلام قیمت")}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleQuickAddProduct(prod)}
                              className="consumer-home-add"
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
              <section className="consumer-forza-card">
                <div className="consumer-forza-emblem" aria-hidden="true"><img src={STORE_ASSETS.logoForza} alt="" loading="lazy" decoding="async" /></div>
                <div>
                  <span>مشاور هوشمند صنعت پیش</span>
                  <h2>FORZA کنار شماست</h2>
                  <p>برای انتخاب قطعه، بررسی کد فنی و راهنمایی تخصصی گفتگو کنید.</p>
                </div>
                <Link to="/ai-forza" className="consumer-forza-button">شروع گفتگو <ChevronLeft size={16} /></Link>
              </section>
              <details className="consumer-overview-extra" onToggle={(event) => setExtraOpen(event.currentTarget.open)}>
                <summary>سایر خدمات و گزارش‌های حساب <ChevronLeft size={15}/></summary>
                {extraOpen && <Suspense fallback={panelFallback}><div>
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

              </div></Suspense>}</details>
            </div>
          )}

          {/* ===============================================================
              TAB 2: ORDERS & MY PRICE LIST DOWNLOAD
             =============================================================== */}
          {activeTab === "club_rewards" && (
            <Suspense fallback={panelFallback}>
            <PortalClub
              portal="consumer"
              user={user!}
              texts={resolvedConfig.uiTexts}
              labels={resolvedConfig.labels}
              details
              showChart={resolvedConfig.permissions.showClubBarChart}
            />
            </Suspense>
          )}
          {activeTab === "orders" && (
            <div className="consumer-orders-section bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-xs space-y-5">
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

              <div className="consumer-filter-pills" role="group" aria-label="فیلتر سفارش‌ها">
                {[
                  { key: "all", title: "همه سفارش‌ها", Icon: Layers },
                  { key: "shipped", title: "در حال ارسال", Icon: Truck },
                  { key: "delivered", title: "تحویل‌شده", Icon: CheckCircle2 },
                  { key: "processing", title: "در حال پردازش", Icon: Clock },
                ].map(({ key, title, Icon }) => (
                  <button key={key} type="button" aria-pressed={orderFilter === key}
                    onClick={() => setOrderFilter(key as typeof orderFilter)}>
                    <Icon size={17} aria-hidden="true" />{title}
                  </button>
                ))}
              </div>
              <div className="consumer-summary-duo">
                <div><Package size={23}/><span>تعداد سفارش‌ها</span><strong>{toPersianDigits(orders.length)} سفارش</strong></div>
                <div><ShoppingBag size={23}/><span>مجموع خریدهای پرداخت‌شده</span><strong>{formatPrice(totalSpent)} تومان</strong></div>
              </div>
              {activeOrder && (
                <section className="consumer-order-highlight" aria-label="آخرین سفارش">
                  <div className="consumer-order-highlight-head">
                    <div><span>سفارش ثبت‌شده</span><h3>آخرین سفارش شما</h3></div>
                    <span className="consumer-order-chip" dir="ltr">{activeOrder.orderNumber}</span>
                  </div>
                  <span className="consumer-order-parcel"><ParcelArt /></span>
                  <div className="consumer-order-highlight-details">
                    <span><Truck size={16} /> روش ارسال: {activeOrder.shippingMethod || "ثبت نشده"}</span>
                    {activeOrder.trackingCode &&
                      <span><FileText size={16}/> کد رهگیری: <bdi dir="ltr">{activeOrder.trackingCode}</bdi></span>}
                  </div>
                  <ConsumerOrderTimeline status={activeOrder.status}
                    shippingMethod={activeOrder.shippingMethod} trackingCode={activeOrder.trackingCode} />
                  <div className="consumer-order-highlight-actions">
                    {resolvedConfig.permissions.allowInvoicePrint &&
                      <button type="button" onClick={() => setSelectedReceiptOrder(activeOrder)}><FileText size={17}/> مشاهده فاکتور</button>}
                    {resolvedConfig.permissions.allowQuickReorder &&
                      <button type="button" onClick={() => handleReorderItems(activeOrder)}><RefreshCw size={17}/> سفارش مجدد</button>}
                  </div>
                </section>
              )}
              <div className="consumer-section-head"><div><span>تاریخچه حساب شما</span><h2>سفارش‌های اخیر</h2></div><strong>{toPersianDigits(filteredOrders.length)} مورد</strong></div>
              <div className="space-y-4">
                {filteredOrders.length === 0 && (
                  <p className="rounded-xl bg-slate-50 p-6 text-sm text-slate-500">
                    سفارشی با این وضعیت یافت نشد.
                  </p>
                )}
                {filteredOrders.map((order) => (
                  <article key={order.id} className="consumer-order-reference-card">
                    <div className="consumer-order-ref-photo">
                      {order.items[0] && orderImageByCode.get(order.items[0].code)
                        ? <ProductImage src={orderImageByCode.get(order.items[0].code)}
                            alt={order.items[0].name} thumbnail loading="lazy" decoding="async" />
                        : <Package size={31} aria-hidden="true" />}
                    </div>
                    <div className="consumer-order-ref-details">
                      <strong dir="ltr">{order.orderNumber}</strong>
                      <small>تاریخ ثبت: {new Date(order.date).toLocaleDateString("fa-IR")}</small>
                      <h3>{order.items[0]?.name || "سفارش ثبت‌شده"}</h3>
                      <span>{toPersianDigits(order.items.length)} قلم کالا</span>
                      <b>{formatPrice(order.totalAmount)} تومان</b>
                    </div>
                    <div className="consumer-order-ref-status">
                      <span className={order.status === "delivered" ? "is-delivered" : order.status === "shipped" ? "is-shipped" : "is-processing"}>
                        {order.status === "delivered" ? <CheckCircle2 size={15}/> : order.status === "shipped" ? <Truck size={15}/> : <Clock size={15}/>}
                        {orderStatusLabels[order.status]}
                      </span>
                      <div>
                        {resolvedConfig.permissions.allowInvoicePrint && (
                          <button type="button" onClick={() => setSelectedReceiptOrder(order)}><FileText size={15} /> مشاهده فاکتور</button>
                        )}
                        {resolvedConfig.permissions.allowQuickReorder && (
                          <button type="button" onClick={() => handleReorderItems(order)}><RefreshCw size={15} /> سفارش مجدد</button>
                        )}
                      </div>
                    </div>
                    <details className="consumer-order-ref-more">
                      <summary>جزئیات سفارش و اقلام <ChevronLeft size={14}/></summary>
                      <div>
                        {order.shippingMethod && <p>روش ارسال: {order.shippingMethod}</p>}
                        {order.trackingCode && <p>کد رهگیری: <bdi dir="ltr">{order.trackingCode}</bdi></p>}
                        <ul>{order.items.map((it, idx) => (
                          <li key={idx}><bdi dir="ltr">{it.code}</bdi><span>{it.name}</span><small>{toPersianDigits(it.quantity)} {it.unit} × {formatPrice(it.unitPrice)} تومان</small></li>
                        ))}</ul>
                      </div>
                    </details>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* ===============================================================
              TAB 3: QUICK ORDER BY SKU CODE & CATEGORY
             =============================================================== */}
          {activeTab === "quick_buy" && (
            <section className="consumer-quickbuy-panel" aria-busy={quickSkuQuery !== deferredQuickSkuQuery}>
              <div className="consumer-quickbuy-search">
                <div>
                  <span className="consumer-eyebrow">خرید با کد فنی</span>
                  <h2>قطعه موردنیازتان را پیدا کنید</h2>
                  <p>نام قطعه، برند یا کد فنی را جستجو کنید. مشخصات هر کد را پیش از سفارش بررسی کنید.</p>
                </div>
                <label className="consumer-search-field">
                  <Search size={22} aria-hidden="true" />
                  <span className="sr-only">جستجوی قطعه</span>
                  <input type="search" value={quickSkuQuery}
                    onChange={(e) => setQuickSkuQuery(e.target.value)}
                    placeholder="نام محصول یا کد فنی…" />
                  {quickSkuQuery && <button type="button" onClick={() => setQuickSkuQuery("")} aria-label="پاک کردن جستجو">×</button>}
                </label>
              </div>
              {quickSkuQuery !== deferredQuickSkuQuery && <p className="consumer-search-pending" role="status">در حال به‌روزرسانی نتایج جستجو…</p>}
              <div className="consumer-categories" role="group" aria-label="فیلتر دسته‌بندی کالا">
                <button type="button" aria-pressed={selectedCategorySlug === "all"}
                  onClick={() => setSelectedCategorySlug("all")}><Layers size={17}/> همه دسته‌ها</button>
                {availableCategories.map((cat) => (
                  <button type="button" key={cat.slug}
                    aria-pressed={selectedCategorySlug === cat.slug}
                    onClick={() => setSelectedCategorySlug(cat.slug)}>{cat.name}</button>
                ))}
              </div>
              <div className="consumer-section-head">
                <div><span>کاتالوگ صنعت پیش</span><h2>محصولات و کدهای فنی</h2></div>
                <small aria-live="polite">{toPersianDigits(catalogProducts.length)} محصول یافت شد</small>
              </div>
              {catalogProducts.length ? (
                <div className="consumer-quickbuy-grid">
                  {catalogProducts.slice(0, visibleProductCount).map((prod) => {
                    const firstVar = (prod.variants || [])[0];
                    const needsSelection = Boolean(prod.variants?.length);
                    const unitPrice = !needsSelection
                      ? getCurrentCustomerSkuPrice(prod, user, true)
                      : 0;
                    return (
                      <article key={prod.code} className="consumer-quickbuy-card">
                        <Link className="consumer-quickbuy-media"
                          to={`/consumer-dashboard/product/${encodeURIComponent(prod.code)}`}
                          aria-label={`مشاهده ${prod.name}`}>
                          <ProductImage src={prod.images?.[0]} alt={prod.name}
                            loading="lazy" decoding="async" thumbnail />
                        </Link>
                        <div className="consumer-quickbuy-card-copy">
                          <span className="consumer-sku" dir="ltr">{firstVar?.code || prod.code}</span>
                          <h3><Link to={`/consumer-dashboard/product/${encodeURIComponent(prod.code)}`}>{prod.name}</Link></h3>
                          <p>{prod.categoryName || "قطعه صنعتی"}</p>
                          <div className="consumer-quickbuy-price">
                            <span>{user?.canViewPrices !== true
                              ? "دسترسی مشاهده قیمت فعال نیست"
                              : !needsSelection && !prod.inquiryOnly && unitPrice > 0
                                ? `${formatPrice(unitPrice)} تومان`
                                : "انتخاب کد و استعلام قیمت"}</span>
                          </div>
                        </div>
                        <button type="button" className="consumer-product-cta"
                          onClick={() => handleQuickAddProduct(prod)}>
                          <Plus size={16} />
                          {needsSelection ? "انتخاب کد کالا" : "مشاهده و سفارش"}
                        </button>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="consumer-empty">
                  <Search size={29}/>
                  <h3>کالایی با این جستجو پیدا نشد</h3>
                  <p>نام یا کد فنی دیگری امتحان کنید یا تمام دسته‌ها را نمایش دهید.</p>
                  <button type="button" onClick={() => { setQuickSkuQuery(""); setSelectedCategorySlug("all"); }}>نمایش همه محصولات</button>
                </div>
              )}
              {catalogProducts.length > visibleProductCount && (
                <button type="button" className="consumer-more-products" onClick={() => setVisibleProductCount((count) => count + 6)}>
                  نمایش محصولات بیشتر <ChevronLeft size={17} />
                </button>
              )}
              <div className="consumer-quickbuy-footer">
                {resolvedConfig.permissions.allowExcelPriceListDownload && (
                  <button type="button" className="consumer-excel-shortcut" onClick={handleDownloadMyPriceListExcel}>
                    <FileSpreadsheet size={29}/><span><strong>دانلود اکسل لیست قیمت من</strong><small>در صورت انتشار لیست قیمت برای حساب شما</small></span><ChevronLeft size={19}/>
                  </button>
                )}
                {enabledMenus.some((m) => m.id === "purchase_list") && (
                  <button type="button" className="consumer-multicode-shortcut" onClick={() => setActiveTab("purchase_list")}>
                    <Layers size={29}/><span><strong>سفارش سریع با چند کد کالا</strong><small>کدها و تعدادها را یکجا وارد و بررسی کنید</small></span><ChevronLeft size={19}/>
                  </button>
                )}
              </div>
            </section>
          )}

          {/* ===============================================================
              TAB 4: RECEIPTS & INVOICES
             =============================================================== */}
          {activeTab === "receipts" && (
            <section className="consumer-invoices-panel">
              <div className="consumer-section-head">
                <div><span>اسناد سفارش‌های شما</span><h2>فاکتورها و رسیدهای خرید</h2></div>
                {resolvedConfig.permissions.allowExcelPriceListDownload &&
                  <button type="button" className="consumer-inline-action" onClick={handleDownloadMyPriceListExcel}>
                    <FileSpreadsheet size={17}/> اکسل لیست قیمت من
                  </button>}
              </div>
              <div className="consumer-invoices-summary">
                <div className="consumer-invoice-illustration"><InvoiceArt /></div>
                <div><FileText size={21}/><span>کل فاکتورها</span><strong>{toPersianDigits(orders.length)}</strong></div>
                <div><CheckCircle2 size={21}/><span>پرداخت تأییدشده</span><strong>{toPersianDigits(paidCount)}</strong></div>
                <div><Clock size={21}/><span>در انتظار پرداخت یا تأیید</span><strong>{toPersianDigits(orders.length - paidCount)}</strong></div>
              </div>
              <div className="consumer-filter-pills" role="group" aria-label="فیلتر فاکتورها">
                {[
                  { id: "all", title: "همه فاکتورها" },
                  { id: "paid", title: "پرداخت‌شده" },
                  { id: "pending", title: "در انتظار تأیید" },
                ].map((item) => (
                  <button type="button" key={item.id} aria-pressed={receiptFilter === item.id}
                    onClick={() => setReceiptFilter(item.id as typeof receiptFilter)}>{item.title}</button>
                ))}
              </div>
              {filteredReceipts.length ? (
                <div className="consumer-invoice-rows">
                  {filteredReceipts.map((o) => (
                    <article className="consumer-invoice-row" key={o.id}>
                      <div className="consumer-invoice-row-icon"><FileText size={23} /></div>
                      <div className="consumer-invoice-identity"><small>شماره فاکتور / سفارش</small><strong dir="ltr">{o.orderNumber}</strong></div>
                      <div className="consumer-invoice-date"><small>تاریخ ثبت</small><span>{new Date(o.date).toLocaleDateString("fa-IR")}</span></div>
                      <div className="consumer-invoice-amount"><small>مبلغ کل</small><strong>{formatPrice(o.totalAmount)} تومان</strong></div>
                      <div className="consumer-invoice-state">
                        <span className={o.paymentStatus === "paid" ? "is-paid" : "is-pending"}>
                          {o.paymentStatus === "paid" ? <CheckCircle2 size={15}/> : <Clock size={15}/>}
                          {o.paymentStatus === "paid" ? "پرداخت تأییدشده" : o.paymentStatus === "awaiting_payment" ? "در انتظار پرداخت" : "در انتظار تأیید"}
                        </span>
                      </div>
                      <button type="button" className="consumer-inline-action"
                        onClick={() => setSelectedReceiptOrder(o)}><FileText size={17}/> مشاهده و چاپ</button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="consumer-empty"><FileText size={29}/><h3>فاکتوری در این وضعیت وجود ندارد</h3><p>پس از ثبت سفارش، جزئیات خرید را اینجا می‌بینید.</p></div>
              )}
              {orders[0] && (
                <section className="consumer-invoice-preview" aria-label="پیش‌نمایش آخرین فاکتور">
                  <div className="consumer-section-head">
                    <div><span>بر اساس سفارش ثبت‌شده</span><h2><FileText size={21} aria-hidden="true" /> پیش‌نمایش فاکتور</h2></div>
                    <button type="button" onClick={() => setSelectedReceiptOrder(orders[0])}>مشاهده کامل <ChevronLeft size={16} /></button>
                  </div>
                  <div className="consumer-invoice-paper">
                    <header><div><strong><Layers size={24} /> صنعت پیش</strong><small>Sanat Pish</small></div><div><b>فاکتور فروش</b><span>Invoice</span></div></header>
                    <div className="consumer-invoice-paper-meta">
                      <span>شماره سفارش: <bdi dir="ltr">{orders[0].orderNumber}</bdi></span>
                      <span>تاریخ: {new Date(orders[0].date).toLocaleDateString("fa-IR")}</span>
                      <span>خریدار: {user?.fullName || "مشتری صنعت پیش"}</span>
                    </div>
                    <div className="consumer-invoice-paper-scroll">
                      <table><thead><tr><th>شرح کالا</th><th>تعداد</th><th>قیمت واحد</th><th>مبلغ</th></tr></thead>
                        <tbody>{orders[0].items.map((item, i) => (
                          <tr key={i}><td>{item.name}<small dir="ltr">{item.code}</small></td><td>{toPersianDigits(item.quantity)}</td><td>{formatPrice(item.unitPrice)}</td><td>{formatPrice(item.unitPrice * item.quantity)}</td></tr>
                        ))}</tbody>
                      </table>
                    </div>
                    <footer><strong>مبلغ ثبت‌شده: {formatPrice(orders[0].totalAmount)} تومان</strong><span className={orders[0].paymentStatus === "paid" ? "is-paid" : "is-pending"}>{orders[0].paymentStatus === "paid" ? "پرداخت تأییدشده" : "در انتظار تأیید پرداخت"}</span></footer>
                  </div>
                </section>
              )}
              <p className="consumer-document-note">اطلاعات نمایش‌داده‌شده از سفارش‌های ثبت‌شده حساب شما خوانده می‌شوند؛ تأیید پرداخت فقط مطابق وضعیت ثبت‌شده در سامانه نمایش داده می‌شود.</p>
            </section>
          )}

          {/* ===============================================================
              TAB 5: SHIPPING ADDRESSES
             =============================================================== */}
          {activeTab === "addresses" && (
            <section className="consumer-address-panel">
              <div className="consumer-address-profile">
                <div className="consumer-avatar" aria-hidden="true"><User size={34}/></div>
                <div><span>اطلاعات حساب مصرف‌کننده</span><h2>{user?.fullName || "حساب مشتری"}</h2><bdi dir="ltr">{user?.phone || "شماره تماس ثبت نشده"}</bdi></div>
                <span className="consumer-role-tag">حساب مصرف‌کننده</span>
              </div>
              <div className="consumer-section-head">
                <div><span>{toPersianDigits(addresses.length)} نشانی ثبت‌شده</span><h2>آدرس‌های من</h2></div>

              </div>
              {isAddingAddress && (
                <form onSubmit={handleAddAddress} className="consumer-address-form">
                  <h3>{editingAddressId ? "ویرایش آدرس" : "ثبت آدرس جدید"}</h3>
                  <div className="consumer-address-fields">
                    <label>عنوان آدرس <input type="text" required value={newAddress.title}
                      onChange={(e) => setNewAddress({ ...newAddress, title: e.target.value })}
                      placeholder="خانه، محل کار یا انبار" /></label>
                    <label>نام تحویل‌گیرنده <input type="text" required value={newAddress.receiver}
                      onChange={(e) => setNewAddress({ ...newAddress, receiver: e.target.value })}
                      placeholder="نام و نام خانوادگی" /></label>
                    <label>شماره تماس <input type="tel" dir="ltr" inputMode="tel" value={newAddress.phone}
                      onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                      placeholder="شماره تلفن گیرنده" /></label>
                    <label>شهر <input type="text" required value={newAddress.city}
                      onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                      placeholder="نام شهر" /></label>
                    <label>کد پستی <input type="text" inputMode="numeric" dir="ltr" value={newAddress.postalCode}
                      onChange={(e) => setNewAddress({ ...newAddress, postalCode: e.target.value })}
                      placeholder="کد پستی" /></label>
                    <label className="is-wide">نشانی دقیق <textarea rows={3} required value={newAddress.fullAddress}
                      onChange={(e) => setNewAddress({ ...newAddress, fullAddress: e.target.value })}
                      placeholder="خیابان، پلاک، واحد و توضیحات تحویل" /></label>
                  </div>
                  <div className="consumer-address-form-actions">
                    <button type="submit"><CheckCircle2 size={17}/> ذخیره آدرس</button>
                    <button type="button" onClick={() => { setIsAddingAddress(false); setEditingAddressId(null); }}>انصراف</button>
                  </div>
                </form>
              )}
              {addresses.length ? (
                <div className="consumer-address-grid">
                  {addresses.map((address) => (
                    <article key={address.id} className={address.isDefault ? "consumer-address-card is-default" : "consumer-address-card"}>
                      <div className="consumer-address-card-top">
                        <span className="consumer-address-icon"><MapPin size={22}/></span>
                        <h3>{address.title}</h3>
                        {address.isDefault && <span className="consumer-default-tag"><CheckCircle2 size={15}/> آدرس پیش‌فرض</span>}
                      </div>
                      <div className="consumer-address-info">
                        <span><MapPin size={17}/>{address.city || "شهر ثبت نشده"}</span>
                        <span><User size={17}/> {address.receiver || "تحویل‌گیرنده ثبت نشده"}</span>
                        {address.phone && <span><CreditCard size={17}/><bdi dir="ltr">{address.phone}</bdi></span>}
                      </div>
                      <p className="consumer-address-full">{address.fullAddress}</p>
                      {address.postalCode && <p className="consumer-postcode">کد پستی: <bdi dir="ltr">{address.postalCode}</bdi></p>}
                      <div className="consumer-address-actions">
                        <button type="button" onClick={() => handleEditAddress(address)}><FileText size={16}/> ویرایش</button>
                        <button type="button" aria-pressed={Boolean(address.isDefault)} disabled={Boolean(address.isDefault)}
                          onClick={() => handleSetDefaultAddress(address.id)}>
                          <CheckCircle2 size={16}/>{address.isDefault ? "انتخاب‌شده" : "انتخاب به عنوان پیش‌فرض"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="consumer-empty"><MapPin size={29}/><h3>هنوز آدرسی ثبت نشده است</h3><p>برای دریافت سفارش، اولین نشانی تحویل خود را اضافه کنید.</p></div>
              )}
                <button type="button" className="consumer-address-add" aria-expanded={isAddingAddress}
                  onClick={() => {
                    setEditingAddressId(null);
                    setNewAddress({ title: "", receiver: "", phone: "", city: "", postalCode: "", fullAddress: "" });
                    setIsAddingAddress(!isAddingAddress);
                  }}>
                  <Plus size={17}/>{isAddingAddress ? "بستن فرم" : "افزودن آدرس جدید"}
                </button>
              <aside className="consumer-address-delivery-note">
                <LocationArt />
                <div><h3>ثبت سریع اطلاعات تحویل</h3><p>برای ارسال دقیق سفارش‌ها، اطلاعات گیرنده، شهر و نشانی تحویل را تکمیل کنید.</p></div>
              </aside>
            </section>
          )}
        </div>

        {/* Printable Invoice Modal */}
        {selectedReceiptOrder && (
          <div ref={receiptDialogRef} role="dialog" aria-modal="true" aria-label="جزئیات و چاپ فاکتور"
            tabIndex={-1} onKeyDown={(e) => { if (e.key === "Escape") setSelectedReceiptOrder(null); }}
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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
                      {portalLabel("صنعت پیش")}
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
                    <div className={`font-bold mt-0.5 ${selectedReceiptOrder.paymentStatus === "paid" ? "text-emerald-700" : "text-amber-700"}`}>
                      {selectedReceiptOrder.paymentStatus === "paid" ? portalLabel("پرداخت تأییدشده")
                                        : portalLabel("پرداخت در انتظار تأیید")}
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

                <div className={`p-3.5 rounded-2xl border flex items-center justify-between font-black text-sm ${selectedReceiptOrder.paymentStatus === "paid" ? "bg-emerald-50 border-emerald-200 text-emerald-950" : "bg-slate-50 border-slate-200 text-slate-900"}`}>
                  <span>{portalLabel("مبلغ کل سفارش:")}</span>
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
