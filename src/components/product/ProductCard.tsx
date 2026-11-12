import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, ArrowUpLeft, Layers, Hash } from "lucide-react";
import type { Product } from "../../types";
import { ProductImage } from "./ProductImage";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../context/AuthContext";
import { memberPath } from "../storefront/MemberAccess";
import { getCurrentCustomerSkuPrice, hasCustomerPriceAccess } from "../../utils/customerPricing";
import { toPersianDigits, formatPrice } from "../../utils/formatters";
import { resolveProductPreviewImage } from "../../services/catalogTaxonomyResolver";

export interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
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
  const activeVariants = (product.variants || []).filter((v) => v.active !== false);
  const hasVariants = activeVariants.length > 0;
  const price = !hasVariants
    ? getCurrentCustomerSkuPrice(product, currentUser, canViewPrices)
    : 0;
  const href = hasPricePermission
    ? memberPath(currentUser, product.code)
    : `/product/${encodeURIComponent(product.code)}`;

  const unavailablePriceLabel = !currentUser
    ? "ورود به پنل جهت قیمت"
    : !hasPricePermission
      ? "استعلام قیمت مهندسی"
      : "ورود به پنل جهت قیمت";
  const priceLabel = hasVariants
    ? canViewPrices
      ? "انتخاب کد فنی برای قیمت"
      : unavailablePriceLabel
    : canViewPrices
      ? price > 0
        ? `${formatPrice(price)} تومان`
        : "استعلام قیمت در پنل"
      : unavailablePriceLabel;

  const previewSrc = product.images?.[0] || resolveProductPreviewImage(product);
  const sampleSkus = activeVariants.slice(0, 3);
  const remainingSkus = Math.max(0, activeVariants.length - sampleSkus.length);
  const primarySpec = product.technicalSpecs?.[0] || activeVariants[0]?.technicalSpecs?.[0];

  return (
    <article className="store-product-card">
      <div className="store-product-media">
        <Link to={href} className="store-product-media-link">
          <ProductImage
            src={previewSrc}
            thumbnail
            alt={product.name}
            loading="lazy"
            decoding="async"
          />
        </Link>
        {hasVariants && (
          <span className="store-product-sku-badge" title="تعداد کدهای فنی و سایزهای این خانواده">
            <Layers size={12} />
            <strong>{toPersianDigits(activeVariants.length)}</strong>
            <span>کد فنی</span>
          </span>
        )}
        <button
          type="button"
          onClick={() => toggleWishlist(product.code)}
          aria-label={selected ? `حذف ${product.name} از نشان‌شده‌ها` : `نشان کردن ${product.name}`}
          aria-pressed={selected}
        >
          <Heart size={17} fill={selected ? "#e06518" : "none"} color={selected ? "#e06518" : "currentColor"} />
        </button>
      </div>
      <div className="store-product-copy">
        <div className="store-product-meta">
          <span className="store-product-brand-pill">{product.brand || "FORZA INDUSTRIAL"}</span>
          <span dir="ltr" className="store-product-family-code" title="کد خانواده محصول">
            {product.code}
          </span>
        </div>
        <Link to={href} className="store-product-title">
          {product.name}
        </Link>
        <p className="store-product-subline">
          <Layers size={13} />
          <span>
            {product.submenu
              ? `${product.categoryName} · ${product.submenu}`
              : hasVariants
                ? `${toPersianDigits(activeVariants.length)} کد و سایز قابل انتخاب`
                : product.categoryName}
          </span>
        </p>

        {sampleSkus.length > 0 && (
          <div className="store-product-sku-preview" aria-label="نمونه کدهای فنی این خانواده">
            <span className="store-product-sku-label">
              <Hash size={11} />
              کدها:
            </span>
            <div className="store-product-sku-chips">
              {sampleSkus.map((sku) => (
                <Link
                  key={sku.code}
                  to={`/product/${encodeURIComponent(product.code)}?sku=${encodeURIComponent(sku.code)}`}
                  dir="ltr"
                  className="store-product-sku-chip"
                  title={`${sku.name}${sku.size ? ` (${sku.size})` : ""}`}
                >
                  {sku.code}
                </Link>
              ))}
              {remainingSkus > 0 && (
                <Link to={href} className="store-product-sku-more">
                  +{toPersianDigits(remainingSkus)}
                </Link>
              )}
            </div>
          </div>
        )}

        {primarySpec && (
          <div className="store-product-spec-hint">
            <span>{primarySpec.key}:</span>
            <strong>{primarySpec.value}</strong>
          </div>
        )}

        <div className="store-product-bottom">
          <span className={price > 0 ? "store-product-price store-product-price--visible" : "store-product-price"}>
            {priceLabel}
          </span>
          <Link to={href} aria-label={`مشاهده ${product.name}`}>
            <span>{canViewPrices ? "مشاهده در پنل" : "انتخاب کد فنی"}</span>
            <ArrowUpLeft size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
};
