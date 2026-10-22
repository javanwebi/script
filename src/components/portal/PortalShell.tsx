import { STORE_ASSETS } from "../../assets/images";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  UserRound,
  Home,
  Package,
  FileText,
  MapPin,
  Zap,
  Gift,
  ArrowUpLeft,
  LogOut,
  Menu,
  X,
  ShoppingBag,
  ShoppingCart,
  ChevronLeft,
  Heart,
  ClipboardList,
} from "lucide-react";
import type { Customer } from "../../types";
import type {
  PortalMenuItemConfig,
  PortalBannerItem,
  PortalUiTextsConfig,
  PortalAppearanceConfig,
  CustomerIndividualOverride,
} from "../../services/portalContentService";
import "./portal.css";
import "./portal-storefront.css";

const icons: Record<string, typeof Home> = {
  saved_products: Heart,
  purchase_list: ClipboardList,
  overview: Home,
  orders: Package,
  orders_pricelist: Package,
  receipts: FileText,
  addresses: MapPin,
  profile_addresses: Building2,
  quick_buy: Zap,
  club_rewards: Gift,
};
interface Props {
  user: Customer;
  menus: PortalMenuItemConfig[];
  activeTab: string;
  onTab: (id: string) => void;
  onLogout: () => void;
  texts: PortalUiTextsConfig;
  appearance: PortalAppearanceConfig;
  discountRule?: CustomerIndividualOverride["customCartDiscountRule"];
  showDiscovery: boolean;
  labels: Record<string, string>;
  metrics: { label: string; value: string; visible: boolean }[];
  banners: PortalBannerItem[];
  onBanner: (banner: PortalBannerItem) => void;
  children: React.ReactNode;
}
export function PortalShell({
  user,
  menus,
  activeTab,
  onTab,
  onLogout,
  texts,
  appearance,
  labels,
  discountRule,
  showDiscovery,
  metrics,
  banners,
  onBanner,
  children,
}: Props) {
  const bannerImage = (b: PortalBannerItem) =>
    b.backgroundImage ||
    (b.id.startsWith("bnr-discover-") ? STORE_ASSETS.categories.pulleys : "");
  const label = (s: string) => labels[s] ?? s;
  const [more, setMore] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const company = user.companyName || user.company || "حساب مشتری";
  const surname =
    user.lastName ||
    user.fullName?.trim().split(/\s+/).slice(1).join(" ") ||
    user.fullName ||
    "حساب من";
  // Preserve real table semantics on desktop, expose the same records as labelled cards on mobile.
  useEffect(() => {
    ref.current?.querySelectorAll("table").forEach((table) => {
      const labels = [...table.querySelectorAll("thead th")].map(
        (th) => th.textContent || "",
      );
      table.querySelectorAll("tbody tr").forEach((row) =>
        [...row.children].forEach((cell, index) => {
          if (cell.tagName === "TD")
            cell.setAttribute("data-label", labels[index] || "");
        }),
      );
    });
  });
  useEffect(() => {
    if (more) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [more]);
  const select = (id: string) => {
    onTab(id);
    setMore(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    title.current?.focus({ preventScroll: true });
  };
  const navButton = (m: PortalMenuItemConfig, compact = false) => {
    const Icon = icons[m.id] || FileText;
    return (
      <button
        type="button"
        key={m.id}
        onClick={() => select(m.id)}
        aria-current={activeTab === m.id ? "page" : undefined}
        className={`portal-nav-item ${activeTab === m.id ? "is-active" : ""} ${compact ? "compact" : ""}`}
      >
        <Icon size={19} aria-hidden="true" />
        <span>{m.label}</span>
        {!compact && <ChevronLeft size={14} />}
      </button>
    );
  };
  const mobileMenus = menus.slice(0, 3);
  return (
    <div
      className={`customer-portal accent-${texts.headerAccentTheme} density-${appearance.density} glass-${appearance.glass}`}
      dir="rtl"
      ref={ref}
    >
      <a className="portal-skip" href="#portal-content">
        {label("رفتن به محتوای پنل")}
      </a>
      <aside className="portal-sidebar portal-glass">
        <Link to="/" className="portal-brand">
          <span className="portal-brand-mark">
            <Building2 size={26} />
          </span>
          <span>
            صنعت پیش<small>{label("همراه خرید صنعتی شما")}</small>
          </span>
        </Link>
        <div className="portal-company">
          <Building2 size={18} />
          <span>
            {company}
            <small>{user.username || user.phone}</small>
          </span>
        </div>
        <nav aria-label="منوی پنل مشتری">{menus.map((m) => navButton(m))}</nav>
        <div className="portal-sidebar-bottom">
          <Link to="/products">
            <ShoppingBag size={17} />
            {label("بازگشت به فروشگاه")}
            <ArrowUpLeft size={15} />
          </Link>
          <button type="button" onClick={onLogout}>
            <LogOut size={17} />
            {label("خروج از حساب")}
          </button>
        </div>
      </aside>
      <div className="portal-workspace">
        <header className="portal-topbar portal-glass">
          <Link to="/" className="portal-top-brand">
            صنعت پیش
          </Link>
          <div className="portal-breadcrumb">
            {label("حساب من")}
            <ChevronLeft size={14} />
            <span>
              {menus.find((m) => m.id === activeTab)?.label || "پیشخوان"}
            </span>
          </div>
          <div className="portal-top-actions">
            <Link to="/products" className="portal-search-link">
              {label("جستجو در محصولات")}
            </Link>
            <Link
              to="/cart"
              className="portal-cart-link"
              aria-label={label("سبد خرید من")}
            >
              <ShoppingCart size={19} />
            </Link>
            <div className="portal-person">
              <UserRound size={18} />
              <span>{surname}</span>
            </div>
          </div>
        </header>
        <main id="portal-content" className="portal-content">
          <div className="portal-heading">
            <div>
              <p>{texts.heroWelcomePrefix}</p>
              <h1 ref={title} tabIndex={-1}>
                {company}
              </h1>
              <p>{texts.heroSubtitle}</p>
            </div>
            <Link to="/products" className="portal-primary">
              <ShoppingBag size={17} />
              {texts.primaryCtaLabel}
              <ArrowUpLeft size={16} />
            </Link>
          </div>
          {activeTab === "overview" && (
            <>
              <div className="portal-metrics">
                {metrics
                  .filter((m) => m.visible)
                  .map((m, i) => (
                    <div className="portal-metric portal-glass" key={i}>
                      <span className="portal-metric-icon">
                        {React.createElement(
                          [Package, FileText, ShoppingBag, Gift][i] || Package,
                          { size: 19 },
                        )}
                      </span>
                      <span>{m.label}</span>
                      <strong>{m.value}</strong>
                    </div>
                  ))}
              </div>
              {showDiscovery && banners.length === 0 && (
                <div className="portal-discovery-grid">
                  <section className="portal-campaign portal-glass">
                    <div>
                      <span className="portal-eyebrow">
                        {label("برای ادامه تولید")}
                      </span>
                      <h2>{label("قطعه مناسب، با انتخاب دقیق‌تر")}</h2>
                      <p>
                        {label(
                          "کد، سایز و مشخصات قطعات را ببینید؛ برای انتخاب همراه شما هستیم.",
                        )}
                      </p>
                      <Link to="/products" className="portal-primary">
                        {label("جستجو در محصولات")}
                        <ArrowUpLeft size={16} />
                      </Link>
                    </div>
                    <img
                      src={STORE_ASSETS.categories.pulleys}
                      alt=""
                      loading="lazy"
                    />
                  </section>
                  <section className="portal-quick-actions portal-glass">
                    <h2>{label("دسترسی‌های کاربردی")}</h2>
                    {menus
                      .filter((m) => m.id !== "overview")
                      .slice(0, 3)
                      .map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => select(m.id)}
                        >
                          {React.createElement(icons[m.id] || FileText, {
                            size: 18,
                          })}
                          <span>{m.label}</span>
                          <ArrowUpLeft size={15} />
                        </button>
                      ))}
                  </section>
                </div>
              )}
              {banners.length > 0 && (
                <section
                  className="portal-campaigns"
                  aria-label="پیشنهادها و رویدادها"
                >
                  {banners.map((b) => (
                    <article
                      key={b.id}
                      className={`portal-campaign portal-glass campaign-${b.theme}`}
                    >
                      <div>
                        <span className="portal-eyebrow">{b.badgeText}</span>
                        <h2>{b.title}</h2>
                        <p>{b.subtitle}</p>
                        {b.minCartVolume && b.cartDiscountPercent ? (
                          <p>
                            {new Intl.NumberFormat("fa-IR").format(
                              b.minCartVolume,
                            )}{" "}
                            تومان خرید؛{" "}
                            {new Intl.NumberFormat("fa-IR").format(
                              b.cartDiscountPercent,
                            )}
                            ٪ تخفیف سبد
                          </p>
                        ) : null}
                        <button
                          className="portal-primary"
                          onClick={() => onBanner(b)}
                          type="button"
                        >
                          {b.ctaText || "مشاهده"}
                          <ArrowUpLeft size={16} />
                        </button>
                      </div>
                      {bannerImage(b) && (
                        <img src={bannerImage(b)} alt="" loading="lazy" />
                      )}
                    </article>
                  ))}
                </section>
              )}
              {discountRule && (
                <section className="portal-campaign portal-glass mb-6">
                  <div>
                    <span className="portal-eyebrow">
                      {label("پیشنهاد خرید شما")}
                    </span>
                    <h2>
                      {new Intl.NumberFormat("fa-IR").format(
                        discountRule.discountPercent,
                      )}
                      ٪ {label("تخفیف سبد خرید")}
                    </h2>
                    <p>
                      {label("برای خرید از")}{" "}
                      {new Intl.NumberFormat("fa-IR").format(
                        discountRule.minVolume,
                      )}{" "}
                      {label("تومان")}
                    </p>
                    <p>{discountRule.description}</p>
                    <Link to="/products" className="portal-primary">
                      {texts.primaryCtaLabel}
                      <ArrowUpLeft size={16} />
                    </Link>
                  </div>
                </section>
              )}
            </>
          )}
          <div className="portal-panels">{children}</div>
        </main>
      </div>
      <nav
        className="portal-mobile-nav portal-glass"
        aria-label="دسترسی سریع پنل"
      >
        {mobileMenus.map((m) => navButton(m, true))}
        <button
          ref={moreButton}
          type="button"
          onClick={() => setMore(true)}
          className={`portal-nav-item compact ${!mobileMenus.some((m) => m.id === activeTab) ? "is-active" : ""}`}
          aria-haspopup="dialog"
          aria-expanded={more}
        >
          <Menu size={20} />
          <span>{label("همه بخش‌ها")}</span>
        </button>
      </nav>
      <dialog
        ref={dialog}
        className="portal-menu-dialog"
        onCancel={() => setMore(false)}
        onClose={() => {
          setMore(false);
          moreButton.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setMore(false);
        }}
        aria-labelledby="portal-menu-title"
      >
        <div className="portal-sheet-heading">
          <h2 id="portal-menu-title">{label("بخش‌های حساب من")}</h2>
          <button
            type="button"
            autoFocus
            onClick={() => setMore(false)}
            aria-label="بستن منو"
          >
            <X size={22} />
          </button>
        </div>
        <p className="portal-sheet-company">{company}</p>
        <nav aria-label="تمام بخش‌های پنل">
          {menus.map((m) => navButton(m))}
        </nav>
        <Link to="/products" className="portal-store-link">
          {label("بازگشت به فروشگاه")}
          <ArrowUpLeft size={17} />
        </Link>
        <button className="portal-logout" type="button" onClick={onLogout}>
          <LogOut size={18} />
          {label("خروج از حساب")}
        </button>
      </dialog>
    </div>
  );
}
