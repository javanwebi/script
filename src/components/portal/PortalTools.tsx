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
} from "lucide-react";
import {
  getManagedCatalogProducts,
  subscribeCatalogChanges,
} from "../../data/mockGenerator";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { PortalProductCard } from "./PortalProductCard";
import { resolvePurchaseLines } from "../../utils/purchaseList";
import { toPersianDigits } from "../../utils/formatters";
export function PortalTools({
  tab,
  labels,
}: {
  tab: string;
  labels: Record<string, string>;
}) {
  const label = (s: string) => labels[s] ?? s;
  const { wishlist } = useWishlist();
  const { currentUser } = useAuth();
  const { cart, addToCart } = useCart();
  const [entryParams]=useSearchParams();
  const [text, setText] = useState(()=>entryParams.get("sku")?`${entryParams.get("sku")}, 1`:"");
  const [preview, setPreview] = useState(false);
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
        <span className="consumer-bulk-illustration" aria-hidden="true"><ClipboardList size={39}/><Package size={25}/></span>
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
            {label("بررسی لیست خرید")}
            <CheckCircle2 size={16} />
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
        <div className="portal-bulk-results portal-glass">
          <div className="consumer-bulk-summary"><CheckCircle2 size={20}/><span>نتیجه پردازش لیست</span><strong>{toPersianDigits(priced.length)} ردیف آماده افزودن</strong></div>
          <h3>
            {toPersianDigits(rows.length)} {label("ردیف بررسی شد")}
          </h3>
          {rows.map((r, i) => (
            <div key={i} className="portal-bulk-row">
              <strong dir="ltr">{r.code}</strong>
              <span>{r.product?.name || "—"}</span>
              <span>
                {toPersianDigits(r.quantity || 0)} {label("عدد")}
              </span>
              {r.error ? (
                <small role="status">{r.error}</small>
              ) : r.product?.inquiryOnly || !r.product?.prices.retail ? (
                <Link to={`/product/${encodeURIComponent(r.code)}`}>
                  {label("مشاهده کد و ثبت استعلام")}
                  <ArrowUpLeft size={14} />
                </Link>
              ) : (
                <small className="ready">{label("آماده افزودن به سبد")}</small>
              )}
            </div>
          ))}
          {priced.length > 0 && (
            <button
              type="button"
              className="store-btn-primary"
              onClick={() => {
                priced.forEach((r) => addToCart(r.product!, r.quantity));
                setMessage(
                  `${toPersianDigits(priced.length)} قلم دارای قیمت به سبد افزوده شد؛ سایر ردیف‌ها را بررسی کنید.`,
                );
                setPreview(false);
              }}
            >
              <ShoppingCart size={17} />
              {label("افزودن اقلام دارای قیمت به سبد")}
            </button>
          )}
        </div>
      )}
      {message && (
        <p role="status" className="portal-tool-status">
          {message}
        </p>
      )}
    </section>
  );
}
