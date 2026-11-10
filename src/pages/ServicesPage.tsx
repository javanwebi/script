import React, { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpLeft,
  Boxes,
  Camera,
  ClipboardCheck,
  Factory,
  FileSearch,
  Headphones,
  Layers,
  MessageSquare,
  Package,
  ScanLine,
  Settings,
  Truck,
  Wrench,
} from "lucide-react";
import { STORE_ASSETS as A } from "../assets/images";
import { MemberAccess } from "../components/storefront/MemberAccess";

const capabilities = [
  {
    title: "کاتالوگ و تأمین قطعات صنعتی",
    text: "خانواده‌ها و کدهای فنی را در کاتالوگ جستجو کنید؛ مشخصات محصول را ببینید و برای خرید یا استعلام اقدام کنید.",
    image: A.partsWarehouseVault,
    Icon: Boxes,
    to: "/products",
    action: "ورود به کاتالوگ",
  },
  {
    title: "مشاوره تخصصی و محاسبات فنی",
    text: "برای انتخاب قطعه متناسب با دستگاه و شرایط کاری، مسئله و مشخصات خط تولید را با FORZA مطرح کنید.",
    image: A.whySanatCadEngineering,
    Icon: Settings,
    to: "/ai-consult",
    action: "شروع مشاوره",
  },
  {
    title: "شناسایی تصویری قطعه با FORZA",
    text: "از قطعه عکس بفرستید تا سیستم نمونه‌های نزدیک موجود در کاتالوگ را برای بررسی اولیه پیشنهاد کند.",
    image: A.aiSearchMobile,
    Icon: ScanLine,
    to: "/identify-part",
    action: "شروع شناسایی",
  },
  {
    title: "بررسی ساخت و مهندسی معکوس",
    text: "برای قطعات خاص، نمونه، نقشه و اطلاعات شرایط کار را ارسال کنید تا امکان‌سنجی فنی بررسی شود.",
    image: A.reverseEngineeringLab,
    Icon: Wrench,
    to: "/contact",
    action: "درخواست بررسی",
  },
  {
    title: "تأمین برای کارخانه‌ها و صنایع",
    text: "نیازهای خرید و تأمین مجموعه را مطرح کنید تا مسیر همکاری و پیگیری متناسب با کسب‌وکار شما بررسی شود.",
    image: A.engineerWhyAtlas,
    Icon: Factory,
    to: "/dealer",
    action: "بررسی همکاری",
  },
  {
    title: "استعلام و پیگیری سفارش",
    text: "پس از ورود به پنل، قیمت‌های قابل مشاهده برای حساب، استعلام‌ها و سفارش‌های خود را پیگیری کنید.",
    image: A.whySanatExpressDelivery,
    Icon: ClipboardCheck,
    to: "/inquiry",
    action: "ثبت استعلام",
  },
];

const process = [
  { title: "نیاز را مشخص کنید", text: "نام، برند، کد فنی یا تصویر قطعه را آماده کنید.", Icon: FileSearch },
  { title: "مشخصات را بررسی کنید", text: "کد، ابعاد و شرایط کاربرد را با اطلاعات کاتالوگ تطبیق دهید.", Icon: ScanLine },
  { title: "قیمت یا استعلام را ببینید", text: "قیمت به‌روز کدهای قابل قیمت‌گذاری پس از ورود به حساب نمایش داده می‌شود.", Icon: ClipboardCheck },
  { title: "سفارش را پیگیری کنید", text: "ثبت درخواست و پیگیری آن از مسیر پنل مشتری انجام می‌شود.", Icon: Truck },
];

export function ServicesPage() {
  useEffect(() => {
    document.title = "توانمندی‌ها و خدمات | صنعت پیش";
  }, []);

  return (
    <main className="company-page company-page--services" dir="rtl">
      <section className="company-hero company-hero--services">
        <div className="company-hero-copy">
          <span className="company-kicker">توانمندی‌ها و خدمات</span>
          <h1>از شناخت قطعه تا <em>تأمین و پیگیری</em></h1>
          <p>
            صنعت پیش ابزارها و مسیرهای تخصصی را کنار هم قرار می‌دهد تا فعالان
            صنعت بتوانند قطعه موردنیاز را پیدا کنند، مشخصات را بررسی کنند،
            مشاوره بگیرند و مسیر استعلام یا خرید را دنبال کنند.
          </p>
          <div className="company-hero-actions">
            <Link to="/products" className="company-button company-button--primary">مشاهده کاتالوگ <ArrowLeft size={18} /></Link>
            <Link to="/ai-consult" className="company-button company-button--secondary">مشاوره با FORZA <MessageSquare size={18} /></Link>
          </div>
        </div>
        <div className="company-hero-visual">
          <img src={A.engineerWhyAtlas} alt="کارشناس فنی در محیط صنعتی" fetchPriority="high" />
          <div className="company-hero-visual-shade" />
          <div className="company-hero-visual-caption">
            <span>با پشتوانه اطلس</span>
            <strong>راهکارهای تخصصی برای تأمین قطعات</strong>
            <small>از کاتالوگ تا بررسی فنی و استعلام</small>
          </div>
        </div>
      </section>

      <section className="company-section-heading">
        <span className="company-kicker">خدمات صنعت پیش</span>
        <h2>هر خدمت، یک مسیر روشن برای ادامه کار</h2>
        <p>برای ورود به هر فرایند، کارت مرتبط را انتخاب کنید. نتیجه شناسایی تصویری و پیشنهادهای محصول، نیازمند بررسی کد و مشخصات فنی است.</p>
      </section>

      <section className="company-service-grid">
        {capabilities.map(({ title, text, image, Icon, to, action }) => (
          <article className="company-service-card" key={title}>
            <div className="company-service-media">
              <img src={image} alt="" loading="lazy" />
              <span><Icon size={25} strokeWidth={1.8} /></span>
            </div>
            <div className="company-service-copy">
              <h3>{title}</h3>
              <p>{text}</p>
              <Link to={to}>{action} <ArrowUpLeft size={17} /></Link>
            </div>
          </article>
        ))}
      </section>

      <section className="company-process-section">
        <div className="company-section-heading">
          <span className="company-kicker">مسیر استفاده</span>
          <h2>از نیاز تا سفارش، مرحله‌به‌مرحله</h2>
        </div>
        <div className="company-process-grid">
          {process.map(({ title, text, Icon }, index) => (
            <article key={title}>
              <span className="company-process-number">۰{index + 1}</span>
              <Icon size={27} strokeWidth={1.7} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="company-price-callout">
        <div>
          <span className="company-kicker">قیمت و شرایط تجاری</span>
          <h2>قیمت به‌روز، متناسب با حساب مشتری</h2>
          <p>
            قیمت هر SKU از داده تجاری فعال سرور و متناسب با سطح دسترسی حساب
            خوانده می‌شود. برای خانواده‌های چندکددار ابتدا کد فنی انتخاب می‌شود؛
            اگر قیمت تأییدشده‌ای وجود نداشته باشد، مسیر استعلام نمایش داده می‌شود.
          </p>
        </div>
        <MemberAccess compact />
      </section>

      <section className="company-bottom-cta">
        <div>
          <span className="company-kicker">برای نیاز خاص شما</span>
          <h2>اگر قطعه را در کاتالوگ پیدا نکردید، اطلاعاتش را برای بررسی بفرستید.</h2>
          <p>نام، کد، تصویر، نقشه یا شرایط کاری می‌تواند نقطه شروع بررسی باشد.</p>
        </div>
        <Link to="/contact" className="company-button company-button--primary">ارتباط با کارشناسان <Headphones size={18} /></Link>
      </section>
    </main>
  );
}
