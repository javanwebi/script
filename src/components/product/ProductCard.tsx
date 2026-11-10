import React from "react";
import { Link } from "react-router-dom";
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
  const { isInWishlist, toggleWishlist } = useWishlist();
  const selected = isInWishlist(product.code);
  const canViewPrices = hasCustomerPriceAccess(currentUser);
  const hasVariants = Boolean(product.variants?.length);
  const price = !hasVariants
    ? getCurrentCustomerSkuPrice(product, currentUser, canViewPrices)
    : 0;
  const href = canViewPrices
    ? memberPath(currentUser, product.code)
    : `/product/${encodeURIComponent(product.code)}`;

  const priceLabel = hasVariants
    ? canViewPrices ? "انتخاب کد فنی برای مشاهده قیمت" : "قیمت پس از ورود به پنل"
    : canViewPrices
      ? price > 0 ? `${formatPrice(price)} تومان` : "استعلام قیمت در پنل"
      : currentUser
        ? "دسترسی قیمت برای این حساب فعال نیست"
        : "ورود برای مشاهده قیمت";

  return (
    <article className="store-product-card">
      <div className="store-product-media">
        <Link to={href}>
          <ProductImage
            src={product.images?.[0]}
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
