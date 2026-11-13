import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpLeft,
  Boxes,
  ClipboardCheck,
  Factory,
  FileSearch,
  Headphones,
  MessageSquare,
  ScanLine,
  Settings,
  Truck,
  Wrench,
} from "lucide-react";
import { STORE_ASSETS as A } from "../assets/images";
import { MemberAccess } from "../components/storefront/MemberAccess";

type CapabilityGroup = "all" | "supply" | "ai" | "engineering";

const capabilities = [
  {
    id: "catalog-supply",
    group: "supply" as const,
    title: "کاتالوگ و تأمین قطعات صنعتی",
    text: "خانواده‌ها و کدهای فنی را در کاتالوگ جستجو کنید؛ مشخصات محصول را ببینید و برای خرید یا استعلام اقدام کنید.",
    inputs: "نام قطعه، برند یا کد فنی حک‌شده",
    image: A.companyPages.aboutWarehouse,
    Icon: Boxes,
    to: "/products",
    action: "ورود به کاتالوگ",
  },
  {
    id: "forza-consult",
    group: "ai" as const,
    title: "مشاوره تخصصی و محاسبات فنی",
    text: "برای انتخاب قطعه متناسب با دستگاه و شرایط کاری، مسئله و مشخصات خط تولید را با FORZA مطرح کنید.",
    inputs: "نوع دستگاه، سرعت، بار کاری و دمای محیط",
    image: A.companyPages.servicesEngineeringConsult,
    Icon: Settings,
    to: "/ai-consult",
    action: "شروع مشاوره",
  },
  {
    id: "visual-scan",
    group: "ai" as const,
    title: "شناسایی تصویری قطعه با FORZA",
    text: "از قطعه عکس بفرستید تا سیستم نمونه‌های نزدیک موجود در کاتالوگ را برای بررسی اولیه پیشنهاد کند.",
    inputs: "تصویر واضح از نمای روبه‌رو، مقطع و خط‌کش مرجع",
    image: A.aiSearchMobile,
    Icon: ScanLine,
    to: "/identify-part",
    action: "شروع شناسایی",
  },
  {
    id: "reverse-engineering",
    group: "engineering" as const,
    title: "بررسی ساخت و مهندسی معکوس",
    text: "برای قطعات خاص، نمونه، نقشه و اطلاعات شرایط کار را ارسال کنید تا امکان‌سنجی فنی بررسی شود.",
    inputs: "نقشه ابعادی یا نمونه سالم/مستهلک و تعداد موردنیاز",
    image: A.reverseEngineeringLab,
    Icon: Wrench,
    to: "/contact",
    action: "درخواست بررسی",
  },
  {
    id: "factory-supply",
    group: "supply" as const,
    title: "تأمین برای کارخانه‌ها و صنایع",
    text: "نیازهای خرید و تأمین مجموعه را مطرح کنید تا مسیر همکاری و پیگیری متناسب با کسب‌وکار شما بررسی شود.",
    inputs: "فهرست اقلام مصرفی و برنامه تأمین دوره‌ای",
    image: A.companyPages.industriesHero,
    Icon: Factory,
    to: "/dealer",
    action: "بررسی همکاری",
  },
  {
    id: "order-tracking",
    group: "engineering" as const,
    title: "استعلام و پیگیری سفارش",
    text: "پس از ورود به پنل، قیمت‌های قابل مشاهده برای حساب، استعلام‌ها و سفارش‌های خود را پیگیری کنید.",
    inputs: "ورود به پنل کاربری و انتخاب کد SKU",
    image: A.companyPages.servicesOrderDispatch,
    Icon: ClipboardCheck,
    to: "/inquiry",
    action: "ثبت استعلام",
  },
];

const serviceTabs: { id: CapabilityGroup; label: string }[] = [
  { id: "all", label: "همه توانمندی‌ها" },
  { id: "supply", label: "تأمین و کاتالوگ" },
  { id: "ai", label: "هوش مصنوعی و شناسایی" },
  { id: "engineering", label: "مهندسی و سفارش‌سازی" },
];

const process = [
  { title: "نیاز را مشخص کنید", text: "نام، برند، کد فنی یا تصویر قطعه را آماده کنید.", Icon: FileSearch },
  { title: "مشخصات را بررسی کنید", text: "کد، ابعاد و شرایط کاربرد را با اطلاعات کاتالوگ تطبیق دهید.", Icon: ScanLine },
  { title: "قیمت یا استعلام را ببینید", text: "قیمت به‌روز کدهای قابل قیمت‌گذاری پس از ورود به حساب نمایش داده می‌شود.", Icon: ClipboardCheck },
  { title: "سفارش را پیگیری کنید", text: "ثبت درخواست و پیگیری آن از مسیر پنل مشتری انجام می‌شود.", Icon: Truck },
];

export function ServicesPage() {
  const [activeGroup, setActiveGroup] = useState<CapabilityGroup>("all");

  useEffect(() => {
    document.title = "توانمندی‌ها و خدمات | صنعت پیش";
  }, []);

  const visibleCapabilities = useMemo(
    () =>
      activeGroup === "all"
        ? capabilities
        : capabilities.filter((item) => item.group === activeGroup),
    [activeGroup],
  );

  return (
    <main className="company-page company-page--services" dir="rtl">
      <section className="company-hero company-hero--services">
        <div className="company-hero-copy">
          <span className="company-kicker">توانمندی‌ها و خدمات</span>
          <h1>
            از شناخت قطعه تا <em>تأمین و پیگیری</em>
          </h1>
          <p>
            صنعت پیش ابزارها و مسیرهای تخصصی را کنار هم قرار می‌دهد تا فعالان
            صنعت بتوانند قطعه موردنیاز را پیدا کنند، مشخصات را بررسی کنند،
            مشاوره بگیرند و مسیر استعلام یا خرید را دنبال کنند.
          </p>
          <div className="company-hero-actions">
            <Link to="/products" className="company-button company-button--primary">
              مشاهده کاتالوگ <ArrowLeft size={18} />
            </Link>
            <Link to="/ai-consult" className="company-button company-button--secondary">
              مشاوره با FORZA <MessageSquare size={18} />
            </Link>
            <Link to="/about" className="company-button company-button--secondary">
              درباره صنعت پیش
            </Link>
          </div>
        </div>
        <div className="company-hero-visual">
          <img src={A.companyPages.servicesHero} alt="بازرسی و کنترل ابعادی پولی صنعتی با میکرومتر دیجیتال در آزمایشگاه مهندسی" fetchPriority="high" />
          <div className="company-hero-visual-shade" />
          <div className="company-hero-visual-caption">
            <span>با پشتوانه اطلس از ۱۳۶۶</span>
            <strong>راهکارهای تخصصی برای تأمین قطعات</strong>
            <small>از کاتالوگ تا بررسی فنی، ساخت سفارشی و استعلام</small>
          </div>
        </div>
      </section>

      <div className="sp-services-toolbar" id="services-catalog">
        <div>
          <span className="company-kicker">خدمات صنعت پیش</span>
          <h2 className="text-2xl sm:text-3xl font-black text-[#1c2733] mt-2">
            هر خدمت، یک مسیر روشن برای ادامه کار
          </h2>
        </div>

        <div className="sp-filter-tabs" role="group" aria-label="فیلتر دسته خدمات">
          {serviceTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activeGroup === tab.id}
              onClick={() => setActiveGroup(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <section className="company-service-grid" aria-live="polite">
        {visibleCapabilities.map(({ id, title, text, inputs, image, Icon, to, action }, index) => (
          <article className="company-service-card" key={id}>
            <div className="company-service-media">
              <img src={image} alt={title} loading="lazy" />
              <span>
                <Icon size={25} strokeWidth={1.8} />
              </span>
              <b className="sp-service-card-num" dir="ltr">
                0{index + 1}
              </b>
            </div>
            <div className="company-service-copy">
              <h3>{title}</h3>
              <p>{text}</p>
              <div className="sp-service-inputs">
                <strong>ورودی پیشنهادی: </strong>
                {inputs}
              </div>
              <Link to={to}>
                {action} <ArrowUpLeft size={17} />
              </Link>
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
        <Link to="/contact" className="company-button company-button--primary">
          ارتباط با کارشناسان <Headphones size={18} />
        </Link>
      </section>
    </main>
  );
}
