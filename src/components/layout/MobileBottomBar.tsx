import { ReferenceMegaMenu } from "../catalog/ReferenceMegaMenu";
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Home,
  LayoutGrid,
  ShoppingCart,
  UserRound,
  Headphones,
  Layers,
  X,
  ChevronLeft,
  ArrowUpLeft,
  Search,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useCart } from "../../context/CartContext";
import { PRIMARY_CATALOG_CATEGORIES } from "../../data/categories";
import { CategoryNavigation } from "../catalog/CategoryNavigation";
import { toPersianDigits } from "../../utils/formatters";
interface MobileBottomBarProps {
  onOpenMobileMenu?: () => void;
  onOpenSearch?: () => void;
}
export const MobileBottomBar: React.FC<MobileBottomBarProps> = () => {
  const { currentUser, openAuthModal } = useAuth();
  const { itemCount } = useCart();
  const location = useLocation();
  const [sheet, setSheet] = useState<"categories" | "support" | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    setSheet(null);
  }, [location.pathname, location.search]);
  useEffect(() => {
    if (sheet) dialog.current?.showModal();
    else dialog.current?.close();
  }, [sheet]);
  useEffect(() => {
    const open = () => setSheet("categories");
    window.addEventListener("open-mobile-menu", open);
    return () => window.removeEventListener("open-mobile-menu", open);
  }, []);
  const active = (path: string) =>
    path === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(path);
  const open = (
    kind: "categories" | "support",
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    opener.current = e.currentTarget;
    setSheet(kind);
  };
  return (
    <>
      <nav className="store-bottom-nav" aria-label="منوی دسترسی سریع موبایل">
        <Link to="/" aria-current={active("/") ? "page" : undefined}>
          <Home size={21} />
          <span>خانه</span>
        </Link>
        <button
          type="button"
          onClick={(e) => open("categories", e)}
          aria-expanded={sheet === "categories"}
          aria-haspopup="dialog"
        >
          <LayoutGrid size={21} />
          <span>دسته‌بندی</span>
        </button>
        <Link
          to="/cart"
          aria-current={
            active("/cart") || active("/checkout") ? "page" : undefined
          }
        >
          <span className="store-cart-count">
            <ShoppingCart size={21} />
            {itemCount > 0 && <b>{toPersianDigits(itemCount)}</b>}
          </span>
          <span>سبد خرید</span>
        </Link>
        <button
          type="button"
          onClick={(e) => open("support", e)}
          aria-haspopup="dialog"
          aria-expanded={sheet === "support"}
        >
          <Headphones size={21} />
          <span>راهنمای خرید</span>
        </button>
        {currentUser ? (
          <Link
            to={currentUser.approvedB2B ? "/account" : "/consumer-dashboard"}
          >
            <UserRound size={21} />
            <span>حساب من</span>
          </Link>
        ) : (
          <button type="button" onClick={() => openAuthModal()}>
            <UserRound size={21} />
            <span>ورود / ثبت‌نام</span>
          </button>
        )}
      </nav>
      <dialog
        className="store-mobile-sheet"
        ref={dialog}
        onCancel={() => setSheet(null)}
        onClose={() => {
          setSheet(null);
          opener.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setSheet(null);
        }}
        aria-labelledby="store-sheet-title"
      >
        <div className="store-sheet-heading">
          <div>
            <small>صنعت پیش</small>
            <h2 id="store-sheet-title">
              {sheet === "categories"
                ? "دسته‌بندی قطعات"
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
          <>
            <Link className="store-sheet-all" to="/products">
              <Search size={18} />
              جستجو در همه محصولات
              <ArrowUpLeft size={17} />
            </Link>
            <div className="store-mobile-category-tree">
              <ReferenceMegaMenu compact />
            </div>
          </>
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
