import { ReferenceMegaMenu } from "../catalog/ReferenceMegaMenu";
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  LayoutGrid,
  ShoppingCart,
  UserRound,
  Layers,
  X,
  ChevronLeft,
  ArrowUpLeft,
  Search,
  ScanLine,
} from "lucide-react";
import { SanatPishLogo } from "../common/BrandIdentity";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { toPersianDigits } from "../../utils/formatters";
import { usePartIdentificationAction } from "../search/PartIdentificationProvider";
import "./industrial-mobile-nav.css";
interface MobileBottomBarProps {
  onOpenMobileMenu?: () => void;
  onOpenSearch?: () => void;
}
export const MobileBottomBar: React.FC<MobileBottomBarProps> = () => {
  const { currentUser, authLoading, openAuthModal } = useAuth();
  const { itemCount } = useCart();
  const location = useLocation();
  const openIdentification = usePartIdentificationAction();
  const [sheet, setSheet] = useState<"categories" | "support" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setSheet(null);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (sheet && !dialog.current?.open) dialog.current?.showModal();
    else if (!sheet && dialog.current?.open) dialog.current.close();
  }, [sheet]);
  useEffect(() => {
    const openCategories = () => setSheet("categories");
    const openSupport = (event: Event) => {
      const trigger = (event as CustomEvent<{ opener?: HTMLButtonElement }>).detail?.opener;
      opener.current = trigger instanceof HTMLButtonElement ? trigger : null;
      setSheet("support");
    };
    window.addEventListener("open-mobile-menu", openCategories);
    window.addEventListener("open-mobile-support", openSupport);
    return () => {
      window.removeEventListener("open-mobile-menu", openCategories);
      window.removeEventListener("open-mobile-support", openSupport);
    };
  }, []);
  const active = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);
  const openCategories = (event: React.MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setSheet("categories");
  };
  return (
    <>
      <nav className="store-bottom-nav store-industrial-bottom-nav" aria-label="منوی دسترسی سریع صنعت پیش" dir="rtl">
        <Link to="/" aria-current={active("/") ? "page" : undefined}>
          <Home size={21} />
          <span>خانه</span>
        </Link>
        <button
          type="button"
          onClick={openCategories}
          aria-expanded={sheet === "categories"}
          aria-haspopup="dialog"
        >
          <LayoutGrid size={21} />
          <span>دسته‌ها</span>
        </button>
        <Link
          to={currentUser || authLoading ? "/cart" : "/login?returnTo=%2Fcart"}
          aria-current={active("/cart") || active("/checkout") ? "page" : undefined}
        >
          <span className="store-cart-count">
            <ShoppingCart size={21} />
            {itemCount > 0 && <b>{toPersianDigits(itemCount)}</b>}
          </span>
          <span>سبد خرید</span>
        </Link>
        {currentUser ? (
          <Link
            to={currentUser.approvedB2B ? "/account" : "/consumer-dashboard"}
            aria-current={active("/account") || active("/consumer-dashboard") || active("/retail-account") ? "page" : undefined}
          >
            <UserRound size={21} />
            <span>حساب من</span>
          </Link>
        ) : (
          <button type="button" onClick={() => openAuthModal()} aria-label="ورود یا ثبت‌نام">
            <UserRound size={21} />
            <span>حساب من</span>
          </button>
        )}
        <button
          type="button"
          className="store-scan-action"
          onClick={() => openIdentification?.("camera")}
          title="اسکن قطعه با دوربین"
          aria-label="باز کردن دوربین و اسکن عکس قطعه"
        >
          <span className="store-scan-orbit" aria-hidden="true"><ScanLine size={25} strokeWidth={2} /></span>
        </button>
      </nav>
      <dialog
        className={sheet === "categories" ? "store-mobile-sheet is-category-explorer" : "store-mobile-sheet"}
        ref={dialog}
        onCancel={() => setSheet(null)}
        onClose={() => {
          setSheet(null);
          if (opener.current?.isConnected) opener.current.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSheet(null);
        }}
        aria-labelledby="store-sheet-title"
      >
        <div className="store-sheet-heading">
          <div>
            <SanatPishLogo className="h-7 w-20 object-contain object-right" alt="لوگوی صنعت پیش" />
            <h2 id="store-sheet-title">
              {sheet === "categories"
                ? "دسته‌بندی محصولات"
                : "راهنمای خرید و پشتیبانی"}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setSheet(null)}
            aria-label="بستن منو"
            autoFocus
          >
            <X size={22} />
          </button>
        </div>
        {sheet === "categories" ? (
          <div className="store-mobile-category-tree" data-testid="store-mobile-category-tree">
            <ReferenceMegaMenu compact onNavigate={() => setSheet(null)} />
          </div>
        ) : (
          <div className="store-support-links">
            <Link to="/ai-consult">
              مشاوره هوشمند انتخاب قطعه
              <ChevronLeft size={17} />
            </Link>

            <Link to="/industries"><Layers size={18}/>صنایع تحت پوشش</Link><Link to="/brands"><Layers size={18}/>برندهای همکار</Link><Link to="/knowledge"><Layers size={18}/>دانشنامه</Link><Link to="/about"><Layers size={18}/>درباره صنعت پیش</Link><Link to="/contact">
              ارتباط با کارشناسان فروش
              <ChevronLeft size={17} />
            </Link>
            <a href="tel:03535254703">
              تماس با صنعت پیش<span dir="ltr">۰۳۵–۳۵۲۵۴۷۰۳</span>
            </a>
          </div>
        )}
      </dialog>
    </>
  );
};
