import React, { useEffect, useRef, useState } from "react";
import { ArrowUpLeft, Image as ImageIcon, Loader2, Plus, X } from "lucide-react";
import { Link } from "react-router-dom";
import { apiUrl } from "../../config/apiConfig";
import { useAuth } from "../../context/AuthContext";
import { memberPath } from "../storefront/MemberAccess";
import { CatalogFinderIcon } from "../forza/ForzaWorkspaceIcons";

export type ConsultationCatalogProduct = {
  code: string;
  name: string;
  size?: string;
  image?: string;
  link?: string;
};

export interface WorkspaceCatalogResult {
  code: string;
  name: string;
  brand?: string;
  images?: string[];
  link: string;
  variants: { code: string; size: string; name?: string }[];
}

type CatalogResponse = {
  success?: boolean;
  familyCount: number;
  skuCount: number;
  results: WorkspaceCatalogResult[];
};

export function WorkspaceCatalog({
  onSelect,
  onAddToConsultation,
  onClose,
  disabled = false,
}: {
  onSelect?: (product: WorkspaceCatalogResult) => void;
  onAddToConsultation?: (product: ConsultationCatalogProduct) => void;
  onClose?: () => void;
  disabled?: boolean;
}) {
  const { currentUser, openAuthModal } = useAuth();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [expanded]);

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setData(null);
      setError("");
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(apiUrl("/api/ai/catalog-search?q=" + encodeURIComponent(value)), {
          signal: controller.signal,
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("CATALOG_UNAVAILABLE");
        const payload = (await response.json()) as CatalogResponse;
        if (payload.success === false || !Array.isArray(payload.results)) throw new Error("CATALOG_INVALID");
        if (!controller.signal.aborted) setData(payload);
      } catch {
        if (!controller.signal.aborted) {
          setError("دریافت پیشنهادهای کاتالوگ ممکن نشد. دوباره تلاش کنید.");
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 220);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (family: WorkspaceCatalogResult, variant?: WorkspaceCatalogResult["variants"][number]) => {
    const image = typeof family.images?.[0] === "string" ? family.images[0] : undefined;
    setQuery("");
    setExpanded(false);
    setData(null);
    if (variant && onAddToConsultation) {
      onAddToConsultation({ code: variant.code, name: variant.name || family.name, size: variant.size, image, link: family.link });
      return;
    }
    if (onSelect) {
      onSelect(family);
      return;
    }
    onAddToConsultation?.({ code: family.code, name: family.name, image, link: family.link });
  };

  return (
    <section
      ref={containerRef}
      className="forza-product-finder relative isolate mx-auto w-full max-w-[740px]"
      dir="rtl"
      aria-label="جست‌وجوی محصول برای مشاوره فورزا"
    >
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <label htmlFor="forza-workspace-product-search" className="sr-only">
            جست‌وجوی زنده کاتالوگ قطعات
          </label>
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[#74757C]">
            <CatalogFinderIcon size={16} />
          </span>
          <input
            id="forza-workspace-product-search"
            type="search"
            autoComplete="off"
            aria-controls="forza-workspace-catalog-suggestions"
            aria-expanded={expanded && query.trim().length > 0}
            aria-autocomplete="list"
            value={query}
            onChange={(event) => {
              setData(null);
              setError("");
              setBusy(Boolean(event.target.value.trim()));
              setQuery(event.target.value);
              setExpanded(true);
            }}
            onFocus={() => setExpanded(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                if (expanded) setExpanded(false);
                else onClose?.();
              }
            }}
            placeholder="جستجوی کد SKU، نام قطعه یا ابعاد در کاتالوگ..."
            className="h-10 w-full rounded-xl border border-[#DFE3E6] bg-[#F5F6F6] pr-10 pl-9 text-xs sm:text-[13px] font-medium text-[#2B313A] outline-none transition-colors placeholder:text-[#74757C] focus:border-[#E06518] focus:bg-[#FFFFFF]"
          />
          {busy && (
            <Loader2
              aria-label="در حال جست‌وجو"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 animate-spin text-[#E06518]"
            />
          )}
          {!busy && query && (
            <button
              type="button"
              aria-label="پاک کردن جست‌وجو"
              onClick={() => {
                setQuery("");
                setExpanded(false);
              }}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 min-w-[30px] min-h-[30px] rounded-lg flex items-center justify-center text-[#55565A] hover:bg-[#E5E7EB]/60 cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {currentUser ? (
          <Link
            to={memberPath(currentUser)}
            className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-[#DFE3E6] bg-[#FFFFFF] hover:bg-[#F5F6F6] hover:border-[#E06518]/50 text-xs font-semibold text-[#2B313A] transition-colors whitespace-nowrap shrink-0"
          >
            <span>پنل و قیمت‌نامه</span>
            <ArrowUpLeft size={14} className="text-[#74757C]" />
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => openAuthModal(memberPath(null), "register")}
            className="hidden sm:inline-flex items-center gap-1.5 min-h-[40px] px-3.5 rounded-xl border border-[#DFE3E6] bg-[#FFFFFF] hover:bg-[#F5F6F6] hover:border-[#E06518]/50 text-xs font-semibold text-[#2B313A] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <span>قیمت و استعلام</span>
            <ArrowUpLeft size={14} className="text-[#74757C]" />
          </button>
        )}

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="بستن جستجوی کاتالوگ"
            className="min-w-[40px] min-h-[40px] rounded-xl border border-[#DFE3E6] bg-[#FFFFFF] hover:bg-[#F3F4F6] text-[#55565A] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {expanded && query.trim() && (
        <div
          id="forza-workspace-catalog-suggestions"
          role="region"
          aria-label="نتایج جست‌وجوی محصولات"
          aria-live="polite"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(58dvh,420px)] overflow-y-auto overscroll-contain rounded-2xl border border-[#DFE3E6] bg-[#FFFFFF] p-2 shadow-[0_18px_45px_-12px_rgba(43,49,58,0.16)]"
        >
          {busy && !data && (
            <p className="p-4 text-xs text-[#74757C] font-medium">در حال جست‌وجو در کاتالوگ صنعت پیش…</p>
          )}
          {error && (
            <p role="alert" className="p-4 text-xs text-rose-700 font-medium">
              {error}
            </p>
          )}
          {!busy && !error && data && data.results.length === 0 && (
            <p className="p-4 text-xs text-[#55565A] leading-relaxed">
              محصول منطبق پیدا نشد؛ کد یا مشخصات دقیق‌تری وارد کنید.
            </p>
          )}
          {data?.results.map((family) => {
            const image = typeof family.images?.[0] === "string" ? family.images[0] : "";
            const showImage = Boolean(image) && !failedImages[family.code];
            const variants = Array.isArray(family.variants) ? family.variants : [];
            return (
              <article
                key={family.code}
                className="mb-1.5 rounded-xl border border-[#E7E8EC] bg-[#FAFBFB] p-2.5 last:mb-0 hover:bg-[#F3F4F6]/80 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#DFE3E6] bg-[#FFFFFF] p-1">
                    {showImage ? (
                      <img
                        src={image}
                        alt={"تصویر مرجع " + family.name}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        onError={() => setFailedImages(prev => ({ ...prev, [family.code]: true }))}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <ImageIcon size={18} className="text-[#CBD2D8]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <strong className="block truncate text-xs font-bold text-[#2B313A] sm:text-sm">
                      {family.name}
                    </strong>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#74757C]">
                      {family.brand && <span className="font-semibold text-[#55565A]">{family.brand}</span>}
                      {family.brand && <span aria-hidden="true">·</span>}
                      <span className="truncate font-mono tabular-nums" dir="ltr">
                        {family.code}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => choose(family)}
                    className="inline-flex min-h-[38px] shrink-0 items-center gap-1 rounded-xl bg-[#2B313A] hover:bg-[#E06518] px-3.5 text-xs font-bold text-white transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                  >
                    <span>مشاوره</span>
                    <ArrowUpLeft size={14} />
                  </button>
                </div>

                {variants.length > 0 && (
                  <div
                    className="mt-2 flex flex-wrap gap-1.5 border-t border-[#E7E8EC] pt-2"
                    aria-label={"انتخاب کد کالا برای " + family.name}
                  >
                    {variants.slice(0, 12).map((variant) => (
                      <button
                        key={variant.code}
                        type="button"
                        disabled={disabled}
                        onClick={() => choose(family, variant)}
                        className="inline-flex min-h-[34px] max-w-full items-center gap-1.5 rounded-lg border border-[#DFE3E6] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-semibold text-[#2B313A] hover:border-[#E06518] hover:text-[#E06518] disabled:opacity-50 cursor-pointer transition-colors whitespace-nowrap"
                      >
                        <Plus size={12} className="text-[#E06518] shrink-0" />
                        <span dir="ltr" className="font-mono tabular-nums">
                          {variant.code}
                        </span>
                        {variant.size && (
                          <span className="max-w-32 truncate text-[#74757C] font-normal">
                            {variant.size}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <div className="mt-2 flex items-center justify-between pt-1 text-[11px]">
                  <Link
                    to={family.link || "/product/" + encodeURIComponent(family.code)}
                    onClick={() => setExpanded(false)}
                    className="inline-flex items-center gap-1 font-semibold text-[#74757C] hover:text-[#E06518] transition-colors"
                  >
                    <span>مشاهده مشخصات کامل</span>
                    <ArrowUpLeft size={12} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-[#74757C]">
        <span>تطبیق نهایی قطعه با دستگاه باید تأیید شود؛ قیمت یا موجودی حدسی نمایش داده نمی‌شود.</span>
      </div>
    </section>
  );
}
