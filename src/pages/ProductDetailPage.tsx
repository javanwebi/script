import { portalContentService } from "../services/portalContentService";
import {
  MemberAccess,
  memberPath,
} from "../components/storefront/MemberAccess";
import { ProductVariants } from "../components/product/ProductVariants";
import { ProductImage } from "../components/product/ProductImage";
import React, { useState, useEffect, useMemo } from "react";
import {
  useParams,
  Link,
  useSearchParams,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  getProductByCode,
  getSimilarProducts,
  buildDefaultGalleryImages,
  subscribeCatalogChanges,
} from "../data/mockGenerator";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { toPersianDigits, getStockStatus } from "../utils/formatters";
import {
  ChevronLeft,
  ShieldCheck,
  PhoneCall,
  ShoppingCart,
  Check,
  Truck,
  FileSpreadsheet,
  AlertCircle,
  Heart,
  Share2,
  Copy,
  Sparkles,
  Layers,
  Award,
  PackageCheck,
  Printer,
  ArrowUpRight,
  Shield,
  CheckCircle2,
  Eye,
  Link2,
  Image as ImageIcon,
} from "lucide-react";
import { Modal } from "../components/ui/Modal";
import { ProductCard } from "../components/product/ProductCard";
import { pricingCreditService } from "../services/pricingCreditService";
import { adminService } from "../services/adminService";

export const ProductDetailPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { code } = useParams<{ code: string }>();
  const [searchParams] = useSearchParams();
  const isPreviewMode =
    searchParams.get("preview") === "1" || !!adminService.getCurrentAdmin();

  const { currentUser, openAuthModal } = useAuth();
  const buyingAllowed = currentUser
    ? portalContentService.getResolvedConfigForCustomer(
        currentUser.approvedB2B ? "high_volume" : "consumer",
        currentUser.id,
      ).permissions.allowQuickSkuOrder !== false
    : false;
  const canViewCommercial =
    buyingAllowed &&
    !!currentUser &&
    (location.pathname.startsWith("/account/") ||
      location.pathname.startsWith("/consumer-dashboard/"));
  const continueInPanel = () =>
    currentUser
      ? navigate(memberPath(currentUser, selectedVariantCode || code))
      : openAuthModal(
          memberPath(currentUser, selectedVariantCode || code),
          "register",
        );
  const { addToCart, submitInquiry } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();

  const [catalogTick, setCatalogTick] = useState(0);
  useEffect(() => {
    return subscribeCatalogChanges(() => setCatalogTick((t) => t + 1));
  }, []);

  const decodedCode = code ? decodeURIComponent(code).trim() : "";
  const product = useMemo(
    () =>
      decodedCode
        ? getProductByCode(decodedCode, { includeInactive: isPreviewMode })
        : undefined,
    [decodedCode, isPreviewMode, catalogTick],
  );

  // Visible variants (filter out inactive unless in preview mode)
  const visibleVariants = useMemo(() => {
    if (!product?.variants) return [];
    return isPreviewMode
      ? product.variants
      : product.variants.filter((v) => v.active !== false);
  }, [product, isPreviewMode]);

  // Structured gallery images with scope ('family' vs 'variant') and variantCode
  const galleryImages = useMemo(() => {
    if (!product) return [];
    const allImgs = buildDefaultGalleryImages(product);
    if (isPreviewMode) return allImgs;
    // Hide images belonging to inactive variants for public visitors
    const activeCodes = new Set(visibleVariants.map((v) => v.code));
    return allImgs.filter(
      (img) =>
        img.scope === "family" ||
        !img.variantCode ||
        activeCodes.has(img.variantCode),
    );
  }, [product, visibleVariants, isPreviewMode]);

  const [selectedVariantCode, setSelectedVariantCode] = useState("");
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [inquiryNotes, setInquiryNotes] = useState("");
  const [inquirySubmitted, setInquirySubmitted] = useState(false);
  const [inquiryBusy, setInquiryBusy] = useState(false);
  const [inquiryError, setInquiryError] = useState("");
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isInquiring, setIsInquiring] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "specs" | "catalogue" | "delivery"
  >("specs");

  // Initialize selected variant & matching image when URL code or family changes
  useEffect(() => {
    if (!product) return;
    const matchedFromUrl = visibleVariants.find(
      (v) => v.code.toLowerCase() === decodedCode.toLowerCase(),
    );
    const initialCode = matchedFromUrl?.code || visibleVariants[0]?.code || "";
    setSelectedVariantCode(initialCode);

    if (initialCode) {
      const variantImgIdx = galleryImages.findIndex(
        (img) => img.scope === "variant" && img.variantCode === initialCode,
      );
      // A family photograph may be shown as a clearly labelled general reference,
      // but must never be represented as a verified photo of the selected SKU.
      const familyImgIdx = galleryImages.findIndex((img) => img.scope === "family");
      setActiveImageIndex(variantImgIdx >= 0 ? variantImgIdx : familyImgIdx);
    } else {
      setActiveImageIndex(galleryImages.length ? 0 : -1);
    }
  }, [decodedCode, product?.code, visibleVariants.length, galleryImages]);

  // 1. Customer selects a SKU code -> show image, specs, and price of that SKU
  const handleSelectVariant = (newVariantCode: string) => {
    setSelectedVariantCode(newVariantCode);
    setQuantity(1);

    const currentImg = galleryImages[activeImageIndex];
    // If current image is already linked to this exact SKU, keep it (do not jump)
    if (
      currentImg &&
      currentImg.scope === "variant" &&
      currentImg.variantCode === newVariantCode
    ) {
      return;
    }

    // Find first image linked to this SKU
    const firstLinkedIdx = galleryImages.findIndex(
      (img) => img.scope === "variant" && img.variantCode === newVariantCode,
    );
    if (firstLinkedIdx >= 0) {
      setActiveImageIndex(firstLinkedIdx);
      return;
    }

    // Keep the family's general image visible, labelled as a family reference.
    // Never substitute another SKU's photo or claim this is SKU verified.
    setActiveImageIndex(galleryImages.findIndex((img) => img.scope === "family"));
  };

  // 2. Customer clicks an image -> if linked to a SKU, automatically select that SKU;
  //    if multiple images belong to the same SKU, switching between them keeps that SKU;
  //    if it is a general family image, do NOT change the selected SKU.
  const handleSelectImage = (idx: number) => {
    setActiveImageIndex(idx);
    const clickedImg = galleryImages[idx];
    if (!clickedImg) return;

    if (clickedImg.scope === "variant" && clickedImg.variantCode) {
      const targetExists = visibleVariants.some(
        (v) => v.code === clickedImg.variantCode,
      );
      if (targetExists && selectedVariantCode !== clickedImg.variantCode) {
        setSelectedVariantCode(clickedImg.variantCode);
        setQuantity(1);
      }
    }
    // When clickedImg.scope === 'family', we deliberately keep selectedVariantCode unchanged.
  };

  if (!product) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4 max-w-xl mx-auto my-12 shadow-xs">
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-bold text-[#55565A]">
          کالای مورد نظر یافت نشد
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          کد کالای وارد شده در کاتالوگ جامع قطعات ثبت نشده است یا ممکن است
          موقتاً غیرفعال شده باشد.
        </p>
        <Link
          to="/products"
          className="inline-flex px-6 py-2.5 bg-[#E06518] text-white text-xs font-bold rounded-xl hover:bg-[#C95210] transition-colors shadow-xs"
        >
          بازگشت به کاتالوگ محصولات
        </Link>
      </div>
    );
  }

  const selectedVariant =
    visibleVariants.find((v) => v.code === selectedVariantCode) ||
    visibleVariants[0];

  // SKU-owned pricing & stock resolution
  const baseUnitPrice = selectedVariant
    ? (selectedVariant.price ?? selectedVariant.prices?.retail ?? 0)
    : (product.prices?.retail ?? 0);

  const customerPriceList = currentUser
    ? pricingCreditService.getPriceListForCustomer(currentUser)
    : undefined;
  const skuPrice = (sku: string, base: number) =>
    customerPriceList
      ? pricingCreditService.getSkuPriceForList(sku, base, customerPriceList)
      : currentUser?.approvedB2B
        ? 0
        : base;
  const activeUnitPrice = skuPrice(
    selectedVariant?.code || product.code,
    baseUnitPrice,
  );

  const isSelectedInquiryOnly = selectedVariant
    ? selectedVariant.inquiryOnly !== undefined
      ? selectedVariant.inquiryOnly
      : activeUnitPrice <= 0
    : product.inquiryOnly || activeUnitPrice <= 0;

  const isSelectedStockKnown = selectedVariant
    ? selectedVariant.stockKnown !== undefined
      ? selectedVariant.stockKnown
      : typeof selectedVariant.stock === "number" && !isSelectedInquiryOnly
    : product.stockKnown !== false;

  const activeStockCount = selectedVariant
    ? (selectedVariant.stock ?? 0)
    : (product.stock ?? 0);

  const stockInfo = !isSelectedStockKnown
    ? { text: "موجودی نیازمند استعلام", badgeBg: "#94a3b8" }
    : getStockStatus(activeStockCount);

  const activeBrand = selectedVariant?.brand || product.brand || "ثبت نشده";
  const activeUnit = selectedVariant?.unit || product.unit || "عدد";
  const activeVariantSpecs = selectedVariant?.technicalSpecs || [];

  // Combined technical specs for cart/inquiry payload
  const combinedSpecs = [
    ...(selectedVariant?.size
      ? [{ key: "سایز انتخاب‌شده", value: selectedVariant.size }]
      : []),
    ...(selectedVariant?.model
      ? [{ key: "مدل فنی", value: selectedVariant.model }]
      : []),
    ...activeVariantSpecs,
    ...(product.technicalSpecs || []),
  ];

  const requestedProduct = selectedVariant
    ? {
        ...product,
        code: selectedVariant.code,
        name: selectedVariant.name || product.name,
        brand: activeBrand,
        unit: activeUnit,
        prices: {
          base: activeUnitPrice,
          retail: activeUnitPrice,
          wholesale: activeUnitPrice,
          dealer: activeUnitPrice,
        },
        stock: activeStockCount,
        inquiryOnly: isSelectedInquiryOnly,
        images:
          selectedVariant.images && selectedVariant.images.length > 0
            ? selectedVariant.images
            : galleryImages.filter(img => img.scope === "variant" && img.variantCode === selectedVariant.code).map(img => img.url),
        technicalSpecs: combinedSpecs,
      }
    : {
        ...product,
        prices: {
          base: activeUnitPrice,
          retail: activeUnitPrice,
          wholesale: activeUnitPrice,
          dealer: activeUnitPrice,
        },
      };

  const isFavorited = isInWishlist(product.code);
  const similarProducts = getSimilarProducts(product, 4);
  const currentGalleryImage =
    galleryImages[activeImageIndex];

  // Images connected to the currently selected variant
  const selectedVariantImagesCount = selectedVariant
    ? galleryImages.filter(
        (g) => g.scope === "variant" && g.variantCode === selectedVariant.code,
      ).length
    : 0;

  const handleAddToCart = () => {
    if (!canViewCommercial) {
      continueInPanel();
      return;
    }
    if (isSelectedInquiryOnly || activeUnitPrice <= 0) {
      setIsInquiryModalOpen(true);
      return;
    }
    addToCart(requestedProduct, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleInquirePriceClick = () => {
    if (!canViewCommercial) {
      continueInPanel();
      return;
    }
    setIsInquiryModalOpen(true);
  };

  const handleInquirySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canViewCommercial) {
      continueInPanel();
      return;
    }
    setInquiryBusy(true);
    setInquiryError("");
    try {
      await submitInquiry(requestedProduct, quantity, inquiryNotes);
    } catch (error) {
      setInquiryError(
        error instanceof Error ? error.message : "ثبت استعلام انجام نشد.",
      );
      return;
    } finally {
      setInquiryBusy(false);
    }
    setInquirySubmitted(true);
    setTimeout(() => {
      setInquirySubmitted(false);
      setIsInquiryModalOpen(false);
    }, 1400);
  };

  const copyProductCode = () => {
    navigator.clipboard.writeText(requestedProduct.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: requestedProduct.name,
          text: `${requestedProduct.name} (کد کالا: ${requestedProduct.code}) - صنعت پیش اطلس`,
          url: window.location.href,
        });
        return;
      } catch {
        // Fallback
      }
    }
    if (typeof navigator !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="product-detail-page space-y-6 lg:space-y-8 pb-24 lg:pb-12 text-right"
      dir="rtl"
    >
      {canViewCommercial && (
        <Link
          className="portal-product-back store-btn-secondary"
          to={currentUser?.approvedB2B ? "/account" : "/consumer-dashboard"}
        >
          بازگشت به پنل من
        </Link>
      )}
      {/* Preview / Inactive Banner for Site Manager */}
      {(product.active === false ||
        selectedVariant?.active === false ||
        searchParams.get("preview") === "1") && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 px-5 flex items-center justify-between gap-3 flex-wrap text-xs text-amber-900">
          <div className="flex items-center gap-2 font-bold">
            <Eye className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              حالت پیش‌نمایش مدیر سایت:
              {product.active === false
                ? " این خانواده محصول در حال حاضر «غیرفعال موقت» است و فقط برای شما نمایش داده می‌شود."
                : selectedVariant?.active === false
                  ? ` کد کالای ${selectedVariant.code} «غیرفعال موقت» است.`
                  : " در حال بررسی رابطهٔ دوطرفهٔ کد کالا، تصویر و قیمت پیش از انتشار نهایی هستید."}
            </span>
          </div>
          <Link
            to="/admin"
            className="px-3 py-1.5 rounded-lg bg-amber-800 text-white font-bold hover:bg-amber-900 transition-colors"
          >
            بازگشت به پنل مدیریت
          </Link>
        </div>
      )}

      {/* 1. BREADCRUMB & UTILITY ACTIONS */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <nav className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto no-scrollbar py-1">
          <Link
            to="/"
            className="hover:text-[#E06518] transition-colors shrink-0"
          >
            صفحه اصلی
          </Link>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <Link
            to="/products"
            className="hover:text-[#E06518] transition-colors shrink-0"
          >
            محصولات
          </Link>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <Link
            to={`/category/${product.categorySlug}`}
            className="hover:text-[#E06518] transition-colors shrink-0 max-w-[140px] sm:max-w-none truncate"
          >
            {product.categoryName}
          </Link>
          <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-[#55565A] font-bold shrink-0">
            {product.name}
          </span>
          {selectedVariant && (
            <>
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span
                className="text-[#E06518] font-bold font-mono shrink-0"
                dir="ltr"
              >
                {selectedVariant.code}
              </span>
            </>
          )}
        </nav>

        {/* Quick Utilities */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleShare}
            className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-[#55565A] bg-white hover:bg-slate-50 border border-slate-200/80 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="اشتراک‌گذاری قطعه"
          >
            <Share2 className="w-3.5 h-3.5 text-slate-400" />
            <span className="hidden sm:inline">
              {copiedLink ? "پیوند کپی شد" : "اشتراک‌گذاری"}
            </span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="h-8 px-2.5 text-xs font-medium text-slate-600 hover:text-[#55565A] bg-white hover:bg-slate-50 border border-slate-200/80 rounded-lg transition-colors hidden sm:flex items-center gap-1.5 cursor-pointer shadow-2xs"
            title="چاپ شناسنامه فنی قطعه"
          >
            <Printer className="w-3.5 h-3.5 text-slate-400" />
            <span>چاپ شناسنامه فنی</span>
          </button>
        </div>
      </div>

      {/* 2. MAIN PRODUCT DETAIL HERO CONTAINER */}
      <div className="product-detail-main bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-6 lg:p-8">
        <div className="product-detail-layout">
          {/* Left: Gallery with Two-Way SKU Binding (Sticky on Desktop) */}
          <div className="product-detail-gallery space-y-3.5">
            <div className="product-detail-image relative w-full pt-[82%] bg-gradient-to-b from-slate-50/70 to-white border border-slate-200/90 rounded-2xl overflow-hidden group flex items-center justify-center">
              <ProductImage
                src={currentGalleryImage?.url}
                alt={currentGalleryImage?.title || requestedProduct.name}
                className="absolute inset-0 w-full h-full object-contain p-6 sm:p-8 group-hover:scale-105 transition-transform duration-300"
              />

              {/* Top Scope Badge on Main Image: Distinguishes SKU-Specific Image vs General Family Image */}
              {currentGalleryImage && (
                <div className="absolute top-3 right-3 left-3 flex items-center justify-between gap-2 pointer-events-none">
                  {currentGalleryImage.scope === "variant" &&
                  currentGalleryImage.variantCode ? (
                    <span className="inline-flex items-center gap-1.5 bg-[#E06518] text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-xs">
                      <Link2 className="w-3.5 h-3.5" />
                      <span>تصویر کد {currentGalleryImage.variantCode}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 bg-slate-800/85 text-white text-[11px] font-medium px-3 py-1 rounded-lg shadow-xs">
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>تصویر عمومی خانواده محصول</span>
                    </span>
                  )}

                  {galleryImages.length > 1 && (
                    <span className="bg-white/90 border border-slate-200 text-slate-700 text-[10.5px] font-bold px-2.5 py-1 rounded-lg shadow-2xs">
                      {toPersianDigits(activeImageIndex + 1)} از{" "}
                      {toPersianDigits(galleryImages.length)}
                    </span>
                  )}
                </div>
              )}

              {/* Bottom Caption */}
              {currentGalleryImage && (
                <div className="absolute bottom-3 right-3 left-3 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] px-3 py-1.5 rounded-xl font-medium shadow-xs flex items-center justify-between gap-2">
                  <span className="truncate">
                    {currentGalleryImage.title ||
                      (currentGalleryImage.scope === "variant" &&
                      currentGalleryImage.variantCode
                        ? `تصویر اختصاصی متصل به کد کالای ${currentGalleryImage.variantCode}`
                        : `تصویر عمومی خانواده ${product.name}`)}
                  </span>
                </div>
              )}
            </div>

            {!currentGalleryImage && selectedVariant && (
              <p role="status" className="text-xs text-slate-600 leading-6 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                تصویر اختصاصی کد <strong dir="ltr">{selectedVariant.code}</strong> هنوز تأیید و ثبت نشده است. مشخصات زیر مربوط به همین کد است.
              </p>
            )}
            {/* Scope Notice */}
            {currentGalleryImage?.scope === "family" ? (
              <p className="text-xs text-slate-500 leading-6 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-2">
                این یک <strong>تصویر عمومی خانوادهٔ محصول</strong> است؛ مشاهدهٔ
                آن کد کالای انتخاب‌شده را تغییر نمی‌دهد.
              </p>
            ) : currentGalleryImage?.scope === "variant" &&
              currentGalleryImage.variantCode ? (
              <p className="text-xs text-emerald-900 leading-6 bg-emerald-50/80 border border-emerald-200 rounded-xl px-3 py-2 flex items-center justify-between gap-2">
                <span>
                  این تصویر مستقیماً به کد کالای{" "}
                  <strong className="font-mono" dir="ltr">
                    {currentGalleryImage.variantCode}
                  </strong>{" "}
                  متصل است.
                </span>
                {selectedVariantImagesCount > 1 && (
                  <span className="text-[11px] font-bold text-emerald-700 shrink-0">
                    ({toPersianDigits(selectedVariantImagesCount)} تصویر برای
                    این کد)
                  </span>
                )}
              </p>
            ) : null}

            {/* Thumbnails Strip with Interactive Two-Way Selection */}
            {galleryImages.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                  <span>تصویر هر کد را انتخاب کنید:</span>
                  <span>{toPersianDigits(galleryImages.length)} تصویر</span>
                </div>
                <div
                  className="product-thumb-strip"
                  aria-label="گالری تصاویر محصول"
                >
                  {galleryImages.map((img, idx) => {
                    const isCurrentImg = activeImageIndex === idx;
                    const isBoundToSelectedSku =
                      img.scope === "variant" &&
                      img.variantCode &&
                      img.variantCode === selectedVariant?.code;

                    return (
                      <button
                        key={img.id || idx}
                        type="button"
                        aria-label={
                          img.scope === "variant" && img.variantCode
                            ? `انتخاب تصویر کد ${img.variantCode} (${toPersianDigits(idx + 1)} از ${toPersianDigits(galleryImages.length)})`
                            : `نمایش تصویر عمومی خانواده ${toPersianDigits(idx + 1)} از ${toPersianDigits(galleryImages.length)}`
                        }
                        aria-pressed={isCurrentImg}
                        onClick={() => handleSelectImage(idx)}
                        className={`relative pt-[78%] rounded-xl border overflow-hidden transition-all cursor-pointer text-right ${
                          isCurrentImg
                            ? "border-[#E06518] ring-2 ring-[#E06518] ring-offset-1 shadow-xs bg-white"
                            : isBoundToSelectedSku
                              ? "border-orange-300 bg-orange-50/30 hover:border-[#E06518]"
                              : "border-slate-200/80 opacity-80 hover:opacity-100 hover:border-slate-300 bg-slate-50/60"
                        }`}
                      >
                        <ProductImage
                          src={img.url}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-contain p-2 pb-5"
                        />
                        <span
                          className={`absolute bottom-0 inset-x-0 text-[9.5px] font-bold px-1.5 py-0.5 text-center truncate ${
                            img.scope === "variant" && img.variantCode
                              ? isBoundToSelectedSku
                                ? "bg-[#E06518] text-white font-mono"
                                : "bg-slate-800/85 text-white font-mono"
                              : "bg-slate-200/90 text-slate-700"
                          }`}
                          dir={img.scope === "variant" ? "ltr" : "rtl"}
                        >
                          {img.scope === "variant" && img.variantCode
                            ? `کد ${img.variantCode}`
                            : "عمومی خانواده"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Quick Actions Under Gallery */}
            <div className="flex items-center justify-between pt-1 px-1 text-xs text-slate-500">
              <button
                type="button"
                onClick={() => toggleWishlist(product.code)}
                className="flex items-center gap-1.5 hover:text-red-600 transition-colors cursor-pointer py-1"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFavorited ? "fill-red-500 text-red-500" : "text-slate-400"
                  }`}
                />
                <span className="text-[11.5px]">
                  {isFavorited
                    ? "نشان‌شده در حساب شما"
                    : "نشان کردن خانواده کالا"}
                </span>
              </button>

              <button
                type="button"
                onClick={copyProductCode}
                className="flex items-center gap-1.5 hover:text-[#55565A] transition-colors cursor-pointer py-1"
              >
                <Copy className="w-4 h-4 text-slate-400" />
                <span className="text-[11.5px]">
                  {copiedCode
                    ? "کد کالا کپی شد"
                    : `کپی کد انتخاب‌شده (${requestedProduct.code})`}
                </span>
              </button>
            </div>
          </div>

          {/* Right: Family Header + Variant Selector + SKU-Specific Specs & Price */}
          <div className="product-detail-info flex flex-col space-y-5">
            <div className="space-y-4">
              {/* Metadata Line (Clean unboxed metadata + key codes) */}
              <div className="flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>
                    خانواده:{" "}
                    <strong className="font-mono text-slate-800" dir="ltr">
                      {product.code}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    کد کالای انتخاب‌شده:{" "}
                    <strong className="font-mono text-[#E06518]" dir="ltr">
                      {requestedProduct.code}
                    </strong>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    برند:{" "}
                    <strong className="text-slate-800">{activeBrand}</strong>
                  </span>
                  {selectedVariant?.model && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        مدل:{" "}
                        <strong className="font-mono text-slate-800" dir="ltr">
                          {selectedVariant.model}
                        </strong>
                      </span>
                    </>
                  )}
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stockInfo.badgeBg }}
                  />
                  <span className="text-slate-700">
                    {!canViewCommercial
                      ? "موجودی در پنل کاربری"
                      : !isSelectedStockKnown
                        ? "موجودی نیازمند استعلام"
                        : activeStockCount > 0
                          ? `موجود در انبار (${toPersianDigits(activeStockCount)} ${activeUnit})`
                          : "ناموجود / تأمین سفارشی"}
                  </span>
                </div>
              </div>

              {/* Family Title & Active SKU Subtitle */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-500">
                  خانواده محصول: {product.name}
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-black text-[#37383b] tracking-tight leading-snug">
                  {selectedVariant ? selectedVariant.name : product.name}
                </h1>
                {selectedVariant?.size && (
                  <div className="text-xs sm:text-sm font-bold text-[#E06518] pt-0.5">
                    سایز / مشخصه فنی کد {selectedVariant.code}:{" "}
                    <span className="font-mono text-slate-800" dir="auto">
                      {selectedVariant.size}
                    </span>
                  </div>
                )}
              </div>

              {/* Quick Variant Chips */}
              {visibleVariants.length > 0 && visibleVariants.length <= 12 && (
                <div className="space-y-2 pt-1">
                  <span className="text-xs font-bold text-slate-700 block">
                    انتخاب سریع کد کالا (با انتخاب هر کد، تصویر و قیمت آن نمایش
                    داده می‌شود):
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {visibleVariants.map((v) => {
                      const isSel = v.code === selectedVariant?.code;
                      const vPrice = canViewCommercial
                        ? skuPrice(v.code, v.price ?? v.prices?.retail ?? 0)
                        : 0;
                      const vInq =
                        v.inquiryOnly !== undefined
                          ? v.inquiryOnly
                          : vPrice <= 0;
                      return (
                        <button
                          key={v.code}
                          type="button"
                          onClick={() => handleSelectVariant(v.code)}
                          className={`px-3 py-2 rounded-xl border text-right transition-all cursor-pointer flex flex-col gap-0.5 ${
                            isSel
                              ? "border-[#E06518] bg-orange-50/90 text-[#37383b] ring-1 ring-[#E06518]"
                              : "border-slate-200 bg-white hover:border-slate-300 text-slate-700"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="font-mono text-xs font-black text-[#E06518]"
                              dir="ltr"
                            >
                              {v.code}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-600">
                              {v.size && v.size !== "نامشخص" ? v.size : v.name}
                            </span>
                          </div>
                          <div className="text-[10.5px] font-bold">
                            {!vInq && vPrice > 0 ? (
                              <span className="text-emerald-800 font-mono">
                                {toPersianDigits(
                                  new Intl.NumberFormat("fa-IR").format(vPrice),
                                )}{" "}
                                تومان
                              </span>
                            ) : (
                              <span className="text-amber-700">
                                نیازمند استعلام
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {visibleVariants.length > 12 && (
                <details className="product-variants-details" open>
                  <summary>
                    جستجو و انتخاب کد کالا
                    <ChevronLeft size={15} />
                  </summary>
                  <ProductVariants
                    showPrices={canViewCommercial}
                    key={product.code}
                    variants={visibleVariants.map((v) => ({
                      ...v,
                      price: canViewCommercial
                        ? skuPrice(v.code, v.price ?? v.prices?.retail ?? 0)
                        : 0,
                      prices: undefined,
                    }))}
                    selected={selectedVariant?.code || ""}
                    onSelect={handleSelectVariant}
                    galleryImages={galleryImages}
                  />
                </details>
              )}
              <div className="product-detail-specs">
                <section className="product-spec-card selected">
                  <h3>مشخصات کد {requestedProduct.code}</h3>
                  <dl>
                    {selectedVariant?.size && (
                      <div>
                        <dt>ابعاد / سایز</dt>
                        <dd dir="auto">{selectedVariant.size}</dd>
                      </div>
                    )}
                    {selectedVariant?.model && (
                      <div>
                        <dt>مدل</dt>
                        <dd>{selectedVariant.model}</dd>
                      </div>
                    )}
                    {activeVariantSpecs.slice(0, 5).map((sp, i) => (
                      <div key={i}>
                        <dt>{sp.key}</dt>
                        <dd>{sp.value}</dd>
                      </div>
                    ))}
                    {!activeVariantSpecs.length && !selectedVariant?.size && (
                      <div>
                        <dt>کد کالا</dt>
                        <dd>{requestedProduct.code}</dd>
                      </div>
                    )}
                  </dl>
                </section>
                <section className="product-spec-card">
                  <h3>مشخصات مشترک خانواده</h3>
                  <dl>
                    <div>
                      <dt>واحد فروش</dt>
                      <dd>{activeUnit}</dd>
                    </div>
                    <div>
                      <dt>برند</dt>
                      <dd>{activeBrand}</dd>
                    </div>
                    {product.technicalSpecs.slice(0, 4).map((sp, i) => (
                      <div key={i}>
                        <dt>{sp.key}</dt>
                        <dd>{sp.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              </div>
              {visibleVariants.length > 0 && visibleVariants.length <= 12 && (
                <details className="product-variants-details">
                  <summary>
                    جدول تمام کدها و مشخصات
                    <ChevronLeft size={15} />
                  </summary>
                  <ProductVariants
                    showPrices={canViewCommercial}
                    key={product.code}
                    variants={visibleVariants.map((v) => ({
                      ...v,
                      price: canViewCommercial
                        ? skuPrice(v.code, v.price ?? v.prices?.retail ?? 0)
                        : 0,
                      prices: undefined,
                    }))}
                    selected={selectedVariant?.code || ""}
                    onSelect={handleSelectVariant}
                    galleryImages={galleryImages}
                  />
                </details>
              )}
              {/* Family Description */}
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                {selectedVariant?.description || product.description}
              </p>
            </div>

            {/* Primary SKU-Owned Pricing & Order Action Area */}
            <div className="pt-5 border-t border-slate-200/80 space-y-4">
              {!canViewCommercial ? (
                <MemberAccess
                  code={selectedVariantCode || product.code}
                  compact
                />
              ) : !isSelectedInquiryOnly && activeUnitPrice > 0 ? (
                /* SKU HAS AN ACTIVE PRICE */
                <div className="space-y-4 p-4 sm:p-5 rounded-2xl bg-slate-50/90 border border-slate-200/90">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <span className="text-xs text-slate-500 block mb-1">
                        قیمت واحد کد کالای انتخاب‌شده (
                        <strong className="font-mono text-slate-800" dir="ltr">
                          {requestedProduct.code}
                        </strong>
                        ):
                      </span>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-2xl sm:text-3xl font-black text-emerald-800 font-mono">
                          {toPersianDigits(
                            new Intl.NumberFormat("fa-IR").format(
                              activeUnitPrice * quantity,
                            ),
                          )}
                        </span>
                        <span className="text-xs text-slate-600 font-bold">
                          تومان
                        </span>
                        {quantity > 1 && (
                          <span className="text-[11px] text-slate-500 mr-2">
                            (هر {activeUnit}{" "}
                            {toPersianDigits(
                              new Intl.NumberFormat("fa-IR").format(
                                activeUnitPrice,
                              ),
                            )}{" "}
                            تومان)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-500">
                        تعداد ({activeUnit}):
                      </span>
                      <div className="flex items-center border border-slate-200 rounded-xl bg-white overflow-hidden shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                          className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <span className="w-11 text-center font-bold font-mono text-sm text-[#55565A]">
                          {toPersianDigits(quantity)}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity((q) => q + 1)}
                          className="w-10 h-10 flex items-center justify-center text-slate-600 hover:bg-slate-100 font-bold cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleAddToCart}
                      disabled={isSelectedStockKnown && activeStockCount <= 0}
                      className={`h-12 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer active:scale-98 ${
                        isSelectedStockKnown && activeStockCount <= 0
                          ? "bg-slate-200 text-slate-500 cursor-not-allowed"
                          : added
                            ? "bg-emerald-600 text-white"
                            : "bg-[#E06518] hover:bg-[#C95210] text-white"
                      }`}
                    >
                      {added ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>
                            کد {requestedProduct.code} به پیش‌فاکتور افزوده شد
                          </span>
                        </>
                      ) : (
                        <>
                          <ShoppingCart className="w-4 h-4" />
                          <span>
                            افزودن کد {requestedProduct.code} به سبد خرید
                          </span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsInquiryModalOpen(true)}
                      className="h-12 rounded-xl border border-slate-300 hover:border-slate-400 bg-white text-[#55565A] font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs hover:bg-slate-50 active:scale-98"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-[#E06518]" />
                      <span>درخواست پیش‌فاکتور رسمی / خرید عمده</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* SKU HAS NO PRICE -> REQUIRES INQUIRY ("نیازمند استعلام") */
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50/60 border border-amber-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-black text-amber-950">
                        وضعیت قیمت کد {requestedProduct.code}: نیازمند استعلام
                      </span>
                    </div>
                    <p className="text-xs text-amber-900/80 leading-relaxed">
                      برای این کد کالا هنوز قیمت ثابتی ثبت نشده است؛ درخواست
                      استعلام خود را ثبت کنید تا قیمت روز و موجودی انبار اعلام
                      شود.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleInquirePriceClick}
                    className="h-11 sm:h-12 px-6 bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0 active:scale-98"
                  >
                    <PhoneCall className="w-4 h-4" />
                    <span>ثبت استعلام قیمت کد {requestedProduct.code}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2.5 INTERACTIVE TABS: SPECS (SHARED + VARIANT-SPECIFIC), CATALOGUE, DELIVERY */}
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="flex items-center border-b border-slate-200/80 bg-slate-50/70 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("specs")}
            className={`px-5 sm:px-7 py-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
              activeTab === "specs"
                ? "border-[#E06518] text-[#E06518] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>مشخصات فنی (اختصاصی کد + مشترک خانواده)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("catalogue")}
            className={`px-5 sm:px-7 py-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
              activeTab === "catalogue"
                ? "border-[#E06518] text-[#E06518] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>شناسنامه کد و تطبیق با کاتالوگ</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("delivery")}
            className={`px-5 sm:px-7 py-4 text-xs font-bold border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
              activeTab === "delivery"
                ? "border-[#E06518] text-[#E06518] bg-white"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/50"
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>انبارداری یزد، تحویل و ضمانت اصالت</span>
          </button>
        </div>

        <div className="p-5 sm:p-7">
          {activeTab === "specs" && (
            <div className="space-y-6">
              {/* Variant-Specific Specs Table */}
              {selectedVariant && (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#37383b]">
                      ۱. مشخصات اختصاصی کد کالای انتخاب‌شده (
                      {selectedVariant.code})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      اطلاعات فنی، سایز و ویژگی‌های مربوط به همین نوع/کد کالا
                    </p>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-orange-200/80 shadow-2xs">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="bg-orange-50/70 border-b border-orange-200/80 text-slate-800">
                          <th className="py-3 px-4 font-bold w-1/3">
                            ویژگی اختصاصی کد {selectedVariant.code}
                          </th>
                          <th className="py-3 px-4 font-bold">مقدار ثبت‌شده</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-orange-100">
                        <tr className="bg-white">
                          <td className="py-3 px-4 font-semibold text-slate-700 border-l border-orange-100">
                            کد دقیق کالا
                          </td>
                          <td
                            className="py-3 px-4 font-mono font-bold text-[#E06518]"
                            dir="ltr"
                          >
                            {selectedVariant.code}
                          </td>
                        </tr>
                        <tr className="bg-orange-50/20">
                          <td className="py-3 px-4 font-semibold text-slate-700 border-l border-orange-100">
                            نام دقیق نوع کالا
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-800">
                            {selectedVariant.name}
                          </td>
                        </tr>
                        <tr className="bg-white">
                          <td className="py-3 px-4 font-semibold text-slate-700 border-l border-orange-100">
                            سایز / ابعاد
                          </td>
                          <td
                            className="py-3 px-4 font-mono font-bold text-slate-800"
                            dir="auto"
                          >
                            {selectedVariant.size || "—"}
                          </td>
                        </tr>
                        {selectedVariant.model && (
                          <tr className="bg-orange-50/20">
                            <td className="py-3 px-4 font-semibold text-slate-700 border-l border-orange-100">
                              مدل فنی
                            </td>
                            <td
                              className="py-3 px-4 font-mono font-bold text-slate-800"
                              dir="ltr"
                            >
                              {selectedVariant.model}
                            </td>
                          </tr>
                        )}
                        {activeVariantSpecs.map((spec, i) => (
                          <tr
                            key={i}
                            className={
                              i % 2 === 0 ? "bg-white" : "bg-orange-50/20"
                            }
                          >
                            <td className="py-3 px-4 font-semibold text-slate-700 border-l border-orange-100">
                              {spec.key}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-800">
                              {spec.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {selectedVariant?.technicalReview && (
                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs text-slate-600">
                  <h3 className="font-bold text-[#55565A]">مسیر فنی و منابع این کد کالا</h3>
                  <p>{selectedVariant.technicalReview.categoryPath.join(' ← ')}</p>
                  <p className="leading-6">{selectedVariant.technicalReview.note}</p>
                  {selectedVariant.technicalReview.ownerCatalogue&&<p>منبع ابعاد: کاتالوگ اطلس، صفحهٔ چاپی {selectedVariant.technicalReview.ownerCatalogue.printedPage}؛ صفحهٔ PDF {selectedVariant.technicalReview.ownerCatalogue.pdfPage}.</p>}
                  {selectedVariant.technicalReview.researchWarnings?.map(warning=><p key={warning} className="leading-6 text-amber-800">نیازمند تطبیق: {warning}</p>)}
                  <div className="flex flex-wrap gap-3">
                    {selectedVariant.technicalReview.references.map(ref => <a key={ref.url} href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[#E06518] underline underline-offset-4">{ref.title}</a>)}
                  </div>
                  {selectedVariant.technicalReview.comparisonReferences?.map(ref=><p key={ref.url} className="leading-6"><a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-[#E06518] underline">{ref.title}</a> — مرجع مقایسه: {ref.condition}</p>)}
                  <p className="leading-6">نیازمند تکمیل: {selectedVariant.technicalReview.missing.join('، ')}</p>
                </section>
              )}

              {/* Shared Family Specs Table */}
              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-[#55565A]">
                    ۲. مشخصات مشترک خانوادهٔ محصول ({product.name})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    ویژگی‌های عمومی و مشترک بین تمام کدهای زیرمجموعهٔ این
                    خانواده
                  </p>
                </div>

                {product.technicalSpecs && product.technicalSpecs.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-slate-200/90 shadow-2xs">
                    <table className="w-full text-xs text-right">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                          <th className="py-3.5 px-4 font-bold w-1/3">
                            شاخص فنی مشترک خانواده
                          </th>
                          <th className="py-3.5 px-4 font-bold">
                            اطلاعات ثبت‌شده
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {product.technicalSpecs.map((spec, i) => (
                          <tr
                            key={i}
                            className={
                              i % 2 === 0 ? "bg-white" : "bg-slate-50/40"
                            }
                          >
                            <td className="py-3.5 px-4 font-semibold text-slate-700 border-l border-slate-100">
                              {spec.key}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-[#55565A]">
                              {spec.value}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                    اطلاعات فنی بیشتر طبق نقشه ساخت و فایل کاتالوگ قابل ارائه
                    است.
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "catalogue" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[#55565A]">
                  شناسه‌ها و مدارک محصول
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  برای تطبیق دقیق، کد کالا و سایز انتخاب‌شده را به واحد فروش
                  اعلام کنید.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-1">
                  <span className="text-slate-400 block text-[11px]">
                    کد کالای انتخاب‌شده:
                  </span>
                  <span
                    className="font-mono font-bold text-[#55565A] text-sm block"
                    dir="ltr"
                  >
                    {selectedVariant?.code || product.forzaCode || product.code}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-1">
                  <span className="text-slate-400 block text-[11px]">
                    کد خانواده مرجع:
                  </span>
                  <span
                    className="font-mono font-bold text-[#55565A] text-sm block"
                    dir="ltr"
                  >
                    {product.code}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-1">
                  <span className="text-slate-400 block text-[11px]">
                    برند ثبت‌شده:
                  </span>
                  <span className="font-bold text-orange-600 text-sm block">
                    {activeBrand}
                  </span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-1">
                  <span className="text-slate-400 block text-[11px]">
                    تصاویر متصل به این کد:
                  </span>
                  <span className="font-bold text-[#55565A] text-sm block">
                    {selectedVariantImagesCount > 0
                      ? `${toPersianDigits(selectedVariantImagesCount)} تصویر اختصاصی`
                      : "استفاده از تصویر عمومی خانواده"}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 flex items-start gap-3">
                <Shield className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-950">
                    تأییدیه اصالت کاتالوگ رسمی
                  </h4>
                  <p className="text-[11.5px] leading-relaxed text-amber-900/90">
                    تمامی ابعاد، کدهای فنی و مشخصات ثبت‌شده با کاتالوگ رسمی
                    بازرگانی تسمه و قطعات صنعتی اطلس مطابقت دارد.
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === "delivery" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[#55565A]">
                  انبارداری، لجستیک و تحویل کالا از انبار مرکزی یزد
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  روند آماده‌سازی، بسته‌بندی صنعتی و ارسال سریع به سراسر ایران
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-orange-100/80 text-orange-700 flex items-center justify-center">
                    <Truck className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900">
                    روش‌های ارسال سریع
                  </h4>
                  <p className="text-slate-500 text-[11.5px] leading-relaxed">
                    تحویل فوری از طریق باربری‌های معتبر، تیپاکس، وانت بین‌شهری و
                    تحویل حضوری در انبار مرکزی یزد.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center">
                    <PackageCheck className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900">
                    بسته‌بندی استاندارد صنعتی
                  </h4>
                  <p className="text-slate-500 text-[11.5px] leading-relaxed">
                    پوشش ضد رطوبت و بسته‌بندی مقاوم جهت جلوگیری از هرگونه سایش،
                    تغییر شکل یا آسیب‌دیدگی در حین حمل.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/90 space-y-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-100/80 text-blue-700 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-slate-900">
                    ضمانت اصالت و تطبیق کد
                  </h4>
                  <p className="text-slate-500 text-[11.5px] leading-relaxed">
                    پیش از ارسال، کد کالا، سایز و مشخصات فنی انتخاب‌شده توسط
                    واحد کنترل کیفیت بررسی و تأیید می‌شود.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. SIMILAR PRODUCTS */}
      {similarProducts.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-[#55565A]">
              محصولات مشابه در این دسته‌بندی
            </h2>
            <Link
              to={`/category/${product.categorySlug}`}
              className="text-xs font-bold text-[#E06518] hover:text-[#C95210] flex items-center gap-1 transition-colors"
            >
              <span>مشاهده تمام قطعات</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {similarProducts.map((p) => (
              <ProductCard key={p.code} product={p} />
            ))}
          </div>
        </div>
      )}

      {/* 4. MOBILE STICKY BOTTOM ACTION BAR */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-4 py-3 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span
            className="block text-[11px] font-mono text-slate-500 truncate"
            dir="ltr"
          >
            کد: {requestedProduct.code}
          </span>
          <div className="text-xs font-black text-[#55565A] truncate">
            {canViewCommercial &&
            !isSelectedInquiryOnly &&
            activeUnitPrice > 0 ? (
              <span className="text-emerald-700 font-mono">
                {toPersianDigits(
                  new Intl.NumberFormat("fa-IR").format(
                    activeUnitPrice * quantity,
                  ),
                )}{" "}
                تومان
              </span>
            ) : (
              <span className="text-amber-700">نیازمند استعلام</span>
            )}
          </div>
        </div>

        <div>
          {canViewCommercial &&
          !isSelectedInquiryOnly &&
          activeUnitPrice > 0 ? (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isSelectedStockKnown && activeStockCount <= 0}
              className="h-11 px-5 bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{added ? "افزوده شد" : "افزودن به سبد"}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleInquirePriceClick}
              className="h-11 px-5 bg-[#E06518] hover:bg-[#C95210] text-white text-xs font-bold rounded-xl shadow-xs flex items-center gap-2 cursor-pointer active:scale-95 transition-all"
            >
              <PhoneCall className="w-4 h-4" />
              <span>استعلام قیمت</span>
            </button>
          )}
        </div>
      </div>

      {/* 5. INQUIRY / RFQ MODAL */}
      <Modal
        isOpen={isInquiryModalOpen}
        onClose={() => setIsInquiryModalOpen(false)}
        title={`استعلام قیمت و موجودی کد: ${requestedProduct.code}`}
        size="md"
      >
        <form onSubmit={handleInquirySubmit} className="space-y-4 text-right">
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            <p className="font-semibold text-sm text-[#55565A]">
              {requestedProduct.name}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              خانواده: {product.name} | برند: {activeBrand} | دسته‌بندی:{" "}
              {product.categoryName}
            </p>
          </div>

          <p className="text-xs bg-orange-50 p-3 rounded-xl font-medium text-orange-950">
            کد کالای انتخاب‌شده:{" "}
            <strong className="font-mono" dir="ltr">
              {requestedProduct.code}
            </strong>
            {selectedVariant?.size ? ` — سایز: ${selectedVariant.size}` : ""}
          </p>
          <div>
            <label className="block text-xs font-bold text-[#55565A] mb-1">
              تعداد مورد نیاز ({activeUnit}):
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, parseInt(e.target.value) || 1))
              }
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#55565A] mb-1">
              توضیحات و ملزومات فنی:
            </label>
            <textarea
              rows={3}
              value={inquiryNotes}
              onChange={(e) => setInquiryNotes(e.target.value)}
              placeholder="نکات مربوط به زمان تحویل یا نوع بسته‌بندی..."
              className="w-full p-3 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          {inquiryError && (
            <p role="alert" className="account-error">
              {inquiryError}
            </p>
          )}
          {inquirySubmitted ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold text-center">
              درخواست استعلام با موفقیت ثبت شد. واحد فروش به زودی پاسخ خواهد
              داد.
            </div>
          ) : (
            <button
              type="submit"
              disabled={inquiryBusy}
              className="w-full h-11 bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs rounded-xl shadow-md cursor-pointer"
            >
              ارسال استعلام رسمی برای کد {requestedProduct.code}
            </button>
          )}
        </form>
      </Modal>
    </div>
  );
};
