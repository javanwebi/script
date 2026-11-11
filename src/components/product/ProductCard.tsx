import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Heart, ArrowUpLeft, Layers } from "lucide-react";
import type { Product } from "../../types";
import { ProductImage } from "./ProductImage";
import { useWishlist } from "../../context/WishlistContext";
import { useAuth } from "../../context/AuthContext";
import { memberPath } from "../storefront/MemberAccess";
import { getCurrentCustomerSkuPrice, hasCustomerPriceAccess } from "../../utils/customerPricing";
import { toPersianDigits, formatPrice } from "../../utils/formatters";

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
  const hasVariants = Boolean(product.variants?.length);
  const price = !hasVariants
    ? getCurrentCustomerSkuPrice(product, currentUser, canViewPrices)
    : 0;
  const unavailablePriceLabel = !currentUser
    ? "ورود به پنل برای مشاهده قیمت"
    : !hasPricePermission
      ? "دسترسی قیمت برای این حساب فعال نیست"
      : "ورود به پنل برای مشاهده قیمت";
  const priceLabel = hasVariants
    ? canViewPrices ? "انتخاب کد فنی برای مشاهده قیمت" : unavailablePriceLabel
    : canViewPrices
      ? price > 0 ? `${formatPrice(price)} تومان` : "استعلام قیمت در پنل"
      : unavailablePriceLabel;

  // Prefer a family-level gallery image. A SKU image is only a safe family
  // preview when its identity has been explicitly verified by the catalogue team.
  const productImage =
    product.galleryImages?.find(image => image.scope === "family" && image.url)?.url ||
    product.images?.find(Boolean) ||
    product.image ||
    product.galleryImages?.find(image => image.scope === "variant" && image.identityVerified === true && image.url)?.url;

  const previewSpecs = (product.technicalSpecs || [])
    .filter(spec => spec.key?.trim() && spec.value?.trim())
    .slice(0, 2);

  // Public catalogue cards must always open the public product page, even for
  // signed-in customers. Portal-specific cards are handled by PortalProductCard.
  const href = isCustomerPortalRoute && currentUser
    ? memberPath(currentUser, product.code)
    : `/product/${encodeURIComponent(product.code)}`;

  return (
    <article className="store-product-card">
      <div className="store-product-media">
        <Link to={href}>
          <ProductImage
            src={productImage}
            thumbnail
            alt={product.name}
            className="product-card-image w-full h-full"
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
          <Heart size={18} fill={selected ? "#e06518" : "none"} color={selected ? "#e06518" : "currentColor"} />
        </button>
      </div>
      <div className="store-product-copy">
        <div className="store-product-meta">
          <span>{product.brand || "قطعات صنعتی"}</span>
          <span dir="ltr">{product.code}</span>
        </div>
        <Link to={href} className="store-product-title">{product.name}</Link>
        <p>
          <Layers size={14} />
          {hasVariants
            ? `${toPersianDigits(product.variants?.length || 0)} کد و سایز قابل انتخاب`
            : product.categoryName}
        </p>
        {previewSpecs.length > 0 && (
          <div className="store-product-specs" aria-label="مشخصات فنی منتخب">
            {previewSpecs.map(spec => (
              <span key={spec.key}>
                <strong>{spec.key}</strong>
                <b>{spec.value}</b>
              </span>
            ))}
          </div>
        )}
        <div className="store-product-bottom">
          <span className={price > 0 ? "store-product-price store-product-price--visible" : "store-product-price"}>
            {priceLabel}
          </span>
          <Link to={href} aria-label={`مشاهده ${product.name}`}>
            <span>{canViewPrices ? "مشاهده در پنل" : "مشاهده محصول"}</span>
            <ArrowUpLeft size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
};
