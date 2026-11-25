import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileSpreadsheet,
  Heart,
  Layers,
  PackageCheck,
  PhoneCall,
  Share2,
  ShoppingCart,
  Truck,
  ZoomIn,
} from 'lucide-react';
import type { Product, ProductGalleryImage } from '../types';
import { useCart } from '../context/CartContext';
import { useCatalogPanelMode } from '../hooks/useCatalogPanelMode';
import { useWishlist } from '../context/WishlistContext';
import { ProductImage } from '../components/product/ProductImage';
import { ProductVariants } from '../components/product/PopdProductVariants';
import { NonBeltFamilyGrid } from '../components/product/NonBeltFamilyGrid';
import { Modal } from '../components/ui/Modal';
import { formatPrice, toPersianDigits } from '../utils/formatters';
import { resolveDisplayBrand } from '../utils/catalogBrands';
import { getCleanVariantSpecs, isNonBeltFamilyProduct } from '../utils/nonBeltFamilyDisplay';
const LegacyProductDetailPage = React.lazy(() =>
  import('./ProductDetailPage').then((module) => ({ default: module.ProductDetailPage })),
);
import {
  buildBeltGalleryImages,
  getBeltFamilyMedia,
} from '../utils/beltCatalogMedia';
type TechnicalReviewPayload = {
  categoryPath?: string[];
  note?: string;
  ownerCatalogue?: { printedPage?: string | number; pdfPage?: string | number };
  researchWarnings?: string[];
  references?: Array<{ title: string; url: string }>;
  comparisonReferences?: Array<{ title: string; url: string; condition?: string }>;
  missing?: string[];
  summary?: string;
  standards?: string[];
  applications?: string[];
  notes?: string;
};

type ProductDetailResponse = {
  success: boolean;
  product: Product;
  categoryMeta?: { slug: string; name: string };
  similarProducts?: Product[];
};

interface ZoomModalPayload {
  title: string;
  imageUrl: string;
  subtitle?: string;
}

function buildDefaultGalleryImages(product: Product): ProductGalleryImage[] {
  if (product.galleryImages && product.galleryImages.length > 0) {
    return product.galleryImages;
  }
  return (product.images || []).map((url, idx) => ({
    id: `fam-default-${idx}`,
    url,
    scope: 'family' as const,
    title: product.name,
    order: idx + 1,
  }));
}

export const ProductDetailPage: React.FC = () => {
  const { code = '' } = useParams<{ code: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const decodedCode = decodeURIComponent(code).trim();

  const { addToCart, cart, submitInquiry } = useCart();
  const { toggleWishlist, isInWishlist } = useWishlist();
  const [panelMode] = useCatalogPanelMode();

  const isPortalRoute =
    location.pathname.startsWith('/consumer-dashboard/') ||
    location.pathname.startsWith('/account/');
  const showCommercial = panelMode || isPortalRoute;

  const [detail, setDetail] = useState<ProductDetailResponse | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [selectedVariantCode, setSelectedVariantCode] = useState('');
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedThumbUrls, setFailedThumbUrls] = useState<Record<string, boolean>>({});
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'specs' | 'delivery'>('specs');
  const [zoomModal, setZoomModal] = useState<ZoomModalPayload | null>(null);
  const [lazyReviews, setLazyReviews] = useState<Record<string, TechnicalReviewPayload | null>>({});

  const pendingVariantFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (!decodedCode) {
      setStatus('not-found');
      return;
    }
    const controller = new AbortController();
    let mounted = true;
    setStatus('loading');
    setFailedThumbUrls({});

    fetch(`/api/catalog/reference/product/${encodeURIComponent(decodedCode)}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (res.status === 404) {
          if (mounted) setStatus('not-found');
          return null;
        }
        if (!res.ok) throw new Error('Product fetch failed');
        return (await res.json()) as ProductDetailResponse;
      })
      .then((json) => {
        if (!mounted || !json?.product) return;
        setDetail(json);
        setStatus('ready');
      })
      .catch((err) => {
        if (!mounted || (err instanceof Error && err.name === 'AbortError')) return;
        setStatus('error');
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [decodedCode]);

  const product = detail?.product;
  const visibleVariants = useMemo(
    () => (product?.variants || []).filter((v) => v.active !== false),
    [product],
  );

  // Sync initial selected SKU from ?sku= query param, URL code, or first variant
  useEffect(() => {
    if (!product) return;
    const searchParams = new URLSearchParams(location.search);
    const querySku = (searchParams.get('sku') || searchParams.get('variant') || '').trim().toLowerCase();
    const lowerDecoded = decodedCode.toLowerCase();
    const aliasSkuHint = lowerDecoded.replace(/^fam-/i, '');
    const matched =
      (querySku ? visibleVariants.find((v) => v.code.toLowerCase() === querySku) : undefined) ||
      visibleVariants.find((v) => v.code.toLowerCase() === lowerDecoded) ||
      visibleVariants.find((v) => v.code.toLowerCase() === aliasSkuHint);
    const initial = matched?.code || visibleVariants[0]?.code || '';
    setSelectedVariantCode(initial);
    pendingVariantFocusRef.current = initial || null;
    setQuantity(1);
  }, [decodedCode, location.search, product?.code, visibleVariants]);

  const rawGalleryImages = useMemo(() => {
    if (!product) return [];
    const baseImgs = buildDefaultGalleryImages(product);
    return buildBeltGalleryImages(product, baseImgs, selectedVariantCode);
  }, [product, selectedVariantCode]);

  // Filter out any image URLs that failed to load so users NEVER see broken placeholder cubes
  const galleryImages = useMemo(
    () => rawGalleryImages.filter((img) => img.url && !failedThumbUrls[img.url]),
    [rawGalleryImages, failedThumbUrls],
  );

  // Focus gallery to newly selected SKU photo once selectedVariantCode is synced
  useEffect(() => {
    if (!galleryImages.length) {
      setActiveImageIndex(0);
      return;
    }
    const pending = pendingVariantFocusRef.current;
    if (pending && pending === selectedVariantCode) {
      pendingVariantFocusRef.current = null;
      const realIdx = galleryImages.findIndex(
        (img) => img.scope === 'variant' && img.variantCode === pending,
      );
      if (realIdx >= 0) {
        setActiveImageIndex(realIdx);
        return;
      }
      const famIdx = galleryImages.findIndex((img) => img.scope === 'family');
      setActiveImageIndex(famIdx >= 0 ? famIdx : 0);
      return;
    }
    if (activeImageIndex >= galleryImages.length) {
      setActiveImageIndex(0);
    }
  }, [galleryImages, activeImageIndex, selectedVariantCode]);

  // Lazy load technical review for selected variant
  useEffect(() => {
    if (activeTab !== 'specs' || !selectedVariantCode) return;
    const selected = visibleVariants.find((v) => v.code === selectedVariantCode);
    if (
      !selected ||
      selected.technicalReview ||
      Object.prototype.hasOwnProperty.call(lazyReviews, selectedVariantCode)
    ) {
      return;
    }
    const controller = new AbortController();
    fetch(`/api/catalog/variant-review/${encodeURIComponent(selectedVariantCode)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!controller.signal.aborted) {
          setLazyReviews((prev) => ({
            ...prev,
            [selectedVariantCode]: data?.success ? (data.technicalReview ?? null) : null,
          }));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setLazyReviews((prev) => ({ ...prev, [selectedVariantCode]: null }));
        }
      });
    return () => controller.abort();
  }, [activeTab, selectedVariantCode, visibleVariants, lazyReviews]);

  const handleSelectVariant = (newCode: string) => {
    setSelectedVariantCode(newCode);
    setQuantity(1);
    pendingVariantFocusRef.current = newCode;
  };

  const handleSelectImage = (idx: number) => {
    setActiveImageIndex(idx);
    const clicked = galleryImages[idx];
    if (clicked?.scope === 'variant' && clicked.variantCode) {
      if (visibleVariants.some((v) => v.code === clicked.variantCode)) {
        setSelectedVariantCode(clicked.variantCode);
      }
    }
  };

  const scrollToSkuSelector = () => {
    const el = document.getElementById('belt-sku-selector');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-[65vh] bg-[#F8FAFC] flex items-center justify-center px-4" role="status" dir="rtl">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-10 text-center space-y-3 max-w-md w-full">
          <div className="w-9 h-9 border-3 border-orange-200 border-t-[#E06518] rounded-full animate-spin mx-auto" />
          <h2 className="text-sm font-black text-slate-900">در حال دریافت اطلاعات محصول...</h2>
          <p className="text-xs text-slate-500">مشخصات فنی و سایزها از پایگاه داده کاتالوگ بارگذاری می‌شود.</p>
        </div>
      </div>
    );
  }

  // Keep pre-existing SCRIPT product links (orders, invoices and older SKUs) working
  // when their code is outside the POPD reference archive.
  if (status === 'not-found') {
    return (
      <React.Suspense fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-sm text-slate-500" role="status">
          در حال بارگذاری اطلاعات کالای قبلی...
        </div>
      }>
        <LegacyProductDetailPage />
      </React.Suspense>
    );
  }

  if (status === 'error' || !product) {
    return (
      <div
        dir="rtl"
        className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-10 text-center space-y-4 max-w-xl w-full mx-auto my-8 sm:my-12 shadow-xs"
      >
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-500">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-lg font-black text-[#2B313A]">کالای مورد نظر یافت نشد</h2>
        <p className="text-xs text-slate-500 leading-6">
          کد کالای وارد شده در کاتالوگ جامع قطعات ثبت نشده است یا موقتاً غیرفعال شده است.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Link
            to="/products"
            className="inline-flex items-center justify-center h-11 px-5 bg-[#E06518] text-white text-xs font-bold rounded-xl hover:bg-[#c85612]"
          >
            بازگشت به کاتالوگ محصولات
          </Link>
          <Link
            to="/categories"
            className="inline-flex items-center justify-center h-11 px-5 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50"
          >
            دسته‌بندی قطعات
          </Link>
        </div>
      </div>
    );
  }

  const categorySlug = detail?.categoryMeta?.slug || product.resolvedAssignment?.categorySlug || product.categorySlug;
  const categoryTitle = detail?.categoryMeta?.name || product.categoryName || 'قطعات صنعتی';

  // Non-belt families use the dedicated clean card-by-card SKU grid with direct Add-to-Cart
  if (isNonBeltFamilyProduct(product, categorySlug)) {
    const searchParams = new URLSearchParams(location.search);
    const explicitSku = (searchParams.get('sku') || searchParams.get('variant') || '').trim();
    const urlMatchedVariant =
      explicitSku ||
      (visibleVariants.some((v) => v.code.toLowerCase() === decodedCode.toLowerCase())
        ? decodedCode
        : '');
    return (
      <NonBeltFamilyGrid
        product={product}
        categorySlug={categorySlug || ''}
        categoryTitle={categoryTitle}
        initialHighlightCode={urlMatchedVariant}
      />
    );
  }

  const selectedVariant =
    visibleVariants.find((v) => v.code === selectedVariantCode) || visibleVariants[0];
  const activeSkuCode = selectedVariant?.code || product.code;
  const activeUnitPrice =
    selectedVariant?.price ?? selectedVariant?.prices?.retail ?? product.prices?.retail ?? 0;
  const isSelectedInquiryOnly = selectedVariant
    ? selectedVariant.inquiryOnly !== undefined
      ? selectedVariant.inquiryOnly
      : activeUnitPrice <= 0
    : product.inquiryOnly || activeUnitPrice <= 0;
  const isStockKnown = selectedVariant
    ? selectedVariant.stockKnown !== undefined
      ? selectedVariant.stockKnown
      : typeof selectedVariant.stock === 'number' && !isSelectedInquiryOnly
    : product.stockKnown !== false;
  const activeStockCount = selectedVariant ? (selectedVariant.stock ?? 0) : (product.stock ?? 0);

  const activeBrand = resolveDisplayBrand(
    selectedVariant?.brand || product.brand,
    selectedVariant?.name || product.name,
  );
  const activeUnit = selectedVariant?.unit || product.unit || 'عدد';
  const cleanVariantSpecs = selectedVariant ? getCleanVariantSpecs(selectedVariant) : [];
  const cleanFamilySpecs = (product.technicalSpecs || []).filter((s) => {
    const val = String(s?.value || '').trim();
    return Boolean(
      s?.key &&
        val &&
        !/^(?:NOT_APPLICABLE|N\/A|NA|NONE|NULL|UNKNOWN|UNDEFINED|-|—)$/i.test(val) &&
        !/^[A-Z0-9]+_[A-Z0-9_]+$/.test(val),
    );
  });
  const selectedTechnicalReview =
    (selectedVariant?.technicalReview as TechnicalReviewPayload | undefined) ||
    lazyReviews[activeSkuCode];

  const beltHints = {
    variants: product.variants,
    legacyFamilyCodes: product.legacyFamilyCodes,
  };
  const beltFamilyMedia = getBeltFamilyMedia(
    product.code,
    product.images?.[0] || product.image,
    beltHints,
  );

  const currentGalleryImage = galleryImages[activeImageIndex] || galleryImages[0];
  const activeImageUrl =
    currentGalleryImage?.url ||
    beltFamilyMedia?.primaryThumbnail ||
    product.images?.[0] ||
    product.image ||
    '';

  const displayTitle = selectedVariant?.name || product.name;
  const isFavorited = isInWishlist(product.code);
  const similarProducts = (detail?.similarProducts || []).slice(0, 4);
  const inCartQty =
    cart.find((entry) => entry.product.code === activeSkuCode)?.quantity || 0;
  const hasVisiblePrice = showCommercial && !isSelectedInquiryOnly && activeUnitPrice > 0;

  const copyProductCode = () => {
    navigator.clipboard?.writeText(activeSkuCode).catch(() => {});
    setCopiedCode(true);
    window.setTimeout(() => setCopiedCode(false), 1800);
  };

  const shareCurrentLink = () => {
    navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  };

  const handleAddToCart = () => {
    const exactSkuImage = galleryImages.find(
      (image) =>
        image.scope === 'variant' &&
        String(image.variantCode || '').toLowerCase() === activeSkuCode.toLowerCase(),
    )?.url;
    const cartProduct: Product = {
      ...product,
      code: activeSkuCode,
      name: displayTitle,
      brand: activeBrand || product.brand,
      unit: activeUnit,
      prices: {
        base: activeUnitPrice,
        retail: activeUnitPrice,
        wholesale: activeUnitPrice,
        dealer: activeUnitPrice,
      },
      // Only an image audited for the exact selected variant code is eligible here.
      images: exactSkuImage ? [exactSkuImage] : [],
      image: exactSkuImage || undefined,
      inquiryOnly: isSelectedInquiryOnly || activeUnitPrice <= 0,
    };
    addToCart(cartProduct, quantity);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1700);
  };

  const markThumbFailed = (url: string) => {
    setFailedThumbUrls((prev) => (prev[url] ? prev : { ...prev, [url]: true }));
  };

  const detailHrefFor = (famCode: string) =>
    panelMode
      ? `/consumer-dashboard/product/${encodeURIComponent(famCode)}`
      : `/product/${encodeURIComponent(famCode)}`;

  const resolveSimilarImage = (sim: Product): string => {
    const bm = getBeltFamilyMedia(sim.code, sim.images?.[0] || sim.image, {
      variants: sim.variants,
      legacyFamilyCodes: sim.legacyFamilyCodes,
    });
    return (
      bm?.primaryThumbnail ||
      sim.images?.[0] ||
      sim.image ||
      ''
    );
  };

  return (
    <div data-testid="popd-product-detail" className="min-h-[75vh] bg-[#F8FAFC] pt-3 sm:pt-7 pb-28 lg:pb-10" dir="rtl">
      <div className="mx-auto max-w-[1320px] px-3.5 sm:px-6 space-y-4 sm:space-y-6">
        {/* MOBILE (< sm): Single-Line Native Context & Action Strip */}
        <div
          data-testid="belt-mobile-topbar"
          className="sm:hidden flex items-center justify-between gap-2"
        >
          <button
            type="button"
            onClick={() =>
              categorySlug
                ? navigate(`/category/${encodeURIComponent(categorySlug)}`)
                : navigate(-1)
            }
            className="min-h-[40px] pr-1 pl-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 active:text-[#E06518] min-w-0 cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate">{categoryTitle}</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => toggleWishlist(product.code)}
              aria-pressed={isFavorited}
              aria-label={isFavorited ? 'حذف از نشان‌شده‌ها' : 'نشان کردن محصول'}
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                isFavorited
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50'
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={shareCurrentLink}
              aria-label="اشتراک‌گذاری لینک صفحه"
              className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer ${
                copiedLink
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-white text-slate-600 active:bg-slate-50'
              }`}
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* DESKTOP / TABLET (>= sm): Clean Breadcrumb + Quick Utility Actions */}
        <div className="hidden sm:flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <nav
            aria-label="مسیر صفحه"
            className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap"
          >
            <Link to="/" className="hover:text-[#E06518] transition-colors">
              صفحه اصلی
            </Link>
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <Link to="/categories" className="hover:text-[#E06518] transition-colors">
              دسته‌بندی‌ها
            </Link>
            {categorySlug && (
              <>
                <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <Link
                  to={`/category/${encodeURIComponent(categorySlug)}`}
                  className="hover:text-[#E06518] transition-colors"
                >
                  {categoryTitle}
                </Link>
              </>
            )}
            <ChevronLeft className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="font-semibold text-slate-900">{product.name}</span>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => toggleWishlist(product.code)}
              aria-pressed={isFavorited}
              className={`h-8 px-3 rounded-lg border text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                isFavorited
                  ? 'border-red-200 bg-red-50 text-red-600'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorited ? 'fill-red-500 text-red-500' : ''}`} />
              <span>{isFavorited ? 'نشان‌شده' : 'نشان کردن'}</span>
            </button>
            <button
              type="button"
              onClick={shareCurrentLink}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-slate-300 hover:text-slate-900 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>{copiedLink ? 'کپی شد' : 'اشتراک‌گذاری'}</span>
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-8 px-3 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:border-slate-300 hover:text-slate-900 cursor-pointer"
            >
              بازگشت
            </button>
          </div>
        </div>

        {/* Compact Industrial Belt Family Header */}
        <header
          data-testid="belt-family-header"
          className="rounded-2xl border border-slate-200/90 bg-white px-4 py-3.5 sm:px-6 sm:py-5 shadow-2xs"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2.5 sm:gap-3">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate">
                  {product.name}
                </div>
                {/* Mobile inline SKU copy control (saves vertical space) */}
                <button
                  type="button"
                  onClick={copyProductCode}
                  aria-label="کپی کد کالا"
                  className="md:hidden h-8 px-2.5 rounded-lg border border-slate-200 bg-slate-50/90 active:border-[#E06518] text-[11px] font-bold text-slate-700 inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3 h-3 text-slate-400" />
                  <span className="font-mono tabular-nums" dir="ltr">
                    {copiedCode ? 'کپی شد' : activeSkuCode}
                  </span>
                </button>
              </div>

              <h1 className="text-lg sm:text-2xl font-black text-slate-900 tracking-tight leading-snug text-balance">
                {displayTitle}
              </h1>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] sm:text-xs text-slate-500">
                {activeBrand && (
                  <>
                    <span>
                      برند: <strong className="font-bold text-slate-800">{activeBrand}</strong>
                    </span>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                  </>
                )}
                <span className="hidden sm:inline">
                  دسته: <strong className="font-semibold text-slate-700">{categoryTitle}</strong>
                </span>
                <span aria-hidden="true" className="hidden sm:inline text-slate-300">
                  ·
                </span>
                <span className="tabular-nums">
                  <strong className="font-bold text-slate-800">
                    {toPersianDigits(Math.max(1, visibleVariants.length))}
                  </strong>{' '}
                  سایز و کد کالا
                </span>
                {selectedVariant?.size && (
                  <>
                    <span aria-hidden="true" className="text-slate-300">
                      ·
                    </span>
                    <span>
                      سایز انتخابی:{' '}
                      <strong className="font-mono font-bold text-[#E06518]" dir="ltr">
                        {selectedVariant.size}
                      </strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Desktop SKU copy button */}
            <div className="hidden md:flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={copyProductCode}
                className="h-9 px-3.5 rounded-xl border border-slate-200 bg-slate-50/80 hover:border-[#E06518] hover:bg-white text-xs font-bold text-slate-700 inline-flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-mono tabular-nums" dir="ltr">
                  {copiedCode ? 'کپی شد' : activeSkuCode}
                </span>
              </button>
            </div>
          </div>
        </header>

        {/* Main 2-Column Workspace: Right = Sticky Image & Purchase Card | Left = Clean SKU Selector */}
        <section className="grid grid-cols-1 lg:grid-cols-[430px_minmax(0,1fr)] gap-4 sm:gap-6 items-start">
          {/* Column 1 (Right in RTL): Sticky Studio Showcase + Purchase Box */}
          <div data-testid="product-detail-gallery-sticky" className="lg:sticky lg:top-24 space-y-4">
            {/* Pure White Studio Image Card (Zero broken thumbnails, zero cluttered overlays) */}
            <div data-testid="product-detail-image" className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
              <div className="relative aspect-[16/10] sm:aspect-[4/3] w-full bg-white flex items-center justify-center p-4 sm:p-6 overflow-hidden">
                <button
                  type="button"
                  disabled={!activeImageUrl}
                  onClick={() =>
                    setZoomModal({
                      title: displayTitle,
                      imageUrl: activeImageUrl,
                      subtitle: selectedVariant?.size
                        ? `کد ${activeSkuCode} · سایز ${selectedVariant.size}`
                        : `کد ${activeSkuCode}`,
                    })
                  }
                  aria-label="بزرگ‌نمایی تصویر تسمه"
                  className="group w-full h-full flex items-center justify-center cursor-zoom-in focus-visible:outline-none"
                >
                  <ProductImage
                    src={activeImageUrl}
                    alt={displayTitle}
                    disableFallback={true}
                    className="max-h-full max-w-full object-contain transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                  <span
                    aria-hidden="true"
                    className="absolute bottom-2.5 left-2.5 sm:bottom-3 sm:left-3 h-8 px-2.5 rounded-lg border border-slate-200 bg-white/95 text-slate-600 shadow-2xs text-[11px] font-bold inline-flex items-center gap-1 opacity-90 group-hover:opacity-100 group-hover:border-[#E06518] group-hover:text-[#E06518] transition-all"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>بزرگ‌نمایی</span>
                  </span>
                </button>

                {currentGalleryImage?.scope === 'family' && (
                  <span
                    className="absolute top-3 right-3 z-10 rounded-lg border border-slate-200 bg-white/95 px-2.5 py-1.5 text-[10px] font-bold text-slate-600 shadow-2xs"
                  >
                    تصویر مرجع خانواده
                  </span>
                )}

                {galleryImages.length > 1 && (
                  <span
                    aria-hidden="true"
                    className="sm:hidden absolute bottom-2.5 right-2.5 h-7 px-2 rounded-lg bg-slate-900/75 text-white text-[11px] font-bold tabular-nums inline-flex items-center"
                  >
                    {toPersianDigits(activeImageIndex + 1)} / {toPersianDigits(galleryImages.length)}
                  </span>
                )}
              </div>

              {/* Valid-Only Thumbnails Strip (auto-hides any missing image files) */}
              {galleryImages.length > 1 && (
                <div
                  aria-label="تصاویر محصول"
                  className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2 sm:gap-2.5 overflow-x-auto snap-x [scrollbar-width:none]"
                >
                  {galleryImages.map((img, idx) => {
                    const isCurrent = activeImageIndex === idx;
                    return (
                      <button
                        key={img.id || `${img.url}-${idx}`}
                        type="button"
                        aria-pressed={isCurrent}
                        aria-label={
                          img.scope === 'variant' && img.variantCode
                            ? `انتخاب تصویر کد ${img.variantCode}`
                            : `نمایش تصویر عمومی خانواده ${product.name}`
                        }
                        onClick={() => handleSelectImage(idx)}
                        className={`w-14 h-12 sm:w-16 sm:h-14 rounded-xl border bg-white p-1.5 shrink-0 snap-start flex items-center justify-center overflow-hidden transition-all cursor-pointer ${
                          isCurrent
                            ? 'border-[#E06518] ring-2 ring-[#E06518]/20'
                            : 'border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={img.url}
                          alt=""
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={() => markThumbFailed(img.url)}
                          className="w-full h-full object-contain"
                        />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Mobile Quick-Jump Strip to Size/SKU Selector (visible only on < lg) */}
            {visibleVariants.length > 1 && (
              <button
                type="button"
                onClick={scrollToSkuSelector}
                data-testid="mobile-jump-to-sizes"
                className="lg:hidden w-full min-h-[54px] px-4 py-3 rounded-2xl border border-orange-200/90 bg-orange-50/70 active:bg-orange-100/70 flex items-center justify-between gap-3 text-right transition-colors cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold text-slate-600">
                    تغییر سایز یا کد کالا
                  </div>
                  <div className="text-xs font-black text-slate-900 mt-0.5 truncate">
                    سایز فعلی:{' '}
                    <span className="font-mono text-[#E06518]" dir="ltr">
                      {selectedVariant?.size || activeSkuCode}
                    </span>{' '}
                    <span className="font-semibold text-slate-500">
                      (از {toPersianDigits(visibleVariants.length)} سایز)
                    </span>
                  </div>
                </div>
                <span className="shrink-0 h-8 px-2.5 rounded-lg bg-white border border-orange-200 text-[11px] font-bold text-[#E06518] inline-flex items-center gap-1">
                  <span>لیست سایزها</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </span>
              </button>
            )}

            {/* Clean Action & Order Card */}
            <div
              data-testid="belt-purchase-card"
              className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 space-y-4 shadow-2xs"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pb-3.5 border-b border-slate-100">
                <div className="space-y-1 min-w-0">
                  <div className="text-[11px] font-semibold text-slate-500">
                    کد انتخاب‌شده:{' '}
                    <strong data-testid="active-sku-code" className="font-mono text-slate-900 tabular-nums" dir="ltr">
                      {activeSkuCode}
                    </strong>
                    {selectedVariant?.size && (
                      <>
                        {' '}· سایز{' '}
                        <strong className="font-mono text-[#E06518]" dir="ltr">
                          {selectedVariant.size}
                        </strong>
                      </>
                    )}
                  </div>

                  {hasVisiblePrice ? (
                    <div className="flex items-baseline gap-1.5">
                      <strong className="text-xl font-black text-slate-900 tabular-nums">
                        {formatPrice(activeUnitPrice)}
                      </strong>
                      <span className="text-xs font-semibold text-slate-500">
                        تومان / {activeUnit}
                      </span>
                    </div>
                  ) : (
                    <div className="text-sm font-black text-slate-900">
                      استعلام قیمت و ثبت در سبد سفارش
                    </div>
                  )}
                </div>

                <div
                  className={`text-[11px] font-bold shrink-0 sm:pt-0.5 ${
                    isStockKnown && activeStockCount > 0 ? 'text-emerald-700' : 'text-slate-600'
                  }`}
                >
                  {isStockKnown && activeStockCount > 0
                    ? `موجود (${toPersianDigits(activeStockCount)} ${activeUnit})`
                    : 'تأمین و استعلام سریع'}
                </div>
              </div>

              {/* Quantity + In-Cart Indicator */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold text-slate-600">تعداد:</span>
                  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      aria-label="کاهش تعداد"
                      className="w-11 h-11 sm:w-9 sm:h-9 text-base sm:text-sm font-bold text-slate-700 hover:bg-white hover:text-[#E06518] rounded-r-xl transition-colors cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm sm:text-xs font-black text-slate-900 tabular-nums">
                      {toPersianDigits(quantity)}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => q + 1)}
                      aria-label="افزایش تعداد"
                      className="w-11 h-11 sm:w-9 sm:h-9 text-base sm:text-sm font-bold text-slate-700 hover:bg-white hover:text-[#E06518] rounded-l-xl transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {inCartQty > 0 && (
                  <span className="text-xs font-bold text-emerald-700 tabular-nums">
                    در سبد شما: {toPersianDigits(inCartQty)} {activeUnit}
                  </span>
                )}
              </div>

              <div className="space-y-2.5">
                <button
                  type="button"
                  data-testid="belt-add-to-cart"
                  onClick={handleAddToCart}
                  className={`w-full h-12 sm:h-11 rounded-xl px-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors active:scale-[0.99] cursor-pointer ${
                    added
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      : 'bg-[#E06518] hover:bg-[#c85612] text-white'
                  }`}
                >
                  {added ? <Check className="w-4 h-4 shrink-0" /> : <ShoppingCart className="w-4 h-4 shrink-0" />}
                  <span>{added ? 'به سبد خرید اضافه شد' : 'افزودن به سبد خرید'}</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    void submitInquiry({ ...product, code: activeSkuCode || product.code, name: displayTitle || product.name, unit: activeUnit || product.unit }, quantity, 'درخواست پیش‌فاکتور رسمی')
                  }
                  className="w-full h-11 sm:h-10 rounded-xl border border-slate-200 bg-white hover:border-[#E06518] hover:text-[#E06518] px-4 text-xs font-bold text-slate-700 flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-[#E06518]" />
                  <span>درخواست پیش‌فاکتور رسمی</span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#E06518]" />
                  <span>ارسال از انبار مرکزی یزد</span>
                </span>
                <a
                  href="tel:03538739900"
                  className="min-h-[36px] inline-flex items-center gap-1 font-bold text-slate-700 hover:text-[#E06518]"
                >
                  <PhoneCall className="w-3.5 h-3.5 text-[#E06518]" />
                  <span dir="ltr" className="font-mono">۰۳۵-۳۸۷۳۹۹۰۰</span>
                </a>
              </div>
            </div>
          </div>

          {/* Column 2 (Left in RTL): Clean High-Speed SKU & Size Selector */}
          <div className="min-w-0">
            <ProductVariants
              variants={visibleVariants}
              selected={activeSkuCode}
              onSelect={handleSelectVariant}
              showPrices={showCommercial}
              familyCode={product.code}
              galleryImages={galleryImages}
            />
          </div>
        </section>

        {/* Clean 2-Tab Technical Specs & Delivery Section (No bloated 4-photo or SKU-marking blocks) */}
        <section className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs">
          <div
            className="grid grid-cols-2 sm:flex border-b border-slate-100 bg-slate-50/60"
            role="tablist"
          >
            {[
              { id: 'specs' as const, shortLabel: 'مشخصات فنی', label: 'مشخصات فنی کد و خانواده', icon: Layers },
              { id: 'delivery' as const, shortLabel: 'برش و ارسال', label: 'شرایط تأمین، برش و ارسال', icon: PackageCheck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={tab.label}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-[46px] flex items-center justify-center sm:justify-start gap-2 px-3 sm:px-5 py-3 text-xs font-black border-b-2 transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-[#E06518] text-[#E06518] bg-white'
                      : 'border-transparent text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 sm:p-6">
            {activeTab === 'specs' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
                {selectedVariant && (
                  <div className="space-y-3">
                    <h3 className="text-xs sm:text-sm font-black text-slate-900">
                      مشخصات کد انتخاب‌شده ({toPersianDigits(selectedVariant.code)})
                    </h3>
                    <div className="overflow-hidden rounded-xl border border-slate-200/90">
                      <table className="w-full text-xs text-right">
                        <tbody className="divide-y divide-slate-100">
                          <tr className="bg-white">
                            <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-500 w-2/5">کد کالا</td>
                            <td className="py-2.5 px-3.5 sm:px-4 font-mono font-bold text-[#E06518]" dir="ltr">
                              {selectedVariant.code}
                            </td>
                          </tr>
                          <tr className="bg-slate-50/50">
                            <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-500">شرح کالا</td>
                            <td className="py-2.5 px-3.5 sm:px-4 font-bold text-slate-900">{selectedVariant.name}</td>
                          </tr>
                          <tr className="bg-white">
                            <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-500">سایز / پروفیل</td>
                            <td className="py-2.5 px-3.5 sm:px-4 font-mono font-bold text-slate-900" dir="ltr">
                              {selectedVariant.size || '—'}
                            </td>
                          </tr>
                          {activeBrand && (
                            <tr className="bg-slate-50/50">
                              <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-500">برند سازنده</td>
                              <td className="py-2.5 px-3.5 sm:px-4 font-bold text-slate-900">{activeBrand}</td>
                            </tr>
                          )}
                          {cleanVariantSpecs.map((spec, idx) => (
                            <tr
                              key={`${spec.key}-${idx}`}
                              className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                            >
                              <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-500">{spec.key}</td>
                              <td className="py-2.5 px-3.5 sm:px-4 font-bold text-slate-800">{spec.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900">
                    مشخصات مشترک خانواده
                  </h3>
                  {cleanFamilySpecs.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-slate-200/90">
                      <table className="w-full text-xs text-right">
                        <tbody className="divide-y divide-slate-100">
                          {cleanFamilySpecs.map((spec, idx) => (
                            <tr
                              key={`${spec.key}-${idx}`}
                              className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                            >
                              <td className="py-2.5 px-3.5 sm:px-4 font-semibold text-slate-500 w-2/5">{spec.key}</td>
                              <td className="py-2.5 px-3.5 sm:px-4 font-bold text-slate-900">{spec.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 text-xs text-slate-600 leading-6">
                      تمامی سایزهای این خانواده مطابق استاندارد صنعتی برند {activeBrand || 'معتبر'} عرضه می‌شوند. برای مشاوره انتخاب سایز یا معادل‌یابی دقیق با واحد فنی تماس بگیرید.
                    </div>
                  )}

                  {selectedTechnicalReview?.note && (
                    <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 text-xs text-slate-700 leading-6 space-y-1">
                      <h4 className="font-black text-slate-900">یادداشت فنی</h4>
                      <p>{selectedTechnicalReview.note}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'delivery' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4 text-xs">
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-1.5">
                  <strong className="text-slate-900 block">ارسال فوری از انبار مرکزی یزد</strong>
                  <p className="text-slate-600 leading-6">
                    سفارش‌های تأییدشده تا ساعت ۱۶ در همان روز کاری از طریق باربری، تیپاکس یا پست پیشتاز ارسال می‌شوند.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-1.5">
                  <strong className="text-slate-900 block">برش و آپارات سفارشی تسمه</strong>
                  <p className="text-slate-600 leading-6">
                    امکان برش تسمه در عرض دلخواه و اتصال حرارتی یا مکانیکی مطابق نقشه دستگاه وجود دارد.
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-1.5">
                  <strong className="text-slate-900 block">تطبیق فنی و معادل‌یابی دقیق</strong>
                  <p className="text-slate-600 leading-6">
                    کلیه کدهای فنی با تطبیق دقیق ابعاد، پروفیل، گام و برند کارخانه تأمین و ارسال می‌گردند.
                  </p>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Clean Minimal Similar Families Grid (2-col on mobile, 4-col on desktop) */}
        {similarProducts.length > 0 && (
          <section className="space-y-3.5 sm:space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-black text-slate-900">
                سایر خانواده‌های مشابه
              </h2>
              {categorySlug && (
                <Link
                  to={`/category/${encodeURIComponent(categorySlug)}`}
                  className="min-h-[36px] inline-flex items-center text-xs font-bold text-[#E06518] hover:underline shrink-0"
                >
                  مشاهده همه
                </Link>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
              {similarProducts.map((sim) => {
                const href = detailHrefFor(sim.code);
                const countVal = Math.max(1, sim.variants?.length || 0);
                return (
                  <article
                    key={sim.code}
                    className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md"
                  >
                    <Link
                      to={href}
                      className="aspect-[4/3] w-full bg-white border-b border-slate-100 p-3 sm:p-5 flex items-center justify-center overflow-hidden"
                    >
                      <ProductImage
                        src={resolveSimilarImage(sim)}
                        alt={sim.name}
                        disableFallback={true}
                        className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.04]"
                      />
                    </Link>
                    <div className="flex flex-1 flex-col p-3 sm:p-4 gap-2.5 sm:gap-3">
                      <div className="space-y-1">
                        <Link
                          to={href}
                          className="block text-xs sm:text-sm font-bold text-slate-900 leading-5 sm:leading-6 line-clamp-2 min-h-[2.5rem] sm:min-h-[3rem] hover:text-[#E06518] transition-colors"
                        >
                          {sim.name}
                        </Link>
                        <p className="text-[11px] sm:text-xs text-slate-500 tabular-nums">
                          {toPersianDigits(countVal)} کد کالا
                        </p>
                      </div>
                      <Link
                        to={href}
                        className="mt-auto h-9 w-full rounded-xl bg-[#E06518] hover:bg-[#c85612] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <span>مشاهده</span>
                        <ArrowLeft size={14} />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}
      </div>

      {/* MOBILE STICKY THUMB-ZONE ACTION BAR (< lg only) */}
      <div
        data-testid="belt-mobile-sticky-bar"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-slate-200/90 bg-white/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(15,23,42,0.06)] px-3.5 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-xl flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={scrollToSkuSelector}
            className="min-w-0 text-right py-1 cursor-pointer"
          >
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 truncate">
              <span className="font-mono text-[#E06518]" dir="ltr">
                {selectedVariant?.size || activeSkuCode}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono text-[11px] font-bold text-slate-600 tabular-nums" dir="ltr">
                {activeSkuCode}
              </span>
            </div>
            <div className="text-[11px] font-semibold text-slate-500 truncate mt-0.5 tabular-nums">
              {hasVisiblePrice
                ? `${formatPrice(activeUnitPrice)} تومان`
                : inCartQty > 0
                  ? `در سبد: ${toPersianDigits(inCartQty)} ${activeUnit}`
                  : `تعداد: ${toPersianDigits(quantity)} ${activeUnit} · تغییر سایز`}
            </div>
          </button>

          <button
            type="button"
            data-testid="belt-mobile-sticky-add"
            onClick={handleAddToCart}
            className={`h-11 px-5 rounded-xl text-xs font-bold shrink-0 inline-flex items-center justify-center gap-2 transition-colors active:scale-[0.98] cursor-pointer ${
              added
                ? 'bg-emerald-600 text-white'
                : 'bg-[#E06518] active:bg-[#c85612] text-white shadow-xs'
            }`}
          >
            {added ? <Check className="w-4 h-4 shrink-0" /> : <ShoppingCart className="w-4 h-4 shrink-0" />}
            <span>{added ? 'اضافه شد' : 'افزودن به سبد خرید'}</span>
          </button>
        </div>
      </div>

      {/* Enlarged Image Zoom Modal */}
      <Modal
        isOpen={Boolean(zoomModal)}
        onClose={() => setZoomModal(null)}
        title={zoomModal?.title || ''}
        size="xl"
      >
        {zoomModal && (
          <div className="space-y-3" dir="rtl">
            {zoomModal.subtitle && (
              <p className="text-xs font-semibold text-slate-500">{zoomModal.subtitle}</p>
            )}
            <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 grid place-items-center max-h-[70vh] overflow-auto">
              <img
                src={zoomModal.imageUrl}
                alt={zoomModal.title}
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-auto object-contain"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
