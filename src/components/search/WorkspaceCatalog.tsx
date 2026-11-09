import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowUpLeft, Database, Plus } from "lucide-react";
import { apiUrl } from "../../config/apiConfig";

export type ConsultationCatalogProduct = {
  code: string;
  name: string;
  size?: string;
};

interface Result {
  code: string;
  name: string;
  link: string;
  variants: { code: string; size: string }[];
}

export function WorkspaceCatalog({
  onAddToConsultation,
}: {
  onAddToConsultation?: (product: ConsultationCatalogProduct) => void;
}) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<{
    familyCount: number;
    skuCount: number;
    results: Result[];
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          apiUrl("/api/ai/catalog-search?q=" + encodeURIComponent(query)),
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error();
        setData(await response.json());
      } catch {
        if (!controller.signal.aborted) {
          setError("دریافت کاتالوگ ممکن نشد؛ دوباره جستجو کنید.");
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, query ? 300 : 0);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <section className="workspace-catalog space-y-3" aria-label="جستجوی محصولات برای مشاوره">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <Database size={17} className="text-[#E56B1E]" />
        <span className="font-bold">انتخاب محصول از کاتالوگ صنعت پیش</span>
        {data && (
          <small className="mr-auto text-slate-400">
            {data.familyCount.toLocaleString("fa-IR")} خانواده · {data.skuCount.toLocaleString("fa-IR")} کد کالا
          </small>
        )}
      </div>
      <label className="flex min-h-12 items-center gap-2 rounded-xl border border-[#CBD2D8] bg-white px-3 focus-within:border-[#E56B1E]">
        <Search size={19} className="shrink-0 text-slate-400" />
        <input
          type="search"
          aria-label="جستجوی محصول برای مشاوره"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="کد، نام، برند یا ابعاد قطعه را جستجو کنید…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </label>
      <div aria-live="polite" className="space-y-2">
        {busy && <p className="text-xs text-slate-500">در حال جستجو در کاتالوگ واقعی…</p>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        {!busy && query && data && !data.results.length && (
          <p className="rounded-xl bg-white p-3 text-xs text-slate-500">محصولی با این مشخصات پیدا نشد؛ نام یا کد دقیق‌تری وارد کنید.</p>
        )}
        {query && data?.results.map((product) => (
          <article key={product.code} className="rounded-xl border border-[#E2E6E9] bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <Link to={product.link} className="min-w-0 flex-1 text-right">
                <strong className="block truncate text-sm text-slate-800">{product.name}</strong>
                <small className="mt-1 block text-[11px] text-slate-500" dir="ltr">
                  {product.variants.length ? product.variants.map(variant => variant.code).join(" · ") : product.code}
                </small>
              </Link>
              <Link to={product.link} aria-label="مشاهده محصول" className="rounded-lg bg-slate-50 p-2 text-slate-500">
                <ArrowUpLeft size={17} />
              </Link>
            </div>
            {product.variants.length > 0 && onAddToConsultation && (
              <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.slice(0, 12).map((variant) => (
                  <button
                    key={variant.code}
                    type="button"
                    onClick={() => onAddToConsultation({ code: variant.code, name: product.name, size: variant.size })}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 text-[11px] font-bold text-[#A64B14] hover:bg-orange-100"
                  >
                    <Plus size={13} />
                    <span dir="ltr">{variant.code}</span>
                    {variant.size && <span className="text-orange-800/70">{variant.size}</span>}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
      </div>
      <p className="text-[11px] leading-5 text-slate-400">کد انتخاب‌شده به مشاوره اضافه می‌شود؛ FORZA مشخصات را از کاتالوگ واقعی بررسی می‌کند و نتیجه را در پرونده مشتری ثبت می‌کند.</p>
    </section>
  );
}
