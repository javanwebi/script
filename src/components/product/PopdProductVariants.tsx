import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import type { ProductGalleryImage, ProductVariant } from '../../types';
import { formatPrice, toPersianDigits } from '../../utils/formatters';
import { normalizeCatalogText } from '../../utils/excelCategoryCatalog';

interface ProductVariantsProps {
  variants: ProductVariant[];
  selected: string;
  onSelect: (code: string) => void;
  showPrices?: boolean;
  familyCode?: string;
  galleryImages?: ProductGalleryImage[];
}

const DESKTOP_PAGE_SIZE = 14;
const MOBILE_PAGE_SIZE = 8;

export const ProductVariants: React.FC<ProductVariantsProps> = ({
  variants,
  selected,
  onSelect,
  showPrices = true,
}) => {
  const [query, setQuery] = useState('');
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => setIsMobileViewport(mq.matches);
    sync();
    mq.addEventListener?.('change', sync);
    return () => mq.removeEventListener?.('change', sync);
  }, []);

  const pageSize = isMobileViewport ? MOBILE_PAGE_SIZE : DESKTOP_PAGE_SIZE;

  const results = useMemo(() => {
    const q = normalizeCatalogText(query);
    if (!q) return variants;
    const tokens = q.split(' ').filter(Boolean);
    return variants.filter((v) => {
      const hay = normalizeCatalogText(
        `${v.code} ${v.size || ''} ${v.model || ''} ${v.name || ''} ${v.brand || ''}`,
      );
      return tokens.every((t) => hay.includes(t));
    });
  }, [variants, query]);

  const computePageForSelected = (list: ProductVariant[], sku: string, size: number) => {
    if (!sku) return 1;
    const idx = list.findIndex((v) => v.code === sku);
    return idx >= 0 ? Math.floor(idx / size) + 1 : 1;
  };

  const [page, setPage] = useState<number>(() =>
    computePageForSelected(variants, selected, pageSize),
  );

  // Sync page when initial selected SKU arrives or family changes (only when search is empty)
  useEffect(() => {
    if (query.trim()) return;
    const targetPage = computePageForSelected(results, selected, pageSize);
    setPage(targetPage);
  }, [selected, variants, pageSize, query, results]);

  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const visibleRows = results.slice((safePage - 1) * pageSize, safePage * pageSize);

  if (!variants.length) return null;

  return (
    <div
      id="belt-sku-selector"
      data-testid="belt-sku-selector"
      className="scroll-mt-28 rounded-2xl border border-slate-200/90 bg-white overflow-hidden shadow-2xs"
    >
      {/* Clean Header + Touch-Friendly Inline Search */}
      <div className="px-4 py-3.5 sm:px-5 sm:py-4 border-b border-slate-100 space-y-3">
        <div className="flex items-start sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-sm sm:text-base font-black text-slate-900">
              انتخاب سایز و کد کالا
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-5">
              روی هر سایز بزنید تا تصویر، مشخصات و سفارش همان کد فعال شود.
            </p>
          </div>
          <span className="text-xs font-bold text-slate-500 tabular-nums shrink-0 pt-0.5 sm:pt-0">
            {results.length === variants.length
              ? `${toPersianDigits(variants.length)} کد`
              : `${toPersianDigits(results.length)} از ${toPersianDigits(variants.length)}`}
          </span>
        </div>

        {variants.length > 5 && (
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
              aria-label="جستجو در سایز، مدل یا کد کالا"
              placeholder="جستجوی سریع سایز، پروفیل یا کد کالا (مثلاً B37 یا 11614)..."
              className="h-11 md:h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pr-10 pl-11 text-sm md:text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-[#E06518] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#E06518]/15 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setPage(1);
                }}
                aria-label="پاک کردن جستجو"
                className="absolute left-1 top-1/2 -translate-y-1/2 min-w-[40px] min-h-[40px] inline-flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* MOBILE (< md): Native Touch-First Full-Width Tap Cards (Zero Horizontal Scroll) */}
      <div className="md:hidden divide-y divide-slate-100" data-testid="belt-sku-mobile-list">
        {visibleRows.map((v) => {
          const isSelected = selected === v.code;
          const unitPrice = v.price ?? v.prices?.retail ?? 0;
          const hasPrice = showPrices && v.inquiryOnly !== true && unitPrice > 0;
          const sizeLabel = v.size || v.model || '—';

          return (
            <button
              key={v.code}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(v.code)}
              className={`w-full min-h-[68px] px-4 py-3.5 text-right flex items-center justify-between gap-3 transition-colors active:bg-orange-50/90 cursor-pointer ${
                isSelected ? 'bg-orange-50/80' : 'bg-white hover:bg-slate-50/80'
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    dir="ltr"
                    className={`font-mono font-black text-sm tracking-tight ${
                      isSelected ? 'text-[#E06518]' : 'text-slate-900'
                    }`}
                  >
                    {sizeLabel}
                  </span>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span
                    dir="ltr"
                    className="font-mono tabular-nums font-semibold text-slate-500"
                  >
                    کد {v.code}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-700 leading-5 truncate">
                  {v.name}
                </div>

                {hasPrice && (
                  <div className="text-[11px] font-bold text-emerald-700 tabular-nums">
                    {formatPrice(unitPrice)} تومان
                  </div>
                )}
              </div>

              <span
                className={`shrink-0 h-9 min-w-[82px] px-3 rounded-xl text-xs font-bold inline-flex items-center justify-center gap-1 transition-colors ${
                  isSelected
                    ? 'bg-[#E06518] text-white shadow-2xs'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {isSelected ? (
                  <>
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>انتخاب شد</span>
                  </>
                ) : (
                  <span>انتخاب</span>
                )}
              </span>
            </button>
          );
        })}

        {!results.length && (
          <div className="py-10 px-4 text-center space-y-3">
            <p className="text-xs font-bold text-slate-700">
              کد یا سایزی مطابق با جستجوی شما پیدا نشد.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setPage(1);
              }}
              className="h-10 px-4 rounded-xl bg-orange-50 text-xs font-bold text-[#E06518] cursor-pointer"
            >
              نمایش همه سایزها
            </button>
          </div>
        )}
      </div>

      {/* DESKTOP (>= md): Crisp 4-Column Industrial SKU Table */}
      <div className="hidden md:block overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-xs text-right border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200/90 text-[11px] text-slate-500">
            <tr>
              <th className="py-2.5 px-4 font-bold whitespace-nowrap">کد کالا</th>
              <th className="py-2.5 px-3 font-bold whitespace-nowrap">سایز / پروفیل</th>
              <th className="py-2.5 px-3 font-bold">شرح دقیق تسمه</th>
              <th className="py-2.5 px-4 font-bold text-left whitespace-nowrap">انتخاب</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleRows.map((v) => {
              const isSelected = selected === v.code;
              const unitPrice = v.price ?? v.prices?.retail ?? 0;
              const hasPrice = showPrices && v.inquiryOnly !== true && unitPrice > 0;

              return (
                <tr
                  key={v.code}
                  onClick={() => onSelect(v.code)}
                  className={`cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-orange-50/80 hover:bg-orange-50'
                      : 'bg-white hover:bg-slate-50/80'
                  }`}
                >
                  <td className="py-3 px-4 whitespace-nowrap">
                    <span
                      dir="ltr"
                      className={`inline-block font-mono tabular-nums font-bold ${
                        isSelected ? 'text-[#E06518]' : 'text-slate-700'
                      }`}
                    >
                      {v.code}
                    </span>
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    <span
                      dir="ltr"
                      className="inline-block font-mono font-bold text-slate-900"
                    >
                      {v.size || v.model || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-3 min-w-[180px]">
                    <div className="font-semibold text-slate-800 leading-5">
                      {v.name}
                    </div>
                    {hasPrice && (
                      <div className="mt-0.5 text-[11px] font-bold text-emerald-700 tabular-nums">
                        {formatPrice(unitPrice)} تومان
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-left whitespace-nowrap">
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect(v.code);
                      }}
                      className={`h-8 px-3 rounded-lg text-[11px] font-bold inline-flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#E06518] text-white shadow-2xs'
                          : 'border border-slate-200 bg-white text-slate-700 hover:border-[#E06518] hover:text-[#E06518]'
                      }`}
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 shrink-0" />
                          <span>انتخاب‌شده</span>
                        </>
                      ) : (
                        <span>انتخاب</span>
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!results.length && (
          <div className="py-10 px-4 text-center space-y-2">
            <p className="text-xs font-bold text-slate-700">
              کد یا سایزی مطابق با جستجوی شما پیدا نشد.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setPage(1);
              }}
              className="text-xs font-bold text-[#E06518] hover:underline cursor-pointer"
            >
              نمایش همه سایزها
            </button>
          </div>
        )}
      </div>

      {/* Touch-Friendly Pagination Bar (44px targets on mobile, 32px on desktop) */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50/60 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-11 md:h-8 px-4 md:px-3.5 rounded-xl md:rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:border-[#E06518] hover:text-[#E06518] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4 md:hidden" />
            <span>قبلی</span>
          </button>
          <span className="font-semibold text-slate-500 tabular-nums">
            صفحه {toPersianDigits(safePage)} از {toPersianDigits(totalPages)}
          </span>
          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-11 md:h-8 px-4 md:px-3.5 rounded-xl md:rounded-lg border border-slate-200 bg-white font-bold text-slate-700 hover:border-[#E06518] hover:text-[#E06518] disabled:opacity-40 disabled:pointer-events-none inline-flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>بعدی</span>
            <ChevronLeft className="w-4 h-4 md:hidden" />
          </button>
        </div>
      )}
    </div>
  );
};
