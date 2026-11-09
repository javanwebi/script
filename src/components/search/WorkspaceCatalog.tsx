import React, { useEffect, useState } from "react";
import { Search, ArrowUpLeft, Database, Plus } from "lucide-react";
import { apiUrl } from "../../config/apiConfig";
export type ConsultationCatalogProduct = { code: string; name: string; size?: string };
interface Result {
  code: string;
  name: string;
  images?: string[];
  link: string;
  variants: { code: string; size: string }[];
}
export function WorkspaceCatalog({onSelect,onAddToConsultation,disabled=false}: {onSelect?:(product:Result)=>void;onAddToConsultation?:(product:ConsultationCatalogProduct)=>void;disabled?:boolean}) {
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
    const timer = setTimeout(
      async () => {
        setBusy(true);
        setError("");
        try {
          const r = await fetch(
            apiUrl("/api/ai/catalog-search?q=" + encodeURIComponent(query)),
            { signal: controller.signal },
          );
          if (!r.ok) throw Error();
          const result = await r.json();
          if (!controller.signal.aborted) setData(result);
        } catch {
          if (!controller.signal.aborted) {
            setError("دریافت کاتالوگ ممکن نشد؛ دوباره جستجو کنید.");
            setData(null);
          }
        } finally {
          if (!controller.signal.aborted) setBusy(false);
        }
      },
      query ? 300 : 0,
    );
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);
  return (
    <section className="workspace-catalog" aria-label="جستجوی کاتالوگ میزکار">
      <div>
        <Database size={17} />
        <span>دنبال محصولی هستید؟ برای مشاوره جست‌وجو کنید.</span>
        {data && (
          <small>
            {data.familyCount.toLocaleString("fa-IR")} خانواده ·{" "}
            {data.skuCount.toLocaleString("fa-IR")} کد کالا
          </small>
        )}
      </div>
      <label>
        <Search size={19} />
        <input
          type="search"
          aria-label="جستجوی کد در میزکار"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="کد، نام یا ابعاد قطعه را جستجو کنید…"
        />
      </label>
      <div aria-live="polite">
        {busy && <p>در حال جستجو…</p>}
        {error && <p role="alert">{error}</p>}
        {!busy && query && data && !data.results.length && (
          <p>کدی با این مشخصات پیدا نشد؛ نام یا کد دقیق‌تری وارد کنید.</p>
        )}
        {query &&
          data?.results.map((p) => (
            <article key={p.code} className="mb-2 rounded-xl border border-slate-200 bg-white p-2">
              <button type="button" disabled={disabled} onClick={()=>{onSelect?.(p);setQuery("");setData(null);}} className="flex w-full items-center gap-3 rounded-lg p-2 text-right hover:bg-orange-50 disabled:opacity-50">
                {p.images?.[0] && <img src={p.images[0]} alt="" loading="lazy" className="w-12 h-12 object-contain rounded-lg bg-white" />}
                <span className="min-w-0 flex-1">
                  <strong className="block truncate">{p.name}</strong>
                  <small dir="ltr" className="block text-slate-500">
                    {p.variants.length
                      ? p.variants.map((v) => `${v.code} · ${v.size || ""}`).join(" / ")
                      : p.code}
                  </small>
                </span>
                <ArrowUpLeft size={17} />
              </button>
              {onAddToConsultation && p.variants.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 border-t border-slate-100 pt-2">
                  {p.variants.slice(0, 12).map((variant) => (
                    <button key={variant.code} type="button" disabled={disabled}
                      onClick={() => onAddToConsultation({ code: variant.code, name: p.name, size: variant.size })}
                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2 text-[11px] font-bold text-[#A64B14] hover:bg-orange-100 disabled:opacity-50">
                      <Plus size={12}/><span dir="ltr">{variant.code}</span>{variant.size && <span>{variant.size}</span>}
                    </button>
                  ))}
                </div>
              )}
            </article>
          ))}
      </div>
      <p>قیمت، موجودی و استعلام پس از ورود در پنل شما در دسترس است.</p>
    </section>
  );
}
