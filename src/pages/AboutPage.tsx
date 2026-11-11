import { useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowUpLeft, BookOpen, Boxes, Factory, Headphones,
  Layers3, PackageCheck, Phone, ScanSearch, ShieldCheck,
  ShoppingCart, UsersRound, Wrench,
} from "lucide-react";
import { STORE_ASSETS } from "../assets/images";
import { setPageMeta } from "../utils/pageMeta";

const capabilities = [
  { title: "تأمین قطعات", text: "دسترسی به کاتالوگ تخصصی قطعات و تجهیزات موردنیاز خطوط تولید", image: STORE_ASSETS.heroSteelCoils, Icon: PackageCheck },
  { title: "مشاوره تخصصی", text: "راهنمایی برای شناخت مشخصات و انتخاب مناسب قطعه", image: STORE_ASSETS.engineerWhyAtlas, Icon: Headphones },
  { title: "شناسایی هوشمند قطعه", text: "کمک به جستجوی قطعه از روی تصویر و یافتن گزینه‌های مشابه", image: STORE_ASSETS.aiSearchMobile, Icon: ScanSearch },
  { title: "پشتیبانی صنایع", text: "تمرکز بر نیازهای فنی و تأمین قطعات برای محیط‌های صنعتی", image: STORE_ASSETS.refineryDuskWide, Icon: Factory },
];

const milestones = [
  { label: "پشتوانه", title: "تجربه بازرگانی اطلس", text: "شناخت بازار و نیازهای تأمین قطعات صنعتی" },
  { label: "شناخت", title: "تمرکز بر نیاز صنعت", text: "توجه به مشخصات فنی و شرایط واقعی خطوط تولید" },
  { label: "توسعه", title: "ساخت بستر دیجیتال", text: "سامان‌دهی کاتالوگ، برندها و مسیرهای جستجو" },
  { label: "امروز", title: "بازار آنلاین صنعت پیش", text: "پیوند جستجو، مشاوره، استعلام و خرید قطعات" },
];

const destinations = [
  { to: "/services", title: "خدمات", text: "مجموعه خدمات و راهکارهای ما", image: STORE_ASSETS.whySanatCadEngineering, Icon: Wrench },
  { to: "/industries", title: "صنایع تحت پوشش", text: "راهکارهای تخصصی برای انواع صنایع", image: STORE_ASSETS.industries.bgPlant, Icon: Factory },
  { to: "/brands", title: "برندها", text: "بررسی برندهای ثبت‌شده در کاتالوگ", image: STORE_ASSETS.brandsFullbleedBg, Icon: Boxes },
  { to: "/knowledge", title: "دانشنامه", text: "مقالات، راهنماها و محتوای تخصصی", image: STORE_ASSETS.aiSearchMobile, Icon: BookOpen },
  { to: "/contact", title: "تماس با ما", text: "ارتباط مستقیم با تیم صنعت پیش", image: STORE_ASSETS.ctaConsultBanner, Icon: Phone },
];

const valueFacts = [
  { title: "بازار تخصصی", text: "تمرکز بر قطعات و تجهیزات صنعتی", Icon: Layers3 },
  { title: "جستجوی فنی", text: "یافتن قطعه با نام و کد فنی", Icon: ScanSearch },
  { title: "قیمت مشتری", text: "دسترسی به قیمت‌های فعال پس از ورود", Icon: ShieldCheck },
  { title: "پشتیبانی", text: "مسیر ارتباط با کارشناسان و استعلام", Icon: UsersRound },
];

export function AboutPage() {
  useEffect(() => {
    setPageMeta({ title: "درباره صنعت پیش | بازار آنلاین تخصصی قطعات صنعتی", description: "با صنعت پیش و پشتوانه بازرگانی تسمه اطلس آشنا شوید؛ بازار آنلاین تخصصی برای جستجو، بررسی مشخصات، مشاوره و تأمین قطعات خطوط تولید." });
  }, []);

  return (
    <main className="sp-about-page" dir="rtl">
      <section className="sp-about-hero" aria-labelledby="sp-about-title">
        <div className="sp-about-hero__visual">
          <img src={STORE_ASSETS.partsWarehouseVault} alt="چرخ‌دنده‌های فولادی و مجموعه انتقال قدرت در محیط صنعتی" fetchPriority="high" decoding="async" />
          <div className="sp-about-hero__visual-shade" />
          <span className="sp-about-hero__visual-index">SANAT PISH / INDUSTRIAL MARKETPLACE</span>
          <div className="sp-about-hero__image-caption">
            <span>پیش به صنعت</span>
            <strong>تخصص صنعتی، دسترسی یکپارچه</strong>
          </div>
        </div>
        <div className="sp-about-hero__copy">
          <div className="sp-about-breadcrumb">
            <Link to="/">صفحه اصلی</Link><span>/</span><span>درباره ما</span>
          </div>
          <span className="sp-about-eyebrow">درباره صنعت پیش</span>
          <h1 id="sp-about-title">بازار تخصصی<br />قطعات صنعتی<em>با پشتوانه اطلس</em></h1>
          <p>صنعت پیش، یک بازار آنلاین جامع برای تأمین، جستجو و خرید انواع قطعات و تجهیزات صنعتی است؛ با تکیه بر تجربه و اعتبار بازرگانی تسمه اطلس.</p>
          <p className="sp-about-hero__subcopy">بستری تخصصی برای نزدیک‌تر کردن نیاز خطوط تولید به قطعات، برندها و اطلاعات فنی موردنیاز آن‌ها.</p>
          <div className="sp-about-actions">
            <Link to="/products" className="sp-about-button sp-about-button--primary"><ShoppingCart size={17} />ورود به بازار قطعات</Link>
            <a href="#sp-about-story" className="sp-about-button sp-about-button--outline">آشنایی با ما<ArrowLeft size={17} /></a>
          </div>
          <div className="sp-about-hero__trust">
            <img src={STORE_ASSETS.atlasLogo} alt="نشان بازرگانی تسمه اطلس" />
            <span>با پشتوانه بازرگانی تسمه اطلس</span>
          </div>
        </div>
      </section>

      <section className="sp-about-story" id="sp-about-story" aria-labelledby="sp-about-story-title">
        <div className="sp-about-story__visual">
          <img src={STORE_ASSETS.whySanatDirectFactory} alt="محیط صنعتی و تأمین قطعات" loading="lazy" decoding="async" />
          <div className="sp-about-story__photo-label"><span>پشتوانه ما</span><strong>تجربه بازرگانی اطلس</strong></div>
        </div>
        <div className="sp-about-story__content">
          <span className="sp-about-eyebrow sp-about-eyebrow--light">داستان ما</span>
          <h2 id="sp-about-story-title">با پشتوانه بازرگانی تسمه <em>اطلس</em></h2>
          <p>صنعت پیش، حاصل تجربه و شناخت بازار قطعات صنعتی در کنار نگاه به آینده تأمین است. این مجموعه با پشتوانه بازرگانی تسمه اطلس شکل گرفته تا دسترسی به قطعات، برندها و اطلاعات فنی را در یک بستر آنلاین تخصصی گرد هم بیاورد.</p>
          <p>هدف ما ساخت بازاری جامع برای قطعات صنعتی است؛ جایی که کسب‌وکارها بتوانند نیاز خود را جستجو کنند، مشخصات را بررسی کنند، از مشاوره تخصصی کمک بگیرند و مسیر استعلام و خرید را شفاف‌تر پیش ببرند.</p>
          <div className="sp-about-story__principles">
            <article><ShieldCheck /><div><strong>تجربه و اعتبار اطلس</strong><span>پشتوانه‌ای برای شناخت نیاز بازار قطعات صنعتی</span></div></article>
            <article><Layers3 /><div><strong>تبدیل تجربه به پلتفرم</strong><span>تجمیع قطعات و برندها در یک بازار آنلاین تخصصی</span></div></article>
            <article><UsersRound /><div><strong>تمرکز بر نیاز صنعت</strong><span>طراحی مسیرهای کاربردی برای مشتریان صنعتی</span></div></article>
          </div>
          <div className="sp-about-timeline" aria-label="مسیر شکل‌گیری صنعت پیش">
            {milestones.map((item, index) => (
              <div className="sp-about-timeline__item" key={item.label}>
                <span className="sp-about-timeline__label">{item.label}</span>
                <span className={"sp-about-timeline__dot " + (index === milestones.length - 1 ? "is-current" : "")} />
                <strong>{item.title}</strong><small>{item.text}</small>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sp-about-capabilities" aria-labelledby="sp-about-capabilities-title">
        <div className="sp-about-capabilities__backdrop" />
        <div className="sp-about-section-heading sp-about-section-heading--center">
          <span className="sp-about-eyebrow">توانمندی‌ها و ارزش‌های ما</span>
          <h2 id="sp-about-capabilities-title">آنچه <em>صنعت پیش</em> را متمایز می‌کند</h2>
        </div>
        <div className="sp-about-capability-grid">
          {capabilities.map(({ title, text, image, Icon }) => (
            <article className="sp-about-capability" key={title}>
              <img src={image} alt="" loading="lazy" decoding="async" />
              <div className="sp-about-capability__shade" />
              <div className="sp-about-capability__content"><Icon size={29} strokeWidth={1.7} /><h3>{title}</h3><p>{text}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="sp-about-facts" aria-label="ویژگی‌های صنعت پیش">
        <div className="sp-about-facts__heading">صنعت پیش در یک نگاه</div>
        <div className="sp-about-facts__grid">
          {valueFacts.map(({ title, text, Icon }) => (
            <article className="sp-about-fact" key={title}><Icon size={27} strokeWidth={1.8} /><strong>{title}</strong><span>{text}</span></article>
          ))}
        </div>
      </section>

      <section className="sp-about-destinations" aria-labelledby="sp-about-destinations-title">
        <div className="sp-about-section-heading sp-about-section-heading--center">
          <span className="sp-about-eyebrow">مسیرهای بیشتر در صنعت پیش</span>
          <h2 id="sp-about-destinations-title">بخش‌های دیگر را کشف کنید</h2>
        </div>
        <div className="sp-about-destination-grid">
          {destinations.map(({ to, title, text, image, Icon }) => (
            <Link to={to} className="sp-about-destination" key={to}>
              <img src={image} alt="" loading="lazy" decoding="async" />
              <span className="sp-about-destination__shade" />
              <span className="sp-about-destination__copy"><Icon size={25} /><strong>{title}</strong><small>{text}</small></span>
              <span className="sp-about-destination__arrow" aria-hidden="true"><ArrowUpLeft size={17} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="sp-about-cta" aria-labelledby="sp-about-cta-title">
        <div className="sp-about-cta__visual"><img src={STORE_ASSETS.engineerWhyAtlas} alt="کارشناس فنی در محیط صنعتی" loading="lazy" decoding="async" /></div>
        <div className="sp-about-cta__copy">
          <span className="sp-about-eyebrow">همراه مطمئن صنعت</span>
          <h2 id="sp-about-cta-title">همین امروز، نیاز صنعتی خود را در <em>صنعت پیش</em> تأمین کنید</h2>
          <p>از جستجوی قطعه و بررسی مشخصات تا دریافت مشاوره و ثبت درخواست تأمین، مسیر خود را از صنعت پیش آغاز کنید.</p>
          <div className="sp-about-actions">
            <Link to="/products" className="sp-about-button sp-about-button--primary"><ShoppingCart size={17} />ورود به بازار قطعات</Link>
            <Link to="/contact" className="sp-about-button sp-about-button--outline"><Headphones size={17} />دریافت مشاوره</Link>
          </div>
        </div>
      </section>
    </main>
  );
}

export default AboutPage;
