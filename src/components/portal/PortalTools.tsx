import { useAuth } from "../../context/AuthContext";
import { pricingCreditService } from "../../services/pricingCreditService";
import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Heart,
  ClipboardList,
  ArrowUpLeft,
  CheckCircle2,
  ShoppingCart,
  Copy,
  Package,
  Search,
  ArrowLeft,
  Bookmark,
  Eye,
} from "lucide-react";
import {
  getManagedCatalogProducts,
  subscribeCatalogChanges,
} from "../../data/mockGenerator";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { PortalProductCard } from "./PortalProductCard";
import { ProductImage } from "../product/ProductImage";
import { ParcelArt } from "./ConsumerReferenceArt";
import { resolvePurchaseLines } from "../../utils/purchaseList";
import { toPersianDigits, formatPrice } from "../../utils/formatters";
export function PortalTools({
  tab,
  labels,
  referenceConsumer = false,
}: {
  tab: string;
  labels: Record<string, string>;
  referenceConsumer?: boolean;
}) {
  const label = (s: string) => labels[s] ?? s;
  const { wishlist, toggleWishlist } = useWishlist();
  const { currentUser } = useAuth();
  const { cart, addToCart } = useCart();
  const [entryParams]=useSearchParams();
  const [text, setText] = useState(()=>entryParams.get("sku")?`${entryParams.get("sku")}, 1`:"");
  const [preview, setPreview] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Record<number, boolean>>({});
  const [savedFilter, setSavedFilter] = useState<"all" | "variants" | "single">("all");
  const [message, setMessage] = useState("");
  const [catalogTick, setCatalogTick] = useState(0);
  useEffect(
    () => subscribeCatalogChanges(() => setCatalogTick((t) => t + 1)),
    [],
  );
  const catalog = useMemo(
    () => getManagedCatalogProducts().filter((p) => p.active !== false),
    [catalogTick],
  );
  const saved = useMemo(
    () =>
      catalog.filter(
        (p) =>
          wishlist.includes(p.code) ||
          p.variants?.some((v) => wishlist.includes(v.code)),
      ),
    [catalog, wishlist],
  );
  const visibleSaved = saved.filter((p) => savedFilter === "all" || (savedFilter === "variants" ? Boolean(p.variants?.length) : !p.variants?.length));
  const parsedRows = useMemo(
    () => resolvePurchaseLines(text, catalog),
    [text, catalog],
  );
  const list = currentUser
    ? pricingCreditService.getPriceListForCustomer(currentUser)
    : undefined;
  const rows = parsedRows.map((row) => {
    if (!row.product || row.error) return row;
    const price = list
      ? pricingCreditService.getSkuPriceForList(
          row.code,
          row.product.prices.retail,
          list,
        )
      : currentUser?.approvedB2B
        ? 0
        : row.product.prices.retail;
    return {
      ...row,
      product: {
        ...row.product,
        prices: { base: price, retail: price, wholesale: price, dealer: price },
        inquiryOnly: list ? price <= 0 : row.product.inquiryOnly || price <= 0,
      },
    };
  });
  const priced = rows.filter(
    (r) =>
      r.product &&
      !r.error &&
      !r.product.inquiryOnly &&
      r.product.prices.retail > 0,
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        cart.map((i) => `${i.product.code}, ${i.quantity}`).join("\n"),
      );
      setMessage("کدها و تعداد اقلام کپی شد.");
    } catch {
      setMessage("کپی خودکار در دسترس نیست؛ کدها را از سبد خرید انتخاب کنید.");
    }
  };
  if (tab === "saved_products" && referenceConsumer)
    return (
      <section className="consumer-saved-reference" aria-label="محصولات نشان‌شده">
        <div className="consumer-saved-hero">
          <div className="consumer-saved-hero-icon"><ParcelArt /></div>
          <div><span className="consumer-eyebrow">کالاهای منتخب شما</span><h2>{toPersianDigits(saved.length)} محصول ذخیره‌شده</h2><p>محصولات انتخابی شما برای دسترسی سریع‌تر</p></div>
        </div>
        <div className="consumer-filter-pills" role="group" aria-label="فیلتر علاقه‌مندی‌ها">
          {[{id:"all",label:"همه"},{id:"variants",label:"دارای کدهای انتخابی"},{id:"single",label:"تک‌کدی"}].map((f) => (
            <button key={f.id} type="button" aria-pressed={savedFilter === f.id} onClick={() => setSavedFilter(f.id as typeof savedFilter)}>{f.label}</button>
          ))}
        </div>
        {visibleSaved.length ? (
          <div className="consumer-saved-reference-grid">
            {visibleSaved.map((p) => {
              const price = list ? pricingCreditService.getSkuPriceForList(p.code,p.prices?.retail || 0,list) : p.prices?.retail || 0;
              const directOrder = !p.variants?.length && !p.inquiryOnly && price > 0;
              return (
                <article className="consumer-saved-reference-card" key={p.code}>
                  <button type="button" className="consumer-saved-bookmark" aria-label={`حذف ${p.name} از نشان‌شده‌ها`} onClick={() => {
                    [p.code,...(p.variants || []).map((v) => v.code)].filter((code) => wishlist.includes(code)).forEach(toggleWishlist);
                  }}><Bookmark size={17} fill="currentColor" /></button>
                  <Link to={`/product/${encodeURIComponent(p.code)}`} className="consumer-saved-reference-image"><ProductImage src={p.images?.[0]} alt={p.name} thumbnail loading="lazy" decoding="async" /></Link>
                  <div className="consumer-saved-reference-copy">
                    <span className="consumer-sku" dir="ltr">{p.code}</span>
                    <h3><Link to={`/product/${encodeURIComponent(p.code)}`}>{p.name}</Link></h3>
                    <small>{p.categoryName || "قطعه صنعتی"}</small>
                    <strong>{directOrder ? `${formatPrice(price)} تومان` : "انتخاب کد / استعلام قیمت"}</strong>
                  </div>
                  <div className="consumer-saved-reference-actions">
                    <Link to={`/product/${encodeURIComponent(p.code)}`}><Eye size={15} /> مشاهده محصول</Link>
                    {directOrder ? <button type="button" onClick={() => {addToCart(p,1);setMessage(`${p.name} به سبد خرید افزوده شد.`);}}><ShoppingCart size={15}/> افزودن به سبد</button> : <Link className="consumer-saved-add" to={`/product/${encodeURIComponent(p.code)}`}><ShoppingCart size={15}/> انتخاب کالا</Link>}
                  </div>
                </article>
              );
            })}
          </div>
        ) : <div className="consumer-empty"><Bookmark size={29}/><h3>{saved.length ? "در این فیلتر کالایی نیست" : "محصولی ذخیره نشده است"}</h3><p>از کاتالوگ محصولات موردعلاقه را نشان‌دار کنید.</p><Link to="/products">مشاهده محصولات</Link></div>}
        <aside className="consumer-saved-forza-banner">
          <span className="consumer-saved-forza-symbol"><Heart size={27}/></span>
          <div><h3>پیشنهادهای مشابه برای شما</h3><p>محصولات مرتبط را از کاتالوگ واقعی صنعت پیش جستجو کنید.</p></div>
          <Link to="/products">مشاهده محصولات <ArrowLeft size={16}/></Link>
        </aside>
        {message && <p role="status" className="portal-tool-status">{message}</p>}
      </section>
    );
  if (tab === "saved_products")
    return (
      <section className="portal-tools consumer-saved-panel">
        <div className="consumer-saved-hero">
          <div className="consumer-saved-hero-icon" aria-hidden="true"><Heart size={38}/><Package size={22}/></div>
          <div>
            <span className="consumer-eyebrow">{label("فهرست منتخب شما")}</span>
            <h2>{toPersianDigits(saved.length)} محصول نشان‌شده</h2>
            <p>محصولاتی که برای دسترسی سریع‌تر ذخیره کرده‌اید. تصویر و کد از کاتالوگ سایت خوانده می‌شود.</p>
          </div>
          <Link to="/products" className="consumer-inline-action"><Search size={17}/> جستجوی محصولات</Link>
        </div>
        <div className="consumer-filter-pills" role="group" aria-label="فیلتر محصولات نشان‌شده">
          {[
            { id: "all", label: "همه" },
            { id: "variants", label: "دارای کدهای انتخابی" },
            { id: "single", label: "تک‌کدی" },
          ].map((filter) => (
            <button key={filter.id} type="button" aria-pressed={savedFilter === filter.id}
              onClick={() => setSavedFilter(filter.id as typeof savedFilter)}>{filter.label}</button>
          ))}
        </div>
        {visibleSaved.length ? (
          <div className="store-product-grid consumer-saved-grid">
            {visibleSaved.map((p) => <PortalProductCard key={p.code} product={p}/>)}
          </div>
        ) : (
          <div className="consumer-empty">
            <Heart size={30} />
            <h3>{saved.length ? "در این گروه محصول نشان‌شده‌ای ندارید" : "هنوز محصولی نشان نکرده‌اید"}</h3>
            <p>{saved.length ? "فیلتر دیگری انتخاب کنید." : "قلب کنار محصولات را بزنید تا اینجا در دسترس باشند."}</p>
            <Link to="/products">مشاهده محصولات <ArrowLeft size={16}/></Link>
          </div>
        )}
      </section>
    );
  return (
    <section className="portal-tools consumer-multicode-panel">
      <div className="consumer-bulk-hero">
        <span className="consumer-bulk-illustration"><ParcelArt /></span>
        <div><span className="consumer-eyebrow">ثبت سفارش گروهی</span><h2>{label("لیست خرید چندکدی")}</h2>
          <p>کدهای واقعی کاتالوگ و تعداد موردنیاز را خط‌به‌خط وارد کنید؛ نتیجه را پیش از اضافه کردن به سبد بررسی کنید.</p></div>
      </div>
      <div className="portal-bulk-layout">
        <div className="portal-bulk-form portal-glass">
          <label htmlFor="portal-bulk-input">{label("کد کالا، تعداد")}</label>
          <textarea
            id="portal-bulk-input"
            dir="ltr"
            rows={7}
            placeholder={"CODE-1, 2\nCODE-2, 5"}
            value={text}
            maxLength={15000}
            onChange={(e) => {
              setText(e.target.value);
              setPreview(false);
              setMessage("");
            }}
          />
          <p>{label("حداکثر ۱۰۰ ردیف؛ تعداد پیش‌فرض برای هر کد، یک است.")}</p>
          <button
            type="button"
            className="store-btn-primary"
            onClick={() => setPreview(true)}
            disabled={!text.trim()}
          >
            <Search size={18} />
            {label("بررسی لیست خرید")}
          </button>
        </div>
        <aside className="portal-bulk-help portal-glass">
          <h3>{label("از لیست قبلی شروع کنید")}</h3>
          <p>
            {label(
              "کدها و تعداد سبد فعلی را کپی کنید و برای خرید بعدی نگه دارید.",
            )}
          </p>
          <button
            type="button"
            className="store-btn-secondary"
            onClick={copy}
            disabled={!cart.length}
          >
            <Copy size={16} />
            {label("کپی لیست سبد خرید")}
          </button>
          <Link to="/cart">
            {label("مشاهده سبد خرید")}
            <ArrowUpLeft size={16} />
          </Link>
        </aside>
      </div>
      {preview && (
        <section className="portal-bulk-results portal-glass consumer-bulk-results" aria-label="نتیجه بررسی کدهای خرید">
          <div className="consumer-bulk-summary"><CheckCircle2 size={20}/><span>نتیجه پردازش لیست</span><strong>{toPersianDigits(rows.length)} ردیف بررسی‌شده</strong></div>
          <div className="consumer-bulk-table-scroll">
            <table className="consumer-bulk-table">
              <thead><tr><th>ردیف</th><th>کد محصول</th><th>نام محصول</th><th>تعداد</th><th>وضعیت</th><th>افزودن</th></tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const ready = Boolean(r.product && !r.error && !r.product.inquiryOnly && r.product.prices.retail > 0);
                  return (
                    <tr key={i}>
                      <td>{toPersianDigits(i + 1)}</td>
                      <td><bdi dir="ltr">{r.code}</bdi></td>
                      <td className="consumer-bulk-product">
                        {r.product?.images?.[0] && <ProductImage src={r.product.images[0]} alt="" thumbnail loading="lazy" />}
                        <span>{r.product?.name || "کالای نامشخص"}</span>
                      </td>
                      <td>{toPersianDigits(r.quantity || 0)}</td>
                      <td>{r.error ? <span className="consumer-bulk-status is-inquiry">{r.error}</span> :
                        ready ? <span className="consumer-bulk-status is-ready"><CheckCircle2 size={13}/> معتبر</span> :
                        <Link className="consumer-bulk-status is-inquiry" to={`/product/${encodeURIComponent(r.code)}`}>نیاز به استعلام</Link>}</td>
                      <td><input type="checkbox" aria-label={`افزودن ردیف ${i + 1} به سبد`}
                        disabled={!ready} checked={ready && selectedRows[i] !== false}
                        onChange={(e) => setSelectedRows((prev) => ({...prev,[i]:e.target.checked}))} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="consumer-bulk-table-note">{toPersianDigits(rows.filter((r) => r.product && !r.error && !r.product.inquiryOnly && r.product.prices.retail > 0).length)} ردیف دارای قیمت برای افزودن به سبد آماده است؛ برای سایر ردیف‌ها استعلام بگیرید.</p>
          {priced.length > 0 && (
            <button type="button" className="store-btn-primary" onClick={() => {
              const chosen = rows.filter((r,i) => r.product && !r.error && !r.product.inquiryOnly && r.product.prices.retail > 0 && selectedRows[i] !== false);
              if (!chosen.length) { setMessage("ابتدا ردیف‌های موردنظر را انتخاب کنید."); return; }
              chosen.forEach((r) => addToCart(r.product!,r.quantity));
              setMessage(`${toPersianDigits(chosen.length)} ردیف انتخاب‌شده به سبد خرید افزوده شد.`);
              setPreview(false);
            }}>
              <ShoppingCart size={17} /> افزودن ردیف‌های انتخابی به سبد
            </button>
          )}
        </section>
      )}
      {message && (
        <p role="status" className="portal-tool-status">
          {message}
        </p>
      )}
    </section>
  );
}
