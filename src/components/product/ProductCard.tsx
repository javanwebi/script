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
      : "مشاهده قیمت در پنل مشتری";
  const priceLabel = hasVariants
    ? canViewPrices ? "انتخاب کد فنی برای مشاهده قیمت" : unavailablePriceLabel
    : canViewPrices
      ? price > 0 ? `${formatPrice(price)} تومان` : "استعلام قیمت در پنل"
      : unavailablePriceLabel;

  // Prefer a family image. If the family has only SKU-bound gallery images,
  // show one as a clearly-labelled example instead of pretending it represents
  // every variant. Legacy image arrays are treated as family images only when
  // they have no SKU-scope metadata.
  const familyGalleryImage = product.galleryImages?.find(image => image.scope === "family" && image.url);
  const galleryVariantImage = product.galleryImages?.find(image => image.scope === "variant" && image.url);
  const skuVariantWithImage = product.variants?.find(variant => variant.images?.some(Boolean));
  const variantGalleryImage = galleryVariantImage || (skuVariantWithImage
    ? { url: skuVariantWithImage.images?.find(Boolean) || "", variantCode: skuVariantWithImage.code }
    : undefined);
  const canUseLegacyFamilyImage = !product.galleryImages?.length &&
    product.imageScope !== "sku-verified" && product.imageScope !== "mixed";
  const legacyFamilyImage = canUseLegacyFamilyImage
    ? product.images?.find(Boolean) || product.image
    : undefined;
  const productImage = familyGalleryImage?.url || legacyFamilyImage || variantGalleryImage?.url;
  const isVariantImagePreview = !familyGalleryImage && !legacyFamilyImage && Boolean(variantGalleryImage?.url);
  const variantImageLabel = variantGalleryImage?.variantCode
    ? `نمونه تصویر کد ${variantGalleryImage.variantCode}`
    : "نمونه تصویر یک کد فنی";

  const previewSpecs = (product.technicalSpecs || [])
    .filter(spec => spec.key?.trim() && spec.value?.trim())
    .slice(0, 2);
  const rawBrand = typeof product.brand === "string" ? product.brand.trim() : "";
  const brandLabel = !rawBrand || /^(?:ثبت\s*نشده|نامشخص|بدون\s*برند|unknown|n\/a|[-—])$/i.test(rawBrand)
    ? "برند ثبت نشده"
    : rawBrand;

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
            alt={isVariantImagePreview ? `${product.name} — ${variantImageLabel}` : product.name}
            className="product-card-image w-full h-full"
            loading="lazy"
            decoding="async"
          />
          {isVariantImagePreview && (
            <span className="store-product-image-scope-badge">{variantImageLabel}</span>
          )}
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
          <span>{brandLabel}</span>
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
