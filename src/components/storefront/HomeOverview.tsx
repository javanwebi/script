import { Link } from "react-router-dom";
import {
  Camera,
  MessageCircle,
  ArrowUpLeft,
  ShieldCheck,
  Factory,
  Layers,
} from "lucide-react";
import { STORE_ASSETS } from "../../assets/images";

export function HomeAssist({
  onVisual,
  onConsult,
}: {
  onVisual: () => void;
  onConsult: () => void;
}) {
  return (
    <section className="home-assist" aria-label="راهنمای پیدا کردن قطعه">
      <div className="home-assist-intro">
        <span className="store-eyebrow">از نیاز شما تا قطعه مناسب</span>
        <h2>پیدا کردن قطعه، ساده‌تر از همیشه</h2>
        <p>
          کد یا نام قطعه را جستجو کنید؛ برای انتخاب دقیق‌تر، تصویر بفرستید یا
          مشاوره بگیرید.
        </p>
      </div>
      <div className="home-assist-visual" aria-hidden="true">
        <img fetchPriority="low" decoding="async" src={STORE_ASSETS.aiSearchMobile} alt="" loading="lazy" />
        <span>
          <Camera size={15} /> از تصویر تا مشخصات قطعه
        </span>
      </div>
      <div className="home-assist-actions">
        <button onClick={onVisual} type="button">
          <Camera size={22} />
          <span>
            <strong>شناسایی با تصویر</strong>
            <small>عکس قطعه را دارید؟</small>
          </span>
          <ArrowUpLeft size={17} />
        </button>
        <button onClick={onConsult} type="button">
          <MessageCircle size={22} />
          <span>
            <strong>مشاوره انتخاب قطعه</strong>
            <small>مشخصات را با هم بررسی کنیم</small>
          </span>
          <ArrowUpLeft size={17} />
        </button>
      </div>
    </section>
  );
}

/**
 * WhySanatPish Section (Image 3 Reference):
 * - Top centered "WHY SANAT PISH" eyebrow with orange accent lines
 * - Header row: Right = "چرا صنعت پیش؟" + subtitle, Left = "معرفی کوتاه | ویدیوی ۱ دقیقه‌ای" video preview card
 * - 3-Column Hub:
 *   - Right 3 Cards: تمرکز بر صنایع اصلی | کیفیت و اصالت کالا | پشتیبانی تخصصی
 *   - Center: 3D Mechanical Core Sphere on glowing orange pedestal with floating glassmorphic part cards & circuit connectors
 *   - Left 3 Cards: تامین سریع و مطمئن | هوش مصنوعی FORZA | تنوع کامل محصولات
 * - Bottom Full-Width Dark Glassmorphic Bar: 4 stats (+5,000 مشتری فعال, +24 صنعت تحت پوشش, +864 تصویر واقعی محصول, +10,000 کد کالای صنعتی) + "درباره صنعت پیش بیشتر بدانید" CTA button
 * - Dedicated responsive mobile layout
 */
export function WhySanatPish() {
  return (
    <section
      id="home-why-sanat-pish"
      className="home-about-editorial"
      aria-labelledby="home-about-title"
      dir="rtl"
    >
      <div className="home-about-editorial__inner">
        <span className="home-about-editorial__eyebrow">درباره صنعت پیش</span>
        <h2 id="home-about-title">
          تأمین تخصصی قطعات و تجهیزات؛
          <br className="hidden sm:block" />
          همراه مطمئن خطوط تولید ایران
        </h2>
        <p>
          صنعت پیش با پشتوانه تجربه بازرگانی تسمه اطلس از سال ۱۳۶۶، فعالیت خود را
          در حوزه تأمین قطعات و تجهیزات صنعتی توسعه داده است. ما با شناخت نیاز
          خطوط تولید، فروشگاه‌ها و کارگاه‌ها، تلاش می‌کنیم مسیر انتخاب و تهیه
          قطعه را از بررسی مشخصات تا ثبت سفارش و پیگیری، روشن و قابل اتکا کنیم.
          در کنار تأمین کالا، بررسی فنی قطعات خاص، امکان‌سنجی ساخت و ابزارهای
          هوشمند FORZA نیز بخشی از مسیر خدمات ماست.
        </p>
        <Link to="/about" className="home-about-editorial__link">
          آشنایی بیشتر با صنعت پیش
          <ArrowUpLeft size={17} />
        </Link>
      </div>
    </section>
  );
}

export function IndustrialServices() {
  const services = [
    {
      image: STORE_ASSETS.partsWarehouseVault,
      Icon: Layers,
      title: "تأمین قطعات خطوط تولید",
      text: "تسمه، پولی، بلبرینگ و قطعات انتقال قدرت؛ کالاها را با تصویر، کد و مشخصات فنی بررسی کنید.",
      to: "/products",
      action: "مشاهده محصولات",
    },
    {
      image: STORE_ASSETS.whySanatCadEngineering,
      Icon: Factory,
      title: "ساخت و مهندسی قطعات",
      text: "برای قطعات سفارشی، نمونه یا نقشه خود را ارائه کنید تا امکان ساخت و مشخصات مورد نیاز بررسی شود.",
      to: "/contact",
      action: "درخواست مشاوره ساخت",
    },
    {
      image: STORE_ASSETS.whySanatQc,
      Icon: ShieldCheck,
      title: "همراه انتخاب فنی شما",
      text: "برای انتخاب قطعه متناسب با دستگاه و شرایط کار، مشخصات و نیاز خط تولیدتان را با ما در میان بگذارید.",
      to: "/contact",
      action: "ارتباط با کارشناسان",
    },
  ];
  return (
    <section className="home-services" aria-labelledby="home-services-title">
      <div className="store-section-heading">
        <div>
          <span className="store-eyebrow">
            صنعت پیش؛ با پشتوانه بازرگانی تسمه اطلس
          </span>
          <h2 id="home-services-title">از تأمین تا ساخت، کنار خط تولید شما</h2>
          <p>
            قطعه مناسب را پیدا کنید، مشخصات را بررسی کنید و مسیر خرید را در پنل
            خود دنبال کنید.
          </p>
        </div>
        <Link to="/about" className="store-btn-secondary">
          آشنایی با صنعت پیش <ArrowUpLeft size={17} />
        </Link>
      </div>
      <div className="home-services-grid">
        {services.map(({ image, Icon, title, text, to, action }, i) => (
          <article key={title}>
            <div className="home-services-photo">
              <img fetchPriority="low" decoding="async" src={image} alt={title} loading="lazy" />
              <span className="home-services-number">۰{i + 1}</span>
            </div>
            <div className="home-services-body">
              <span className="home-services-icon">
                <Icon size={23} />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
              <Link to={to}>
                {action}
                <ArrowUpLeft size={17} />
              </Link>
            </div>
          </article>
        ))}
      </div>
      <div className="home-purchase-path" aria-label="مسیر خرید">
        <strong>مسیر روشن خرید</strong>
        {[
          "پیدا کردن کد یا خانواده قطعه",
          "بررسی تصویر، مشخصات و قیمت",
          "ثبت سفارش و پیگیری در پنل",
        ].map((text, i) => (
          <span key={text}>
            <b>{i + 1}</b>
            {text}
          </span>
        ))}
      </div>
    </section>
  );
}
