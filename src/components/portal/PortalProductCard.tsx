import { getCurrentCustomerSkuPrice, hasCustomerPriceAccess } from "../../utils/customerPricing";
import { memberPath } from "../storefront/MemberAccess";
import { useAuth } from "../../context/AuthContext";
import React from "react";
import { Link } from "react-router-dom";
import { Heart, ArrowUpLeft, Layers } from "lucide-react";
import type { Product } from "../../types";
import { ProductImage } from "../product/ProductImage";
import { useWishlist } from "../../context/WishlistContext";
import { toPersianDigits, formatPrice } from "../../utils/formatters";
export interface PortalProductCardProps {
  product: Product;
}
export const PortalProductCard: React.FC<PortalProductCardProps> = ({
  product,
}) => {
  const { currentUser } = useAuth();
  const { isInWishlist, toggleWishlist } = useWishlist();
  const selected = isInWishlist(product.code);
  const canViewPrices = hasCustomerPriceAccess(currentUser);
  const price = product.variants?.length
    ? 0
    : getCurrentCustomerSkuPrice(product, currentUser, canViewPrices);
  const href = currentUser
    ? memberPath(currentUser, product.code)
    : `/product/${encodeURIComponent(product.code)}`;
  return (
    <article className="store-product-card">
      <div className="store-product-media">
        <Link to={href}>
          <ProductImage
            src={product.images[0]}
            thumbnail
            alt={product.name}
            loading="lazy"
            decoding="async"
          />
        </Link>
        <button
          type="button"
          onClick={() => toggleWishlist(product.code)}
          aria-label={
            selected
              ? `حذف ${product.name} از نشان‌شده‌ها`
              : `نشان کردن ${product.name}`
          }
          aria-pressed={selected}
        >
          <Heart
            size={18}
            fill={selected ? "#e06518" : "none"}
            color={selected ? "#e06518" : "currentColor"}
          />
        </button>
      </div>
      <div className="store-product-copy">
        <div className="store-product-meta">
          <span>{product.brand || "قطعات صنعتی"}</span>
          <span dir="ltr">{product.code}</span>
        </div>
        <Link to={href} className="store-product-title">
          {product.name}
        </Link>
        <p>
          <Layers size={14} />
          {product.variants?.length
            ? `${toPersianDigits(product.variants.length)} کد و سایز قابل انتخاب`
            : product.categoryName}
        </p>
        <div className="store-product-bottom">
          <span>
            {price > 0
              ? `${formatPrice(price)} تومان`
              : product.variants?.length
                ? canViewPrices ? "انتخاب کد و استعلام" : "ورود برای مشاهده قیمت"
                : canViewPrices ? "استعلام قیمت" : "دسترسی قیمت فعال نیست"}
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
