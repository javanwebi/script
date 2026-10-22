import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, ArrowLeft } from "lucide-react";
import { useWishlist } from "../context/WishlistContext";
import {
  getManagedCatalogProducts,
  subscribeCatalogChanges,
} from "../data/mockGenerator";
import { ProductCard } from "../components/product/ProductCard";
import { MemberAccess } from "../components/storefront/MemberAccess";
export const WishlistPage = () => {
  const { wishlist } = useWishlist();
  const [, refresh] = useState(0);
  useEffect(() => subscribeCatalogChanges(() => refresh((t) => t + 1)), []);
  const products = getManagedCatalogProducts().filter(
    (p) =>
      wishlist.includes(p.code) ||
      p.variants?.some((v) => wishlist.includes(v.code)),
  );
  return (
    <section className="wishlist-refined">
      <span className="store-eyebrow">برای بررسی دوباره نگه دارید</span>
      <h1>محصولات نشان‌شده</h1>
      <p>
        کد و مشخصات قطعات را مرور کنید؛ قیمت، موجودی و ثبت استعلام در پنل شما در
        دسترس است.
      </p>
      {products.length ? (
        <>
          <div className="editorial-products">
            {products.map((p) => (
              <ProductCard key={p.code} product={p} />
            ))}
          </div>
          <MemberAccess />
        </>
      ) : (
        <div className="wishlist-empty">
          <Heart size={35} />
          <h2>هنوز محصولی نشان نکرده‌اید</h2>
          <p>با لمس قلب کنار هر محصول، آن را برای مراجعه بعدی نگه دارید.</p>
          <Link to="/products" className="store-btn-primary">
            کاوش محصولات <ArrowLeft size={17} />
          </Link>
        </div>
      )}
    </section>
  );
};
