import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PartIdentificationLink as Link } from "../search/PartIdentificationProvider";
import {
  ArrowUpLeft,
  ArrowLeft,
  Search,
  ScanLine,
  Layers,
  Ruler,
  Factory,
  CircleCheck,
  PackageSearch,
  ClipboardList,
  MessageSquare,
} from "lucide-react";
import { STORE_ASSETS as A } from "../../assets/images";
export function EngineeringHome() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  return (
    <section className="engineering-hero">
      <div className="engineering-hero-inner">
        <div className="engineering-copy">
          <span className="engineering-kicker">
            <i /> صنعت پیش · تأمین و ساخت قطعات صنعتی
          </span>
          <h1>
            صنعت در حرکت.
            <br />
            <em>انتخاب، هوشمندتر.</em>
          </h1>
          <p>
            تسمه، پولی، قطعات پلیمری و نیازهای خطوط تولید؛ از شناخت قطعه و بررسی
            مشخصات تا استعلام، خرید و پیگیری، همراه شما هستیم.
          </p>
          <form
            className="engineering-search"
            onSubmit={(e) => {
              e.preventDefault();
              navigate(`/products?q=${encodeURIComponent(query.trim())}`);
            }}
          >
            <Search size={21} />
            <input
              aria-label="جستجوی سریع قطعه"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="کد، نام قطعه یا کاربرد را بنویسید…"
            />
            <button aria-label="جستجو در محصولات">
              <ArrowLeft size={21} />
            </button>
          </form>
          <div className="engineering-suggestions">
            <span>شروع سریع</span>
            {["تسمه", "پولی", "مکنده"].map((t) => (
              <Link key={t} to={`/products?q=${encodeURIComponent(t)}`}>
                {t}
              </Link>
            ))}
            <Link to="/identify-part">
              <ScanLine size={15} /> جستجو با عکس
            </Link>
          </div>
          <div className="engineering-actions">
            <Link className="store-btn-primary" to="/products">
              کاوش کاتالوگ <ArrowUpLeft size={18} />
            </Link>
            <Link className="store-btn-secondary" to="/ai-consult">
              میزکار هوشمند FORZA <MessageSquare size={18} />
            </Link>
          </div>
        </div>
        <div className="engineering-visual">
          <img
            className="engineering-factory"
            src={A.heroPulley}
            alt="تجهیزات و قطعات انتقال قدرت صنعتی"
            fetchPriority="high"
          />
          <div className="engineering-crosshair" aria-hidden="true" />
          <div className="engineering-visual-top">
            <span>مهندسی انتخاب قطعه</span>
            <Ruler size={18} />
          </div>
          <div className="engineering-part">
            <img src={A.categories.belts} alt="تسمه‌های صنعتی" />
            <div>
              <span>از مشخصات تا کاربرد</span>
              <strong>هر قطعه، یک انتخاب دقیق</strong>
              <small>کد کالا · ابعاد · شرایط کار</small>
            </div>
          </div>
          <div className="engineering-caption">
            <span>
              <Factory size={16} /> همراه خطوط تولید
            </span>
            <b>شناخت / انتخاب / تأمین</b>
          </div>
        </div>
      </div>
      <nav className="engineering-entry" aria-label="مسیرهای شروع">
        <Link to="/products">
          <PackageSearch />
          <span>
            <strong>کد قطعه را می‌دانید؟</strong>
            <small>مستقیم در کاتالوگ جستجو کنید</small>
          </span>
          <ArrowUpLeft />
        </Link>
        <Link to="/industries">
          <Factory />
          <span>
            <strong>از خط تولید شروع کنید</strong>
            <small>قطعات و راهنمای صنعت شما</small>
          </span>
          <ArrowUpLeft />
        </Link>
        <Link to="/contact">
          <Ruler />
          <span>
            <strong>قطعه سفارشی نیاز دارید؟</strong>
            <small>بررسی نمونه، نقشه و شرایط ساخت</small>
          </span>
          <ArrowUpLeft />
        </Link>
      </nav>
    </section>
  );
}
const journey = [
  {
    Icon: PackageSearch,
    title: "پیدا کنید",
    text: "با کد، کاربرد یا راهنمای هوشمند، خانواده قطعه را پیدا کنید.",
    to: "/products",
  },
  {
    Icon: Ruler,
    title: "تطبیق دهید",
    text: "ابعاد، جنس و شرایط کار را با دستگاه خود مقایسه کنید.",
    to: "/knowledge",
  },
  {
    Icon: ClipboardList,
    title: "استعلام بگیرید",
    text: "در پنل، موجودی و قیمت را ببینید و درخواست را ثبت کنید.",
    to: "/inquiry",
  },
  {
    Icon: CircleCheck,
    title: "پیگیری کنید",
    text: "درخواست‌ها و سفارش‌ها را در حساب خود دنبال کنید.",
    to: "/login",
  },
];
export function EngineeringJourney() {
  return (
    <section className="engineering-journey editorial-wrap">
      <div>
        <span className="store-eyebrow">از نیاز شما تا پیگیری سفارش</span>
        <h2>
          مسیر روشن،
          <br />
          برای تصمیم صنعتی.
        </h2>
        <p>
          بدون ثبت‌نام مشخصات را بررسی کنید. برای دیدن قیمت، موجودی و ثبت
          استعلام وارد حساب شوید.
        </p>
        <Link to="/register" className="editorial-text-link">
          شروع همکاری <ArrowLeft size={17} />
        </Link>
      </div>
      <ol>
        {journey.map(({ Icon, title, text, to }, i) => (
          <li key={title}>
            <Link to={to}>
              <span className="journey-number">۰{i + 1}</span>
              <Icon size={25} />
              <h3>{title}</h3>
              <p>{text}</p>
              <ArrowUpLeft size={18} />
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
