import React, { useEffect, useState } from "react";
import { ArrowUpLeft, Image as ImageIcon, Loader2, Plus, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { apiUrl } from "../../config/apiConfig";
import { useAuth } from "../../context/AuthContext";
import { memberPath } from "../storefront/MemberAccess";

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
  disabled = false,
}: {
  onSelect?: (product: WorkspaceCatalogResult) => void;
  onAddToConsultation?: (product: ConsultationCatalogProduct) => void;
  disabled?: boolean;
}) {
  const { currentUser, openAuthModal } = useAuth();
  const [query, setQuery] = useState("");
  const [data, setData] = useState<CatalogResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState(false);

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
    }, 240);
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
    <section className="forza-product-finder relative isolate mx-auto w-full max-w-4xl" dir="rtl" aria-label="جست‌وجوی محصول برای مشاوره فورزا">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-right">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#E06518]">
            <Search size={18} />
          </span>
          <div>
            <strong className="block text-xs font-black text-slate-800 sm:text-sm">دنبال محصولی هستید؟ برای مشاوره جست‌وجو کنید</strong>
            <span className="text-[11px] text-slate-500">کد دقیق یا نام قطعه را انتخاب کنید؛ فورزا درباره کاربرد و سازگاری راهنمایی می‌کند.</span>
          </div>
        </div>
        <span className="hidden rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 sm:inline-flex">کاتالوگ واقعی صنعت پیش</span>
      </div>
      <div className="relative">
        <label htmlFor="forza-workspace-product-search" className="sr-only">جست‌وجوی زنده کاتالوگ قطعات</label>
        <Search aria-hidden="true" size={18} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id="forza-workspace-product-search"
          type="search"
          autoComplete="off"
          aria-controls="forza-workspace-catalog-suggestions"
          aria-expanded={expanded && query.trim().length > 0}
          aria-autocomplete="list"
          value={query}
          onChange={event => { setData(null); setError(""); setBusy(Boolean(event.target.value.trim())); setQuery(event.target.value); setExpanded(true); }}
          onFocus={() => setExpanded(true)}
          onKeyDown={event => { if (event.key === "Escape") setExpanded(false); }}
          placeholder="نام قطعه، کد SKU یا ابعاد را بنویسید…"
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white pr-10 pl-10 text-sm font-medium text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-[#E06518] focus:ring-2 focus:ring-orange-100"
        />
        {busy && <Loader2 aria-label="در حال جست‌وجو" size={17} className="absolute left-4 top-3.5 animate-spin text-[#E06518]" />}
        {!busy && query && (
          <button type="button" aria-label="پاک کردن جست‌وجو" onClick={() => { setQuery(""); setExpanded(false); }} className="absolute left-3 top-2.5 rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X size={17} />
          </button>
        )}
      </div>
      {expanded && query.trim() && (
        <div
          id="forza-workspace-catalog-suggestions"
          role="region"
          aria-label="نتایج جست‌وجوی محصولات"
          aria-live="polite"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[min(55dvh,430px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_45px_rgba(15,23,42,0.16)]"
        >
          {busy && !data && <p className="p-4 text-xs text-slate-500">در حال جست‌وجوی کاتالوگ…</p>}
          {error && <p role="alert" className="p-4 text-xs text-rose-700">{error}</p>}
          {!busy && !error && data && data.results.length === 0 &&
            <p className="p-4 text-xs text-slate-600">محصول منطبق پیدا نشد؛ کد یا مشخصات دقیق‌تری وارد کنید. امکان استعلام و درخواست ساخت هم وجود دارد.</p>}
          {data?.results.map(family => {
            const image = typeof family.images?.[0] === "string" ? family.images[0] : "";
            const variants = Array.isArray(family.variants) ? family.variants : [];
            return (
              <article key={family.code} className="mb-2 rounded-xl border border-slate-100 bg-slate-50/70 p-2 last:mb-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {image ? <img src={image} alt={"تصویر مرجع " + family.name} loading="lazy" decoding="async" className="h-full w-full object-contain" /> : <ImageIcon size={21} className="text-slate-300" />}
                  </div>
                  <div className="min-w-0 flex-1 text-right">
                    <strong className="block truncate text-xs font-black text-slate-800 sm:text-sm">{family.name}</strong>
                    {family.brand && <span className="text-[10px] text-slate-500">{family.brand}</span>}
                    <span className="block truncate text-[10px] font-semibold text-slate-500" dir="ltr">{family.code}</span>
                  </div>
                  <button type="button" disabled={disabled} onClick={() => choose(family)} className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl bg-[#E06518] px-3 text-xs font-black text-white transition hover:bg-orange-700 disabled:opacity-50">
                    مشاوره <ArrowUpLeft size={14} />
                  </button>
                </div>
                {variants.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-200/70 pt-2" aria-label={"انتخاب کد کالا برای " + family.name}>
                    {variants.slice(0, 12).map(variant => (
                      <button key={variant.code} type="button" disabled={disabled} onClick={() => choose(family, variant)} className="inline-flex min-h-9 max-w-full items-center gap-1 rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:border-[#E06518] hover:bg-orange-50 disabled:opacity-50">
                        <Plus size={13} className="text-[#E06518]" />
                        <span dir="ltr">{variant.code}</span>
                        {variant.size && <span className="max-w-32 truncate text-slate-500">{variant.size}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <Link to={family.link || ("/product/" + encodeURIComponent(family.code))} onClick={() => setExpanded(false)} className="mt-2 inline-flex items-center gap-1 px-1 text-[11px] font-bold text-slate-600 underline-offset-2 hover:text-[#E06518] hover:underline">
                  مشاهده تصویر و مشخصات کامل <ArrowUpLeft size={12} />
                </Link>
              </article>
            );
          })}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
        <span>تطبیق نهایی قطعه با دستگاه باید تأیید شود؛ قیمت یا موجودی حدسی نمایش داده نمی‌شود.</span>
        {currentUser ? (
          <Link to={memberPath(currentUser)} className="font-bold text-[#A64B14] hover:underline">پنل و قیمت‌نامه من <ArrowUpLeft size={12} className="inline" /></Link>
        ) : (
          <button type="button" onClick={() => openAuthModal(memberPath(null), "register")} className="font-bold text-[#A64B14] hover:underline">ورود / ثبت‌نام برای قیمت و استعلام</button>
        )}
      </div>
    </section>
  );
}
