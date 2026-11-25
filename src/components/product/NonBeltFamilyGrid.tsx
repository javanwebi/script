import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check,
  ChevronLeft,
  Cog,
  RotateCcw,
  Search,
  ShoppingCart,
  X,
  ZoomIn,
} from 'lucide-react';
import type { Product } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';
import { Modal } from '../ui/Modal';
import { formatPrice, toPersianDigits } from '../../utils/formatters';
import {
  buildNonBeltGridItems,
  filterNonBeltGridItems,
  getCleanVariantSpecs,
  type NonBeltGridItem,
} from '../../utils/nonBeltFamilyDisplay';

interface NonBeltFamilyGridProps {
  product: Product;
  categorySlug: string;
  categoryTitle: string;
  initialHighlightCode?: string;
}

const PAGE_STEP = 24;

export const NonBeltFamilyGrid: React.FC<NonBeltFamilyGridProps> = ({
  product,
  categorySlug,
  categoryTitle,
  initialHighlightCode = '',
}) => {
  const { addToCart, cart } = useCart();
  const { currentUser } = useAuth();
  const panelMode = Boolean(currentUser);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_STEP);
  const [recentlyAddedCode, setRecentlyAddedCode] = useState<string | null>(null);
  const [previewItem, setPreviewItem] = useState<NonBeltGridItem | null>(null);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const allItems = useMemo(
    () =>
      buildNonBeltGridItems(
        product.variants || [],
        product.name,
        product.prices?.retail || 0,
      ),
    [product.variants, product.name, product.prices?.retail],
  );

  const uniquePhotoCount = useMemo(
    () => allItems.filter((item) => item.hasRealPhoto).length,
    [allItems],
  );

  const filteredItems = useMemo(
    () => filterNonBeltGridItems(allItems, searchQuery),
    [allItems, searchQuery],
  );

  const visibleItems = useMemo(
    () => filteredItems.slice(0, visibleCount),
    [filteredItems, visibleCount],
  );

  const cartQtyByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of cart) {
      map.set(entry.product.code, entry.quantity);
    }
    return map;
  }, [cart]);

  const handleAddSkuToCart = (item: NonBeltGridItem) => {
    const { variant, displayTitle, uniqueImageUrl, unitPrice } = item;
    const cartProduct: Product = {
      ...product,
      code: variant.code,
      name: displayTitle,
      brand: variant.brand || product.brand,
      unit: variant.unit || product.unit || 'عدد',
      prices: {
        base: unitPrice,
        retail: unitPrice,
        wholesale: variant.prices?.wholesale ?? unitPrice,
        dealer: variant.prices?.dealer ?? unitPrice,
      },
      images: uniqueImageUrl ? [uniqueImageUrl] : product.images?.slice(0, 1) || [],
      image: uniqueImageUrl || product.image,
    };
    addToCart(cartProduct, 1);
    setRecentlyAddedCode(variant.code);
    window.setTimeout(() => {
      setRecentlyAddedCode((curr) => (curr === variant.code ? null : curr));
    }, 1700);
  };

  return (
    <div className="min-h-[70vh] bg-[#F8FAFC] py-6 sm:py-8" dir="rtl">
      <div className="mx-auto max-w-[1320px] px-4 sm:px-6 space-y-6">
        {/* Clean Breadcrumb */}
        <nav
          aria-label="مسیر صفحه"
          className="flex items-center gap-1.5 text-xs text-slate-500 overflow-x-auto whitespace-nowrap"
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

        {/* Minimal Industrial Family Header */}
        <header className="rounded-2xl border border-slate-200 bg-white px-5 py-5 sm:px-7 sm:py-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight text-balance">
              {product.name}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span>{categoryTitle}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-medium text-slate-700">
                {toPersianDigits(allItems.length)} کد کالا
              </span>
              {uniquePhotoCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-slate-600">
                    {toPersianDigits(uniquePhotoCount)} کد با تصویر اختصاصی در اولویت
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Single Clean Quick Search inside Family */}
          <div className="relative w-full md:w-80 shrink-0">
            <Search
              className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setVisibleCount(PAGE_STEP);
              }}
              placeholder={`جستجوی کد یا سایز در ${product.name}...`}
              aria-label={`جستجوی کد کالا در ${product.name}`}
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/70 pr-10 pl-9 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-[#E06518] focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="پاک کردن جستجو"
                className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </header>

        {/* Clean Card-by-Card SKU Grid */}
        {filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-14 px-6 text-center space-y-3">
            <p className="text-sm font-bold text-slate-900">
              کد کالایی مطابق جستجوی شما در خانواده «{product.name}» پیدا نشد.
            </p>
            <p className="text-xs text-slate-500">
              عبارت جستجو را کوتاه‌تر وارد کنید یا همه کدهای این خانواده را ببینید.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#E06518] px-4 py-2 text-xs font-bold text-white hover:bg-[#c85612] transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>نمایش همه کدها</span>
            </button>
          </div>
        ) : (
          <>
            <section
              aria-label={`کدهای کالای ${product.name}`}
              data-testid="nonbelt-sku-grid"
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {visibleItems.map((item) => {
                const { variant, uniqueImageUrl, displayTitle, specSummary, unitPrice } = item;
                const imgBroken = Boolean(failedImages[variant.code]);
                const showPhoto = Boolean(uniqueImageUrl && !imgBroken);
                const inCartQty = cartQtyByCode.get(variant.code) || 0;
                const isJustAdded = recentlyAddedCode === variant.code;
                const isHighlighted =
                  Boolean(initialHighlightCode) &&
                  variant.code.toLowerCase() === initialHighlightCode.toLowerCase();

                return (
                  <article
                    key={variant.code}
                    data-testid="nonbelt-sku-card"
                    className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                      isHighlighted
                        ? 'border-[#E06518] ring-2 ring-[#E06518]/15'
                        : 'border-slate-200/90 hover:border-slate-300'
                    }`}
                  >
                    {/* 4:3 Pure White Image Canvas */}
                    <button
                      type="button"
                      onClick={() => setPreviewItem(item)}
                      aria-label={`بزرگ‌نمایی و مشخصات ${displayTitle}`}
                      className="relative aspect-[4/3] w-full bg-white border-b border-slate-100 flex items-center justify-center overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#E06518]"
                    >
                      {showPhoto ? (
                        <>
                          <img
                            src={uniqueImageUrl!}
                            alt={displayTitle}
                            loading="lazy"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={() =>
                              setFailedImages((prev) => ({ ...prev, [variant.code]: true }))
                            }
                            className="w-full h-full object-contain p-5 transition-transform duration-200 group-hover:scale-[1.04]"
                          />
                          <span
                            aria-hidden="true"
                            className="absolute bottom-2.5 left-2.5 w-7 h-7 rounded-lg bg-slate-900/5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </span>
                        </>
                      ) : (
                        <div className="w-full h-full bg-[#F8FAFC] flex flex-col items-center justify-center gap-2.5 px-4 text-center">
                          <div className="w-12 h-12 rounded-xl border border-slate-200 bg-white text-slate-400 grid place-items-center">
                            <Cog className="w-5 h-5 stroke-[1.6]" aria-hidden="true" />
                          </div>
                          <span
                            dir="ltr"
                            className="font-mono tabular-nums text-xs font-semibold text-slate-600"
                          >
                            {variant.code}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            تصویر اختصاصی در حال تکمیل
                          </span>
                        </div>
                      )}
                    </button>

                    {/* Clean Minimal Content */}
                    <div className="flex flex-1 flex-col p-4 gap-3">
                      <div className="space-y-1.5">
                        <button
                          type="button"
                          onClick={() => setPreviewItem(item)}
                          className="text-right text-[14px] font-bold text-slate-900 leading-6 line-clamp-2 hover:text-[#E06518] transition-colors cursor-pointer"
                        >
                          {displayTitle}
                        </button>

                        <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                          <span className="truncate">
                            کد:{' '}
                            <strong
                              dir="ltr"
                              className="font-mono tabular-nums font-semibold text-slate-700"
                            >
                              {variant.code}
                            </strong>
                          </span>
                          {inCartQty > 0 && (
                            <span className="tabular-nums text-[11px] font-semibold text-emerald-700 shrink-0">
                              در سبد: {toPersianDigits(inCartQty)}
                            </span>
                          )}
                        </div>

                        {specSummary && (
                          <p className="text-[11px] text-slate-500 line-clamp-1">
                            {specSummary}
                          </p>
                        )}
                      </div>

                      {/* Price Line (when commercial price exists) */}
                      {panelMode && unitPrice > 0 && (
                        <div className="text-sm font-black text-slate-900 tabular-nums">
                          {formatPrice(unitPrice)}{' '}
                          <span className="text-[11px] font-medium text-slate-500">تومان</span>
                        </div>
                      )}

                      {/* Direct Add-to-Cart Button pinned cleanly at bottom */}
                      <div className="mt-auto pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddSkuToCart(item)}
                          className={`w-full h-10 rounded-xl px-4 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                            isJustAdded
                              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                              : 'bg-[#E06518] text-white hover:bg-[#c85612]'
                          }`}
                        >
                          {isJustAdded ? (
                            <>
                              <Check className="w-4 h-4 shrink-0" />
                              <span>به سبد خرید اضافه شد</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-4 h-4 shrink-0" />
                              <span>افزودن به سبد خرید</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Load More Button for Large Families */}
            {filteredItems.length > visibleCount && (
              <div className="flex flex-col items-center gap-2 pt-2">
                <p className="text-xs text-slate-500 tabular-nums">
                  نمایش {toPersianDigits(visibleItems.length)} از{' '}
                  {toPersianDigits(filteredItems.length)} کد کالا
                </p>
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_STEP)}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-6 text-xs font-bold text-slate-800 hover:border-[#E06518] hover:text-[#E06518] transition-colors cursor-pointer"
                >
                  نمایش کدهای بیشتر ({toPersianDigits(filteredItems.length - visibleItems.length)}{' '}
                  کد باقی‌مانده)
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clean Enlarged Preview & Specs Modal */}
      {previewItem && (
        <Modal
          isOpen={Boolean(previewItem)}
          onClose={() => setPreviewItem(null)}
          title={previewItem.displayTitle}
        >
          <div className="space-y-5" dir="rtl">
            <div className="aspect-[4/3] w-full rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden p-6">
              {previewItem.uniqueImageUrl && !failedImages[previewItem.variant.code] ? (
                <img
                  src={previewItem.uniqueImageUrl}
                  alt={previewItem.displayTitle}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="text-center space-y-2 text-slate-400">
                  <Cog className="w-10 h-10 mx-auto stroke-[1.5]" />
                  <p className="text-xs font-mono tabular-nums text-slate-600" dir="ltr">
                    {previewItem.variant.code}
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">کد فنی کالا</span>
                <strong className="font-mono tabular-nums text-slate-900" dir="ltr">
                  {previewItem.variant.code}
                </strong>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-500">خانواده قطعه</span>
                <strong className="text-slate-900">{product.name}</strong>
              </div>
              {previewItem.variant.size && (
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">سایز / ابعاد</span>
                  <strong className="text-slate-900" dir="ltr">
                    {previewItem.variant.size}
                  </strong>
                </div>
              )}
              {getCleanVariantSpecs(previewItem.variant).slice(0, 6).map((spec) => (
                <div
                  key={spec.key}
                  className="flex items-center justify-between py-2 border-b border-slate-100"
                >
                  <span className="text-slate-500">{spec.key}</span>
                  <strong className="text-slate-900">{spec.value}</strong>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                handleAddSkuToCart(previewItem);
                setPreviewItem(null);
              }}
              className="w-full h-11 rounded-xl bg-[#E06518] hover:bg-[#c85612] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>افزودن به سبد خرید</span>
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
