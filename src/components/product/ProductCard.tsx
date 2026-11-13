import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, ArrowUpLeft, Layers, ShoppingCart } from "lucide-react";
import type { Product } from "../../types";
import { ProductImage } from "./ProductImage";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../context/AuthContext";
import { memberPath } from "../storefront/MemberAccess";
import { getCurrentCustomerSkuPrice, hasCustomerPriceAccess } from "../../utils/customerPricing";
import { toPersianDigits, formatPrice } from "../../utils/formatters";
import { resolveSiteProductImage } from "../../utils/siteProductImages";

export interface ProductCardProps {
  product: Product;
  variant?: "default" | "excel-grid" | "excel-list";
  compareControl?: React.ReactNode;
}

export function resolveDisplayBrand(rawBrand?: string | null, name?: string | null): string {
  const cleaned = String(rawBrand || "").trim();
  const text = `${cleaned} ${String(name || "")}`;

  if (cleaned && cleaned !== "ثبت نشده" && cleaned !== "نامشخص" && cleaned !== "خارجی") {
    return cleaned;
  }

  if (/اپتی.?بلت|اپتی\b|optibelt/i.test(text)) return "اپتی‌بلت";
  if (/هانچانگ|hanchang/i.test(text)) return "هانچانگ";
  if (/باندو|bando/i.test(text)) return "باندو";
  if (/دانگیل|dongil/i.test(text)) return "دانگیل";
  if (/مگداین|مگادین|megadyne/i.test(text)) return "مگادین";
  if (/فوجی|fuji/i.test(text)) return "فوجی";
  if (/drauda|دراودا/i.test(text)) return "DRAUDA";
  if (/candrive|کندرایو/i.test(text)) return "CANDRIVE";
  if (/دایکو|dayco/i.test(text)) return "دایکو";
  if (/کنتی|continental|contitech/i.test(text)) return "کنتیننتال";
  if (/مارشال|marshal/i.test(text)) return "مارشال";
  if (/\bswr\b/i.test(text)) return "SWR";
  if (/\bforza\b|فورزا/i.test(text)) return "FORZA";
  if (/\bgnr\b/i.test(text)) return "GNR";
  if (/گیتس|gates/i.test(text)) return "گیتس";
  if (/میتسوبوشی|mitsuboshi/i.test(text)) return "میتسوبوشی";
  if (/چیاراوالی|chiaravalli/i.test(text)) return "چیاراوالی";
  if (/تایوان|taiwan/i.test(text)) return "تایوان";
  if (/کره|korea/i.test(text)) return "کره‌ای";
  if (/آلمان|germany/i.test(text)) return "آلمانی";

  if (cleaned === "خارجی") return "وارداتی صنعتی";
  return "صنعت پیش";
}

const LOW_VALUE_SPEC_KEYS = /^(واحدهای فروش|تعداد کد کالا|وضعیت|کد خانواده)$/i;

function summarizeSpecValue(key: string, value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (key === "پروفیل‌ها" || trimmed.length > 34) {
    const parts = trimmed
      .split(/[،,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (parts.length > 3) {
      return `${parts.slice(0, 3).join("، ")} (+${toPersianDigits(parts.length - 3)})`;
    }
    if (trimmed.length > 34) {
      return `${trimmed.slice(0, 32)}…`;
    }
  }
  return trimmed;
}

function normalizeSpecLabel(key: string): string {
  const cleaned = String(key || "").trim();
  if (cleaned === "عرض اسمی بالای پروفیل (مرجع)") return "عرض مقطع";
  if (cleaned === "طول درج‌شده در کد") return "طول نامی";
  if (cleaned === "عدد طول درج‌شده (بدون تبدیل واحد)") return "عدد سایز";
  if (cleaned === "پروفیل‌ها") return "کدهای مقطع";
  if (cleaned === "نوع قطعه" || cleaned === "نوع فنی") return "ساختار";
  return cleaned;
}

function extractCardSpecs(product: Product, hasVariants: boolean): { key: string; value: string }[] {
  const familySpecs = (product.technicalSpecs || []).filter(
    (s) => s.key && s.value && !LOW_VALUE_SPEC_KEYS.test(s.key.trim()),
  );
  const firstVariantSpecs = (product.variants?.[0]?.technicalSpecs || []).filter(
    (s) => s.key && s.value && !LOW_VALUE_SPEC_KEYS.test(s.key.trim()),
  );

  const combined = [...familySpecs, ...firstVariantSpecs];
  const picked: { key: string; value: string }[] = [];
  const seenKeys = new Set<string>();

  const priorityMatchers = [
    /^پروفیل$/i,
    /عرض اسمی بالای پروفیل|عرض|گام|قطر/i,
    /نوع قطعه|نوع فنی|ساختار|جنس/i,
    /طول درج‌شده در کد|سایز|پروفیل‌ها/i,
  ];

  for (const regex of priorityMatchers) {
    if (picked.length >= 2) break;
    const match = combined.find((s) => regex.test(s.key) && !seenKeys.has(normalizeSpecLabel(s.key)));
    if (match) {
      const label = normalizeSpecLabel(match.key);
      seenKeys.add(label);
      picked.push({
        key: label,
        value: summarizeSpecValue(match.key, match.value),
      });
    }
  }

  for (const spec of combined) {
    if (picked.length >= 2) break;
    const label = normalizeSpecLabel(spec.key);
    if (!seenKeys.has(label)) {
      seenKeys.add(label);
      picked.push({
        key: label,
        value: summarizeSpecValue(spec.key, spec.value),
      });
    }
  }

  if (picked.length === 0) {
    const profileMatch = `${product.name} ${product.code}`.match(
      /\b(XPZ|XPA|XPB|XPC|SPZ|SPA|SPB|SPC|AX|BX|CX|8V|5V|3V|8M|5M|14M|T10|AT10|[ABCDEZ])\b/i,
    );
    if (profileMatch) {
      picked.push({ key: "پروفیل مقطع", value: profileMatch[1].toUpperCase() });
    } else {
      picked.push({
        key: "زیرگروه",
        value: product.subcategory || product.categoryName || "قطعه صنعتی",
      });
    }
  }

  if (picked.length === 1) {
    picked.push({
      key: "تنوع سایز",
      value: hasVariants ? `${toPersianDigits(product.variants?.length || 0)} سایز و کد` : "استاندارد",
    });
  }

  return picked.slice(0, 2);
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  variant = "default",
  compareControl,
}) => {
  const { currentUser } = useAuth();
  const location = useLocation();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const selected = isInWishlist(product.code);
  const hasPricePermission = hasCustomerPriceAccess(currentUser);
  const isCustomerPortalRoute =
    location.pathname === "/account" ||
    location.pathname.startsWith("/account/") ||
    location.pathname === "/consumer-dashboard" ||
    location.pathname.startsWith("/consumer-dashboard/");
  const canViewPrices = hasPricePermission && isCustomerPortalRoute;
  const hasVariants = Boolean(product.variants?.length);
  const price = !hasVariants
    ? getCurrentCustomerSkuPrice(product, currentUser, canViewPrices)
    : 0;
  const href = hasPricePermission
    ? memberPath(currentUser, product.code)
    : `/product/${encodeURIComponent(product.code)}`;

  const unavailablePriceLabel = !currentUser
    ? "استعلام قیمت"
    : !hasPricePermission
      ? "استعلام قیمت"
      : "مشاهده قیمت در پنل";
  const priceLabel = hasVariants
    ? canViewPrices ? "انتخاب سایز برای قیمت" : unavailablePriceLabel
    : canViewPrices
      ? price > 0 ? `${formatPrice(price)} تومان` : "استعلام قیمت در پنل"
      : unavailablePriceLabel;

  const displayBrand = resolveDisplayBrand(product.brand, product.name);
  const specRows = extractCardSpecs(product, hasVariants);

  const isInStock = product.stockKnown && product.stock > 0 && !product.inquiryOnly;
  const resolvedImage = resolveSiteProductImage(product);

  if (variant === "excel-grid" || variant === "excel-list") {
    return (
      <article className={`excel-card ${variant === "excel-list" ? "is-list" : ""}`}>
        <div className="excel-card-media">
          <Link to={href} aria-label={product.name}>
            <ProductImage
              src={product.images?.[0] || product.image || resolvedImage}
              fallbackSrc={product.image || resolvedImage}
              thumbnail
              alt={product.name}
              loading="lazy"
              decoding="async"
            />
          </Link>
        </div>

        <div className="excel-card-body">
          <Link to={href} className="excel-card-title">
            {product.name}
          </Link>

          <div className="excel-card-specs">
            {specRows.map((row, idx) => (
              <React.Fragment key={`${row.key}-${idx}`}>
                {idx > 0 && <span className="excel-card-spec-sep" aria-hidden="true">|</span>}
                <span className="excel-card-spec-item">
                  <em>{row.key}:</em> <b>{row.value}</b>
                </span>
              </React.Fragment>
            ))}
          </div>

          <div className="excel-card-status-block">
            <span className={`excel-card-stock ${isInStock ? "is-instock" : "is-supply"}`}>
              <i aria-hidden="true" />
              {isInStock
                ? "موجود در انبار"
                : hasVariants
                  ? `آماده تأمین (${toPersianDigits(product.variants?.length || 0)} کد)`
                  : "آماده تأمین"}
            </span>
            <span className="excel-card-price">{priceLabel}</span>
          </div>

          <Link to={href} className="excel-card-cta" aria-label={`سفارش ${product.name}`}>
            <ShoppingCart size={15} />
            <span>{hasVariants ? "انتخاب سایز و خرید" : "افزودن به سبد خرید"}</span>
          </Link>

          <div className="excel-card-footer">
            <span className="excel-card-meta-brand" dir="ltr">
              {displayBrand} · {product.code}
            </span>
            {compareControl}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="store-product-card">
      <div className="store-product-top-badges">
        <span className="store-badge-featured">{displayBrand}</span>
        <span className="store-badge-code" dir="ltr">
          {hasVariants ? `${toPersianDigits(product.variants?.length || 0)} SKU` : product.code.slice(0, 10)}
        </span>
      </div>

      <div className="store-product-media">
        <Link to={href}>
          <ProductImage
            src={product.images?.[0] || product.image || resolvedImage}
            fallbackSrc={product.image || resolvedImage}
            thumbnail
            alt={product.name}
            loading="lazy"
            decoding="async"
          />
        </Link>
        <button
          type="button"
          onClick={() => toggleWishlist(product.code)}
          aria-label={selected ? `حذف ${product.name} از نشان‌شده‌ها` : `نشان کردن ${product.name}`}
          aria-pressed={selected}
        >
          <Heart size={15} fill={selected ? "#E56B1E" : "none"} color={selected ? "#E56B1E" : "currentColor"} />
        </button>
      </div>

      <div className="store-product-copy">
        <div className="store-product-meta">
          <span className="store-product-brand-pill" dir="ltr">{displayBrand}</span>
          <span className="store-product-code-tag" dir="ltr">{product.code}</span>
        </div>

        <Link to={href} className="store-product-title">
          {product.name}
        </Link>

        <p className="store-product-subline">
          <Layers size={12} />
          <span>
            {hasVariants
              ? `${toPersianDigits(product.variants?.length || 0)} سایز و کد فنی`
              : product.subcategory || product.categoryName}
          </span>
        </p>

        <dl className="store-product-datasheet">
          {specRows.map((row, idx) => (
            <div key={`${row.key}-${idx}`} className="store-product-datasheet-row">
              <dt>{row.key}:</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>

        <div className="store-product-status-row">
          <span className={`store-product-stock-pill ${isInStock ? "is-instock" : "is-supply"}`}>
            <i aria-hidden="true" />
            {isInStock ? "موجود در انبار" : "آماده تأمین"}
          </span>
          <span className={price > 0 ? "store-product-price store-product-price--visible" : "store-product-price"}>
            {priceLabel}
          </span>
        </div>

        <div className="store-product-bottom store-product-actions-stack">
          <Link to={href} className="store-btn-details" aria-label={`مشاهده ${product.name}`}>
            <span>مشاهده مشخصات</span>
            <ArrowUpLeft size={13} />
          </Link>
          <Link to={href} className="store-btn-cart" aria-label={`سفارش ${product.name}`}>
            <ShoppingCart size={14} />
            <span>+ افزودن به سبد</span>
          </Link>
        </div>
      </div>
    </article>
  );
};
