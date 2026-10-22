import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ArrowUpLeft, Database } from "lucide-react";
import { apiUrl } from "../../config/apiConfig";
interface Result {
  code: string;
  name: string;
  link: string;
  variants: { code: string; size: string }[];
}
export function WorkspaceCatalog() {
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
          setData(await r.json());
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
        <span>متصل به کاتالوگ جاری سایت</span>
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
            <Link key={p.code} to={p.link}>
              <span>
                <strong>{p.name}</strong>
                <small dir="ltr">
                  {p.variants.length
                    ? p.variants
                        .map((v) => `${v.code} · ${v.size || ""}`)
                        .join(" / ")
                    : p.code}
                </small>
              </span>
              <ArrowUpLeft size={17} />
            </Link>
          ))}
      </div>
      <p>قیمت، موجودی و استعلام پس از ورود در پنل شما در دسترس است.</p>
    </section>
  );
}
