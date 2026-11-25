import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { STORE_ASSETS } from "../../assets/images";
import "./HomeBeltSelection.css";

export function HomeBeltSelection() {
  return (
    <section
      id="home-smart-belt-selection"
      className="home-belt-promo"
      dir="rtl"
      aria-labelledby="home-belt-promo-title"
    >
      <div className="home-belt-promo__surface">
        <div className="home-belt-promo__copy">
          <span className="home-belt-promo__eyebrow">
            راهنمای تخصصی انتخاب تسمه صنعتی
          </span>

          <h2 id="home-belt-promo-title">
            تسمه مناسب دستگاهتان را
            <em>با اطمینان انتخاب کنید.</em>
          </h2>

          <p>
            کد تسمه را دارید، از آن عکس گرفته‌اید یا فقط اندازه‌ها و مشخصات
            دستگاه را می‌دانید؟ مسیر انتخاب را از همین‌جا شروع کنید؛ FORZA
            قدم‌به‌قدم همراه شماست.
          </p>

          <div className="home-belt-promo__methods" aria-label="روش‌های شروع انتخاب تسمه">
            <span>از روی عکس</span>
            <span>با کد فنی</span>
            <span>با اندازه‌ها</span>
            <span>با مشخصات دستگاه</span>
          </div>

          <div className="home-belt-promo__actions">
            <Link to="/belt-selection" className="home-belt-promo__primary">
              شروع انتخاب تسمه
              <ArrowLeft size={17} aria-hidden="true" />
            </Link>
            <Link to="/categories" className="home-belt-promo__secondary">
              مشاهده کاتالوگ محصولات
            </Link>
          </div>
        </div>

        <div className="home-belt-promo__media">
          <img
            src={STORE_ASSETS.subcategories.vbeltRibbedHero}
            alt="نمای نزدیک تسمه‌های صنعتی برای انتخاب و بررسی فنی"
            loading="lazy"
            decoding="async"
          />
          <div className="home-belt-promo__media-caption">
            <strong>FORZA</strong>
            <span>SMART BELT SELECTION</span>
          </div>
        </div>
      </div>
    </section>
  );
}
