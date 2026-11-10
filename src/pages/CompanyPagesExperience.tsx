import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  Boxes,
  ClipboardCheck,
  Factory,
  FileSearch,
  Headphones,
  Layers,
  MessageSquare,
  ScanLine,
  Search,
  ShieldCheck,
  Truck,
  Wrench,
} from "lucide-react";
import { INDUSTRIES, ARTICLES } from "../data/siteContent";
import { STORE_ASSETS as A } from "../assets/images";
import { getManagedBrands } from "../data/brands";
import { databaseStorageEnabled } from "../services/durableStorage";
import type { Brand } from "../types";
import { MemberAccess } from "../components/storefront/MemberAccess";

const companyDestinations = [
  {
    to: "/services",
    title: "توانمندی‌ها و خدمات",
    text: "از تأمین و مشاوره تا شناسایی تصویری و بررسی ساخت قطعات خاص.",
    image: A.reverseEngineeringLab,
    action: "دیدن خدمات",
  },
  {
    to: "/industries",
    title: "صنایع تحت پوشش",
    text: "مسیرهای اختصاصی برای شناخت نیاز خطوط تولید در صنایع مختلف.",
    image: A.industries.bgPlant,
    action: "انتخاب صنعت",
  },
  {
    to: "/brands",
    title: "برندها و محصولات",
    text: "شناخت برندهای منتشرشده و رفتن به کاتالوگ محصولات مرتبط.",
    image: A.brandsFullbleedBg,
    action: "کاوش برندها",
  },
  {
    to: "/products",
    title: "کاتالوگ قطعات",
    text: "جستجو بر اساس نام، برند، خانواده محصول و کد فنی.",
    image: A.partsWarehouseVault,
    action: "ورود به کاتالوگ",
  },
  {
    to: "/knowledge",
    title: "دانشنامه کاربردی",
    text: "راهنماهای انتخاب، نگهداری و آماده‌سازی اطلاعات فنی قطعات.",
    image: A.aiSearchMobile,
    action: "مطالعه راهنماها",
  },
  {
    to: "/contact",
    title: "تماس و هماهنگی مراجعه",
    text: "ارتباط با کارشناسان و هماهنگی پیش از مراجعه حضوری.",
    image: A.engineerWhyAtlas,
    action: "ارتباط با مجموعه",
  },
];

export function AboutPage() {
  useEffect(() => {
    document.title = "درباره صنعت پیش | بازار تخصصی قطعات صنعتی";
  }, []);

  return (
    <main className="company-page company-page--about sp-art-page" dir="rtl">
      <section className="sp-art-hero sp-art-hero--about">
        <div className="sp-art-hero-copy">
          <div className="sp-art-brandline">
            <img src={A.atlasLogo} alt="لوگوی بازرگانی تسمه اطلس" />
            <span>با پشتوانه بازرگانی تسمه اطلس</span>
          </div>
          <span className="sp-art-kicker">درباره صنعت پیش</span>
          <h1>
            بازار جامع قطعات صنعتی ایران؛
            <em> از تجربه اطلس تا آینده تأمین</em>
          </h1>
          <p className="sp-art-hero-description">
            صنعت پیش با پشتوانه اطلس شکل گرفته تا مسیر پراکنده تأمین قطعات را
            به تجربه‌ای تخصصی و آنلاین تبدیل کند؛ جایی برای جستجو، بررسی
            مشخصات، شناخت برندها، دریافت مشاوره و پیگیری تأمین.
          </p>
          <p className="sp-art-hero-description sp-art-hero-description--secondary">
            چشم‌انداز ما گردآوری قطعات و برندهای صنعتی در یک مقصد تخصصی است؛
            بازاری که نیاز کارخانه‌ها و فعالان صنعت را می‌شناسد، نه کالاهای عمومی.
          </p>
          <div className="sp-art-actions">
            <Link to="/products" className="sp-art-button sp-art-button--primary">
              ورود به کاتالوگ قطعات <ArrowLeft size={18} />
            </Link>
            <Link to="/services" className="sp-art-button sp-art-button--light">
              آشنایی با خدمات
            </Link>
          </div>
          <div className="sp-art-origin">
            <span>ریشه در تجربه صنعتی</span>
            <strong>ساخته‌شده برای نیاز واقعی خطوط تولید</strong>
          </div>
        </div>
        <figure className="sp-art-hero-visual">
          <img
            src={A.whySanatDirectFactory}
            alt="فضای صنعتی و زنجیره تأمین قطعات"
            fetchPriority="high"
          />
          <div className="sp-art-hero-visual-shade" />
          <figcaption>
            <span>صنعت پیش | پیش به صنعت</span>
            <strong>یک مقصد تخصصی برای دنیای قطعات صنعتی</strong>
          </figcaption>
          <div className="sp-art-visual-mark">
            <img src={A.atlasLogo} alt="اطلس" />
            <span>پشتوانه تجربه و شناخت قطعات</span>
          </div>
          <span className="sp-art-visual-index" aria-hidden="true">SP / 01</span>
        </figure>
      </section>

      <section className="sp-art-story">
        <div className="sp-art-story-visual">
          <img
            src={A.heroPulley}
            alt="جزئیات قطعات مکانیکی و سیستم انتقال قدرت"
            loading="lazy"
          />
          <div className="sp-art-photo-caption">
            <span>شناخت دقیق، انتخاب مطمئن‌تر</span>
            <strong>قطعه فقط یک نام یا تصویر نیست.</strong>
          </div>
        </div>
        <div className="sp-art-story-copy">
          <span className="sp-art-kicker">چرا صنعت پیش شکل گرفت؟</span>
          <h2>در تأمین صنعتی، جزئیات فنی مسیر انتخاب را تعیین می‌کنند.</h2>
          <p>
            پیدا کردن قطعه مناسب فقط به دانستن نام آن محدود نمی‌شود. کد فنی،
            برند، ابعاد، جنس، شرایط کار و سازگاری با دستگاه، همگی در انتخاب
            صحیح نقش دارند.
          </p>
          <p>
            صنعت پیش می‌خواهد این اطلاعات و مسیرهای تأمین را در یک بستر
            یکپارچه کنار هم قرار دهد؛ تا کارخانه‌ها، تولیدکنندگان، تعمیرکاران
            و فعالان صنعت به‌جای جستجو در منابع پراکنده، راحت‌تر به گزینه‌های
            قابل بررسی برسند.
          </p>
          <div className="sp-art-story-rule">
            <ShieldCheck size={22} />
            <span>تطبیق نهایی هر قطعه باید با کد، مشخصات و شرایط واقعی دستگاه انجام شود.</span>
          </div>
        </div>
      </section>

      <section className="sp-art-market">
        <div className="sp-art-market-heading">
          <span className="sp-art-kicker">یک بازار تخصصی، چند مسیر متصل</span>
          <h2>از شناخت قطعه تا انتخاب مسیر تأمین</h2>
          <p>
            تجربه‌ای که قرار است جستجو، بررسی، مشاوره و خرید قطعات صنعتی را
            در یک مسیر قابل پیگیری به هم متصل کند.
          </p>
        </div>
        <div className="sp-art-market-flow">
          <div>
            <span className="sp-art-flow-icon"><Search size={22} /></span>
            <small>جستجو و کشف</small>
            <strong>قطعات و کدهای فنی</strong>
            <p>یافتن گزینه‌ها با نام، برند و مشخصات.</p>
          </div>
          <div>
            <span className="sp-art-flow-icon"><Layers size={22} /></span>
            <small>بررسی و مقایسه</small>
            <strong>خانواده و مشخصات</strong>
            <p>بررسی تفاوت کدها و ویژگی‌های فنی.</p>
          </div>
          <div>
            <span className="sp-art-flow-icon"><MessageSquare size={22} /></span>
            <small>راهنمایی تخصصی</small>
            <strong>مشاوره و شناسایی</strong>
            <p>استفاده از FORZA و بررسی کارشناسی.</p>
          </div>
          <div>
            <span className="sp-art-flow-icon"><ClipboardCheck size={22} /></span>
            <small>تأمین و پیگیری</small>
            <strong>استعلام یا خرید</strong>
            <p>ادامه مسیر از طریق حساب مشتری.</p>
          </div>
        </div>
      </section>

      <section className="sp-art-destinations">
        <div className="sp-art-section-heading">
          <div>
            <span className="sp-art-kicker">در صنعت پیش چه چیزی پیدا می‌کنید؟</span>
            <h2>هر مسیر، یک بخش تخصصی از بازار قطعات</h2>
          </div>
          <p>برای رفتن از معرفی مجموعه به بخش موردنیاز، یکی از مسیرهای زیر را انتخاب کنید.</p>
        </div>
        <div className="sp-art-destination-list">
          {companyDestinations.map((item) => (
            <Link to={item.to} className="sp-art-destination" key={item.to}>
              <img src={item.image} alt="" loading="lazy" />
              <span className="sp-art-destination-copy">
                <strong>{item.title}</strong>
                <small>{item.text}</small>
              </span>
              <span className="sp-art-destination-action">{item.action} <ArrowUpLeft size={17} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="sp-art-price-band">
        <div>
          <span className="sp-art-kicker">قیمت و شرایط تجاری</span>
          <h2>قیمت‌های به‌روز در حساب مشتری نمایش داده می‌شوند.</h2>
          <p>
            پس از ورود، قیمت متناسب با لیست فعال حساب شما برای کدهای دارای
            قیمت تأییدشده نمایش داده می‌شود. برای کالاهای بدون قیمت تأییدشده،
            مسیر استعلام در دسترس است.
          </p>
        </div>
        <MemberAccess compact />
      </section>
    </main>
  );
}

const serviceItems = [
  {
    id: "catalog",
    title: "کاتالوگ و تأمین قطعات صنعتی",
    text: "خانواده‌ها و کدهای فنی را جستجو کنید، مشخصات را ببینید و برای خرید یا استعلام اقدام کنید.",
    image: A.partsWarehouseVault,
    Icon: Boxes,
    to: "/products",
    action: "ورود به کاتالوگ",
  },
  {
    id: "consult",
    title: "مشاوره تخصصی و بررسی فنی",
    text: "مسئله خط تولید و مشخصات دستگاه را با FORZA مطرح کنید تا مسیر بررسی قطعه روشن‌تر شود.",
    image: A.whySanatCadEngineering,
    Icon: MessageSquare,
    to: "/ai-consult",
    action: "شروع مشاوره",
  },
  {
    id: "vision",
    title: "شناسایی تصویری قطعه با FORZA",
    text: "از قطعه عکس بفرستید تا نمونه‌های نزدیک در کاتالوگ برای بررسی اولیه پیشنهاد شوند.",
    image: A.aiSearchMobile,
    Icon: ScanLine,
    to: "/identify-part",
    action: "شروع شناسایی",
  },
  {
    id: "engineering",
    title: "بررسی ساخت و مهندسی معکوس",
    text: "نمونه، نقشه و شرایط کاری قطعه را ارسال کنید تا امکان‌سنجی فنی بررسی شود.",
    image: A.reverseEngineeringLab,
    Icon: Wrench,
    to: "/contact",
    action: "درخواست بررسی",
  },
  {
    id: "factory",
    title: "تأمین برای کارخانه‌ها و صنایع",
    text: "نیازهای خرید و تأمین مجموعه را مطرح کنید تا مسیر همکاری متناسب با کسب‌وکار شما بررسی شود.",
    image: A.engineerWhyAtlas,
    Icon: Factory,
    to: "/contact",
    action: "هماهنگی همکاری",
  },
  {
    id: "tracking",
    title: "استعلام و پیگیری سفارش",
    text: "پس از ورود به پنل، قیمت‌های قابل مشاهده برای حساب، استعلام‌ها و سفارش‌های خود را دنبال کنید.",
    image: A.whySanatExpressDelivery,
    Icon: Truck,
    to: "/inquiry",
    action: "ورود به پنل مشتری",
  },
];

const serviceSteps = [
  {
    title: "نیاز را مشخص کنید",
    text: "نام، برند، کد فنی یا تصویر قطعه را آماده کنید.",
    Icon: FileSearch,
  },
  {
    title: "مشخصات را تطبیق دهید",
    text: "ابعاد، جنس و شرایط کاربرد را با اطلاعات فنی بررسی کنید.",
    Icon: ScanLine,
  },
  {
    title: "قیمت یا استعلام را ببینید",
    text: "قیمت کدهای قابل قیمت‌گذاری پس از ورود به حساب نمایش داده می‌شود.",
    Icon: ClipboardCheck,
  },
  {
    title: "سفارش را پیگیری کنید",
    text: "درخواست و سفارش خود را از مسیر پنل مشتری دنبال کنید.",
    Icon: Truck,
  },
];

export function ServicesPage() {
  useEffect(() => {
    document.title = "توانمندی‌ها و خدمات | صنعت پیش";
  }, []);

  return (
    <main className="company-page company-page--services sp-art-page" dir="rtl">
      <section className="sp-art-hero sp-art-hero--services">
        <div className="sp-art-hero-copy">
          <span className="sp-art-kicker">توانمندی‌ها و خدمات</span>
          <h1>از شناخت قطعه تا تأمین و پیگیری</h1>
          <p className="sp-art-hero-description">
            صنعت پیش ابزارها و مسیرهای تخصصی را کنار هم قرار می‌دهد تا فعالان
            صنعت بتوانند قطعه موردنیاز را پیدا کنند، مشخصات را بررسی کنند،
            مشاوره بگیرند و مسیر استعلام یا خرید را دنبال کنند.
          </p>
          <div className="sp-art-actions">
            <Link to="/products" className="sp-art-button sp-art-button--primary">
              مشاهده کاتالوگ <ArrowLeft size={18} />
            </Link>
            <Link to="/ai-consult" className="sp-art-button sp-art-button--light">
              مشاوره با FORZA
            </Link>
          </div>
          <div className="sp-art-origin">
            <span>یک مسیر متصل برای خرید صنعتی</span>
            <strong>کاتالوگ، مشاوره، شناسایی و بررسی ساخت</strong>
          </div>
        </div>
        <figure className="sp-art-hero-visual">
          <img
            src={A.reverseEngineeringLab}
            alt="محیط بررسی و مهندسی قطعات صنعتی"
            fetchPriority="high"
          />
          <div className="sp-art-hero-visual-shade" />
          <figcaption>
            <span>خدمات صنعت پیش</span>
            <strong>از یک نیاز فنی تا مسیر مناسب تأمین</strong>
          </figcaption>
          <span className="sp-art-visual-index" aria-hidden="true">SP / 02</span>
        </figure>
      </section>

      <section className="sp-art-service-intro">
        <div>
          <span className="sp-art-kicker">خدمات و توانمندی‌ها</span>
          <h2>هر خدمت، پاسخ به یک مرحله از کار شماست.</h2>
        </div>
        <p>
          به‌جای گردش میان چند منبع، از مسیری استفاده کنید که با نوع نیاز شما
          شروع می‌شود؛ از پیدا کردن یک کد فنی تا بررسی ساخت یک قطعه خاص.
        </p>
      </section>

      <section className="sp-service-mosaic" aria-label="خدمات صنعت پیش">
        {serviceItems.map((item) => {
          const Icon = item.Icon;
          return (
            <article className={"sp-service-item sp-service-item--" + item.id} key={item.id}>
              <div className="sp-service-media">
                <img src={item.image} alt="" loading="lazy" />
                <span><Icon size={23} strokeWidth={1.8} /></span>
              </div>
              <div className="sp-service-copy">
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Link to={item.to}>{item.action} <ArrowUpLeft size={17} /></Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="sp-service-process">
        <div className="sp-art-section-heading">
          <div>
            <span className="sp-art-kicker">مسیر استفاده</span>
            <h2>از نیاز تا سفارش، مرحله‌به‌مرحله</h2>
          </div>
          <p>اطلاعات دقیق‌تر در هر مرحله، بررسی و انتخاب را قابل اتکاتر می‌کند.</p>
        </div>
        <div className="sp-service-steps">
          {serviceSteps.map(({ title, text, Icon }, index) => (
            <article key={title}>
              <span className="sp-service-step-number">۰{index + 1}</span>
              <Icon size={25} strokeWidth={1.7} />
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="sp-art-price-band">
        <div>
          <span className="sp-art-kicker">قیمت و شرایط تجاری</span>
          <h2>قیمت هر کد، متناسب با حساب مشتری</h2>
          <p>
            قیمت SKU از داده تجاری فعال سرور و سطح دسترسی حساب خوانده می‌شود.
            برای خانواده‌های چندکددار ابتدا کد فنی انتخاب می‌شود؛ اگر قیمت
            تأییدشده‌ای وجود نداشته باشد، مسیر استعلام نمایش داده می‌شود.
          </p>
        </div>
        <MemberAccess compact />
      </section>

      <section className="sp-art-bottom-cta">
        <div>
          <span className="sp-art-kicker">برای نیاز خاص شما</span>
          <h2>قطعه را در کاتالوگ پیدا نکردید؟ اطلاعاتش را برای بررسی بفرستید.</h2>
          <p>نام، کد، تصویر، نقشه یا شرایط کاری می‌تواند نقطه شروع بررسی باشد.</p>
        </div>
        <Link to="/contact" className="sp-art-button sp-art-button--primary">
          ارتباط با کارشناسان <Headphones size={18} />
        </Link>
      </section>
    </main>
  );
}

export function IndustriesPage() {
  useEffect(() => {
    document.title = "صنایع تحت پوشش | صنعت پیش";
  }, []);

  return (
    <main className="company-page company-page--industries sp-art-page" dir="rtl">
      <section className="sp-art-hero sp-art-hero--industries">
        <div className="sp-art-hero-copy">
          <span className="sp-art-kicker">صنایع تحت پوشش</span>
          <h1>هر صنعت، نیاز فنی خودش را دارد؛ مسیر تأمین هم باید تخصصی باشد.</h1>
          <p className="sp-art-hero-description">
            برای شناخت گروه قطعات، کاربردها و اطلاعات لازم جهت بررسی فنی،
            صنعت موردنظر را انتخاب کنید. هر مسیر به نیازهای همان صنعت و
            خانواده‌های مرتبط در کاتالوگ متصل است.
          </p>
          <div className="sp-art-actions">
            <Link to="/ai-consult" className="sp-art-button sp-art-button--primary">
              مشاوره متناسب با صنعت <MessageSquare size={18} />
            </Link>
            <Link to="/products" className="sp-art-button sp-art-button--light">
              جستجو در کاتالوگ
            </Link>
          </div>
          <div className="sp-art-origin">
            <span>۶ حوزه تخصصی در این فهرست</span>
            <strong>برای هر صنعت، مسیر و اطلاعات اختصاصی</strong>
          </div>
        </div>
        <figure className="sp-art-hero-visual">
          <img
            src={A.industries.bgPlant}
            alt="نمای یک مجموعه صنعتی و خطوط تولید"
            fetchPriority="high"
          />
          <div className="sp-art-hero-visual-shade" />
          <figcaption>
            <span>صنعت پیش</span>
            <strong>تأمین متناسب با کاربرد و شرایط خط تولید</strong>
          </figcaption>
          <span className="sp-art-visual-index" aria-hidden="true">SP / 03</span>
        </figure>
      </section>

      <section className="sp-art-section-heading sp-industries-heading">
        <div>
          <span className="sp-art-kicker">انتخاب صنعت</span>
          <h2>از تصویر خط تولید، وارد مسیر تخصصی همان صنعت شوید.</h2>
        </div>
        <p>
          گروه قطعات و معیارهای فنی در هر صفحه متناسب با همان حوزه معرفی می‌شود؛
          پیشنهاد محصول نیز از کاتالوگ واقعی و خانواده‌های فعال انتخاب می‌شود.
        </p>
      </section>

      <section className="sp-industry-bento" aria-label="فهرست صنایع تحت پوشش">
        {INDUSTRIES.map((industry) => (
          <Link
            to={"/industries/" + industry.slug}
            key={industry.slug}
            className={"sp-industry-tile sp-industry-tile--" + industry.slug}
          >
            <img src={industry.image} alt={"خط تولید " + industry.title} loading="lazy" />
            <span className="sp-industry-tile-shade" />
            <span className="sp-industry-tile-copy">
              <small>{industry.eyebrow}</small>
              <strong>{industry.title}</strong>
              <span>{industry.description}</span>
              <span className="sp-industry-parts">
                {industry.parts.slice(0, 3).map((part) => <i key={part}>{part}</i>)}
              </span>
              <b>ورود به صفحه این صنعت <ArrowUpLeft size={18} /></b>
            </span>
          </Link>
        ))}
      </section>

      <section className="sp-art-bottom-cta">
        <div>
          <span className="sp-art-kicker">صنعت یا کاربرد دیگری دارید؟</span>
          <h2>نیاز خط تولیدتان را با کارشناسان صنعت پیش مطرح کنید.</h2>
          <p>برای بررسی اولیه، نام دستگاه، کاربرد و مشخصات قطعه را آماده کنید.</p>
        </div>
        <Link to="/contact" className="sp-art-button sp-art-button--primary">
          تماس و هماهنگی <ArrowLeft size={18} />
        </Link>
      </section>
    </main>
  );
}

export function BrandsPage() {
  const [query, setQuery] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [publishedBrands, setPublishedBrands] = useState<Brand[]>(() => getManagedBrands());
  const [brandsReady, setBrandsReady] = useState(() => databaseStorageEnabled());

  useEffect(() => {
    document.title = "برندها و محصولات | صنعت پیش";
    const refreshBrands = () => {
      setPublishedBrands(getManagedBrands());
      setBrandsReady(databaseStorageEnabled());
    };
    refreshBrands();
    window.addEventListener("atlas-brands-updated", refreshBrands);
    window.addEventListener("sanat-durable-hydrated", refreshBrands);
    window.addEventListener("atlas-portal-content-updated", refreshBrands);
    return () => {
      window.removeEventListener("atlas-brands-updated", refreshBrands);
      window.removeEventListener("sanat-durable-hydrated", refreshBrands);
      window.removeEventListener("atlas-portal-content-updated", refreshBrands);
    };
  }, []);

  const specialties = useMemo(
    () =>
      Array.from(new Set(publishedBrands.flatMap((brand) => brand.specialties || [])))
        .sort((a, b) => a.localeCompare(b, "fa")),
    [publishedBrands],
  );

  const brands = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return publishedBrands.filter((brand) =>
      brand.active !== false &&
      (brand.name + " " + brand.nameEn + " " + brand.country + " " + (brand.specialties || []).join(" "))
        .toLocaleLowerCase().includes(q) &&
      (!specialty || brand.specialties?.includes(specialty)),
    );
  }, [publishedBrands, query, specialty]);

  return (
    <main className="company-page company-page--brands sp-art-page" dir="rtl">
      <section className="sp-art-hero sp-art-hero--brands">
        <div className="sp-art-hero-copy">
          <span className="sp-art-kicker">برندها و محصولات</span>
          <h1>برند را بشناسید؛ قطعه را با مشخصات فنی انتخاب کنید.</h1>
          <p className="sp-art-hero-description">
            فهرست زیر از برندهای منتشرشده در اطلاعات صنعت پیش خوانده می‌شود.
            برای بررسی کالاهای هر برند، وارد کاتالوگ شوید و کد، مشخصات و
            وضعیت قیمت همان محصول را ببینید.
          </p>
          <div className="sp-art-actions">
            <a href="#brand-directory" className="sp-art-button sp-art-button--primary">
              کاوش برندها <ArrowLeft size={18} />
            </a>
            <Link to="/products" className="sp-art-button sp-art-button--light">
              کاتالوگ قطعات
            </Link>
          </div>
          <div className="sp-art-origin">
            <span>{brands.length.toLocaleString("fa-IR")} برند قابل نمایش</span>
            <strong>بر اساس اطلاعات منتشرشده در کاتالوگ</strong>
          </div>
        </div>
        <figure className="sp-art-hero-visual">
          <img
            src={A.brandsFullbleedBg}
            alt="برندها و قطعات صنعتی"
            fetchPriority="high"
          />
          <div className="sp-art-hero-visual-shade" />
          <figcaption>
            <span>انتخاب آگاهانه</span>
            <strong>برند، کد فنی و مشخصات محصول</strong>
          </figcaption>
          <span className="sp-art-visual-index" aria-hidden="true">SP / 04</span>
        </figure>
      </section>

      <section className="sp-brand-directory" id="brand-directory">
        <div className="sp-brand-directory-heading">
          <div>
            <span className="sp-art-kicker">فهرست برندها</span>
            <h2>برندهای ثبت‌شده در کاتالوگ صنعت پیش</h2>
            <p>برای مشاهده محصولات هر برند، نام یا حوزه تخصصی آن را جستجو کنید.</p>
          </div>
          <label className="sp-brand-search">
            <Search size={19} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجوی نام برند، کشور یا حوزه تخصصی"
              aria-label="جستجوی برندها"
            />
          </label>
        </div>

        {specialties.length > 0 && (
          <div className="sp-brand-filters" role="group" aria-label="فیلتر حوزه تخصصی برند">
            <button type="button" aria-pressed={!specialty} onClick={() => setSpecialty("")}>
              همه حوزه‌ها
            </button>
            {specialties.map((item) => (
              <button
                type="button"
                key={item}
                aria-pressed={specialty === item}
                onClick={() => setSpecialty(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}

        {brands.length > 0 ? (
          <div className="sp-brand-list" aria-live="polite">
            {brands.map((brand) => {
              const logo = brand.id === "forza"
                ? A.logoForza
                : brand.id === "swr"
                  ? A.swrLogo
                  : (brand.image || brand.logo);
              return (
                <article className="sp-brand-entry" key={brand.id}>
                  <div className="sp-brand-logo">
                    {logo
                      ? <img src={logo} alt={brand.nameEn || brand.name} loading="lazy" />
                      : <span>{(brand.nameEn || brand.name).slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div className="sp-brand-copy">
                    <div className="sp-brand-meta">
                      <span>{brand.country || "برند صنعتی"}</span>
                      {brand.isExclusive && <b>همکاری انحصاری اطلس</b>}
                    </div>
                    <h3>{brand.name}</h3>
                    <p>{brand.description || "برای مشاهده محصولات و کدهای مرتبط، کاتالوگ صنعت پیش را بررسی کنید."}</p>
                    {!!brand.specialties?.length && (
                      <div className="sp-brand-tags">
                        {brand.specialties.slice(0, 4).map((item) => <span key={item}>{item}</span>)}
                      </div>
                    )}
                  </div>
                  <Link
                    to={"/products?q=" + encodeURIComponent(brand.nameEn || brand.name)}
                    className="sp-brand-action"
                  >
                    بررسی محصولات <ArrowUpLeft size={18} />
                  </Link>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="sp-brand-empty" role="status" aria-live="polite">
            {brandsReady ? (
              <>
                <strong>{publishedBrands.length ? "برندی با این عبارت پیدا نشد." : "هنوز برندی برای نمایش منتشر نشده است."}</strong>
                <p>{publishedBrands.length ? "عبارت جستجو یا فیلتر حوزه تخصصی را تغییر دهید." : "فهرست این صفحه از برندهای منتشرشده در پنل مدیریت خوانده می‌شود."}</p>
              </>
            ) : (
              <>
                <strong>در حال دریافت برندهای منتشرشده…</strong>
                <p>اطلاعات این بخش از کاتالوگ و داده‌های اصلی صنعت پیش بارگذاری می‌شود.</p>
              </>
            )}
          </div>
        )}

        <p className="sp-brand-disclaimer">
          نمایش نام یک برند به‌تنهایی به معنی موجودی همه محصولات یا تأیید نمایندگی رسمی آن نیست؛
          وضعیت هر کالا و شرایط تأمین باید در صفحه محصول یا از طریق استعلام بررسی شود.
        </p>
      </section>
    </main>
  );
}

export function KnowledgePage() {
  const { slug } = useParams();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const article = ARTICLES.find((item) => item.slug === slug);

  useEffect(() => {
    document.title = article?.title
      ? article.title + " | دانشنامه صنعت پیش"
      : "دانشنامه کاربردی | صنعت پیش";
  }, [article]);

  const categories = useMemo(
    () => Array.from(new Set(ARTICLES.map((item) => item.category))),
    [],
  );
  const list = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return ARTICLES.filter((item) =>
      (item.title + " " + item.summary + " " + item.category).toLocaleLowerCase().includes(q) &&
      (!category || item.category === category),
    );
  }, [query, category]);

  if (slug && !article) {
    return (
      <main className="company-page company-page--knowledge sp-art-page" dir="rtl">
        <div className="sp-knowledge-empty">
          <BookOpen size={32} />
          <h1>این راهنما پیدا نشد</h1>
          <p>می‌توانید به فهرست دانشنامه برگردید و راهنمای دیگری را انتخاب کنید.</p>
          <Link to="/knowledge" className="sp-art-button sp-art-button--primary">
            بازگشت به دانشنامه <ArrowLeft size={18} />
          </Link>
        </div>
      </main>
    );
  }

  if (article) {
    return (
      <main className="company-page company-page--knowledge sp-art-page sp-knowledge-article" dir="rtl">
        <header className="sp-knowledge-article-head">
          <Link to="/knowledge" className="sp-knowledge-back">
            <ArrowLeft size={17} /> بازگشت به دانشنامه
          </Link>
          <span className="sp-art-kicker">{article.category} | {article.minutes} دقیقه مطالعه</span>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
        </header>
        <div className="sp-knowledge-cover">
          <img src={article.image} alt={article.title} fetchPriority="high" />
        </div>
        <div className="sp-knowledge-reading">
          <aside className="sp-knowledge-toc">
            <strong>در این راهنما</strong>
            {article.sections.map(([heading], index) => (
              <a href={"#knowledge-section-" + index} key={heading}>{heading}</a>
            ))}
          </aside>
          <div className="sp-knowledge-body">
            {article.sections.map(([heading, body], index) => (
              <section id={"knowledge-section-" + index} key={heading}>
                <span>بخش {index + 1}</span>
                <h2>{heading}</h2>
                <p>{body}</p>
              </section>
            ))}
            <div className="sp-knowledge-note">
              این مطلب راهنمای عمومی انتخاب و آماده‌سازی اطلاعات است؛ مشخصات
              کاتالوگ سازنده و دستورالعمل دستگاه ملاک تأیید نهایی هستند.
            </div>
            <div className="sp-knowledge-actions">
              <Link to="/ai-consult" className="sp-art-button sp-art-button--primary">
                پرسش از FORZA <MessageSquare size={18} />
              </Link>
              <Link to="/contact" className="sp-art-button sp-art-button--light">
                ارتباط با کارشناسان
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const featured = list[0];

  return (
    <main className="company-page company-page--knowledge sp-art-page" dir="rtl">
      <section className="sp-knowledge-hero knowledge-intro">
        <div className="sp-knowledge-hero-copy">
          <span className="sp-art-kicker">دانشنامه کاربردی صنعت پیش</span>
          <h1>شناخت بهتر قطعه، انتخاب دقیق‌تر برای خط تولید</h1>
          <p>
            راهنماهای کوتاه و کاربردی برای شناسایی قطعات، آماده‌سازی اطلاعات فنی،
            نگهداری و بررسی گزینه‌های جایگزین.
          </p>
          <label className="sp-knowledge-search">
            <Search size={20} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="دنبال چه راهنمایی هستید؟"
              aria-label="جستجوی دانشنامه"
            />
          </label>
        </div>
        <div className="sp-knowledge-hero-visual">
          <img src={A.whySanatCadEngineering} alt="بررسی فنی قطعات صنعتی" fetchPriority="high" />
          <span>دانش فنی، بخشی از انتخاب درست</span>
        </div>
      </section>

      <section className="sp-knowledge-library">
        <div className="sp-art-section-heading">
          <div>
            <span className="sp-art-kicker">مطالب و راهنماها</span>
            <h2>از سؤال فنی خود شروع کنید.</h2>
          </div>
          <p>موضوع موردنظر را انتخاب کنید یا عنوان راهنما را جستجو کنید.</p>
        </div>
        <div className="sp-knowledge-categories" role="group" aria-label="فیلتر دسته دانشنامه">
          <button type="button" aria-pressed={!category} onClick={() => setCategory("")}>همه موضوع‌ها</button>
          {categories.map((item) => (
            <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>
              {item}
            </button>
          ))}
        </div>

        {featured ? (
          <>
            <Link to={"/knowledge/" + featured.slug} className="sp-knowledge-featured">
              <div className="sp-knowledge-featured-image">
                <img src={featured.image} alt="" loading="lazy" />
              </div>
              <div className="sp-knowledge-featured-copy">
                <span>{featured.category} | {featured.minutes} دقیقه مطالعه</span>
                <h2>{featured.title}</h2>
                <p>{featured.summary}</p>
                <b>مطالعه راهنما <ArrowUpLeft size={18} /></b>
              </div>
            </Link>
            <div className="sp-knowledge-list">
              {list.slice(1).map((item) => (
                <Link to={"/knowledge/" + item.slug} className="sp-knowledge-row" key={item.slug}>
                  <img src={item.image} alt="" loading="lazy" />
                  <span>
                    <small>{item.category} | {item.minutes} دقیقه مطالعه</small>
                    <strong>{item.title}</strong>
                    <em>{item.summary}</em>
                  </span>
                  <ArrowUpLeft size={19} />
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div className="sp-knowledge-empty" role="status">
            <BookOpen size={30} />
            <strong>راهنمایی با این عبارت پیدا نشد.</strong>
            <p>عبارت جستجو یا دسته‌بندی را تغییر دهید.</p>
          </div>
        )}
      </section>
    </main>
  );
}
