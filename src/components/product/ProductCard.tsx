import React from "react";
import { Link } from "react-router-dom";
import { Heart, ArrowUpLeft, Layers } from "lucide-react";
import type { Product } from "../../types";
import { ProductImage } from "./ProductImage";
import { useWishlist } from "../../context/WishlistContext";
import { toPersianDigits } from "../../utils/formatters";
export interface ProductCardProps {
  product: Product;
}
export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { isInWishlist, toggleWishlist } = useWishlist();
  const selected = isInWishlist(product.code);
  const href = `/product/${encodeURIComponent(product.code)}`;
  return (
    <article className="store-product-card">
      <div className="store-product-media">
        <Link to={href}>
          <ProductImage
            src={product.images[0]}
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
            قیمت و موجودی در پنل
          </span>
          <Link to={href} aria-label={`مشاهده ${product.name}`}>
            <span>مشاهده محصول</span>
            <ArrowUpLeft size={17} />
          </Link>
        </div>
      </div>
    </article>
  );
};
