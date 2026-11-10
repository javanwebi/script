import { IndustryTools } from "../components/storefront/IndustryTools";
const TileCeramicIndustryPage = React.lazy(() => import("./TileCeramicIndustryPage").then(m => ({default:m.TileCeramicIndustryPage})));
const TextileIndustryPage = React.lazy(() => import("./TextileIndustryPage").then(m => ({ default: m.TextileIndustryPage })));
import { scrollToSectionElement } from "../components/layout/ScrollToTop";
import yazdRegionMap from "../assets/images/yazd-region-osm.png";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpLeft,
  ArrowLeft,
  Search,
  ScanLine,
  MessageSquare,
  MapPin,
  Phone,
  Layers,
  BookOpen,
  Check,
  Factory,
  Clock,
  Compass,
  ChevronLeft,
  ChevronRight,
  Download,
  Boxes,
  Headphones,
  Wrench,
  Package,
} from "lucide-react";
import { INDUSTRIES, ARTICLES } from "../data/siteContent";
import { getManagedBrands } from "../data/brands";
import type { Brand } from "../types";
import { databaseStorageEnabled } from "../services/durableStorage";
import { STORE_ASSETS as A } from "../assets/images";
import { getAllProducts, subscribeCatalogChanges } from "../data/mockGenerator";
import { ProductCard } from "../components/product/ProductCard";
import { MemberAccess } from "../components/storefront/MemberAccess";
import { rankIndustryProducts } from "../utils/industryCatalog";
const title = (text: string) => {
  document.title = `${text} | صنعت پیش`;
};
export function SectionHeading({
  eyebrow,
  title: heading,
  text,
}: {
  eyebrow: string;
  title: string;
  text?: string;
}) {
  return (
    <div className="editorial-heading">
      <span className="store-eyebrow">{eyebrow}</span>
      <h2>{heading}</h2>
      {text && <p>{text}</p>}
    </div>
  );
}
export function MapCard({ compact = false }: { compact?: boolean }) {
  const [interactive, setInteractive] = useState(false);
  return (
    <div className={`location-card ${compact ? "location-card-compact" : ""}`}>
      <div className="location-map">
        {interactive ? (
          <iframe
            title="نقشه محدوده یزد و میبد"
            src="https://www.openstreetmap.org/export/embed.html?bbox=53.95%2C31.78%2C54.60%2C32.35&layer=mapnik"
            referrerPolicy="no-referrer"
          />
        ) : (
          <>
            <img
              src={yazdRegionMap}
              alt="نقشه منطقه‌ای یزد از OpenStreetMap"
              className="location-map-preview"
            />
            <button
              type="button"
              onClick={() => setInteractive(true)}
              className="location-map-activate"
            >
              فعال کردن نقشه تعاملی <Compass size={14} />
            </button>
          </>
        )}
        <a
          className="map-attribution"
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          © OpenStreetMap
        </a>
      </div>
      <div>
        <span className="store-eyebrow">ارتباط مستقیم</span>
        <h3>از مشاوره تا هماهنگی مراجعه</h3>
        <p>
          دفتر فروش یزد و مجموعه میبد؛ پیش از مراجعه، نشانی و ساعت حضور را با ما
          هماهنگ کنید.
        </p>
        <div className="editorial-actions">
          <Link to="/contact">
            <MapPin size={16} />
            آدرس و راه‌های تماس
          </Link>
          <a
            href="https://www.openstreetmap.org/search?query=Yazd%20Iran"
            target="_blank"
            rel="noreferrer"
          >
            باز کردن نقشه <ArrowUpLeft size={16} />
          </a>
        </div>
      </div>
    </div>
  );
}
type IndustryContent = (typeof INDUSTRIES)[number];

function IndustryVisualModule({ industry }: { industry: IndustryContent }) {
  const steps = industry.steps.slice(0, 4);
  if (industry.slug === 'textile') {
    return (
      <section className="industry-visual-module industry-visual-module--textile editorial-wrap" aria-label="مسیر تولید نساجی">
        <div className="industry-visual-copy">
          <span className="industry-visual-eyebrow">کنترل حرکت در چهار مرحله</span>
          <h2>از ریسندگی تا جمع‌کردن پارچه، حرکت باید هماهنگ بماند</h2>
          <p>{industry.note}</p>
          <div className="industry-material-tags">{industry.parts.map(part => <span key={part}>{part}</span>)}</div>
        </div>
        <div className="industry-visual-step-grid">
          {steps.map((step, index) => <div className="industry-visual-step" key={step}><b>0{index + 1}</b><span>{step}</span></div>)}
        </div>
      </section>
    );
  }
  if (industry.slug === 'packaging') {
    return (
      <section className="industry-visual-module industry-visual-module--packaging editorial-wrap" aria-label="ایستگاه‌های خط بسته‌بندی">
        <div className="industry-visual-copy">
          <span className="industry-visual-eyebrow">جریان پیوسته محصول</span>
          <h2>هر ایستگاه به قطعه‌ای هماهنگ با سرعت خط نیاز دارد</h2>
          <p>{industry.note}</p>
        </div>
        <div className="industry-packaging-flow">
          {steps.map((step, index) => <div className="industry-packaging-step" key={step}><span className="industry-packaging-number">{index + 1}</span><div><b>{step}</b><small>{industry.parts[index % industry.parts.length]}</small></div></div>)}
        </div>
      </section>
    );
  }
  if (industry.slug === 'food') {
    return (
      <section className="industry-visual-module industry-visual-module--food editorial-wrap" aria-label="مسیر کنترل قطعات صنایع غذایی">
        <div className="industry-food-seal"><span>FOOD</span><b>کنترل پیش از نصب</b><small>جنس، تماس و شست‌وشو</small></div>
        <div className="industry-visual-copy">
          <span className="industry-visual-eyebrow">محیط تولید حساس</span>
          <h2>سازگاری بهداشتی را برای کد دقیق قطعه تأیید کنید</h2>
          <p>{industry.note}</p>
          <div className="industry-food-points">{industry.checks.map((item, index) => <div key={item}><b>0{index + 1}</b><span>{item}</span></div>)}</div>
        </div>
      </section>
    );
  }
  if (industry.slug === 'machinery') {
    return (
      <section className="industry-visual-module industry-visual-module--machinery editorial-wrap" aria-label="فرایند مهندسی ماشین‌آلات">
        <div className="industry-machinery-blueprint">
          <span>ENGINEERING INPUT</span>
          <div className="industry-blueprint-grid">{['نقشه','تلرانس','جنس','بار و سرعت'].map((item, index) => <div key={item}><b>0{index + 1}</b><span>{item}</span></div>)}</div>
          <small>اطلاعات پایه برای بررسی تأمین یا ساخت</small>
        </div>
        <div className="industry-visual-copy">
          <span className="industry-visual-eyebrow">از نمونه تا مجموعه مکانیکی</span>
          <h2>قطعه را در ارتباط با کل مجموعه بررسی کنید</h2>
          <p>{industry.note}</p>
          <div className="industry-machinery-steps">{steps.map((step, index) => <span key={step}><b>{index + 1}</b>{step}</span>)}</div>
        </div>
      </section>
    );
  }
  if (industry.slug === 'rubber') {
    return (
      <section className="industry-visual-module industry-visual-module--rubber editorial-wrap" aria-label="انتخاب قطعات لاستیک و پلاستیک">
        <div className="industry-visual-copy">
          <span className="industry-visual-eyebrow">انتخاب بر پایه شرایط واقعی کار</span>
          <h2>جنس قطعه را با ماده، فشار و دمای خط تطبیق دهید</h2>
          <p>{industry.note}</p>
          <div className="industry-material-tags">{industry.parts.map(part => <span key={part}>{part}</span>)}</div>
        </div>
        <div className="industry-rubber-criteria">{industry.checks.map((item, index) => <div key={item}><b>0{index + 1}</b><span>{item}</span></div>)}</div>
      </section>
    );
  }
  return null;
}

export function IndustryPage() {
  const { slug = "ceramic" } = useParams();
  const industry = INDUSTRIES.find((i) => i.slug === slug) || INDUSTRIES[0];
  const [tick, setTick] = useState(0);
  useEffect(() => subscribeCatalogChanges(() => setTick((t) => t + 1)), []);
  useEffect(() => title(`قطعات صنعت ${industry.title}`), [industry]);
  const products = useMemo(
    () =>
      rankIndustryProducts(getAllProducts(), industry, 6),
    [industry, tick],
  );
  if (slug === "ceramic" || slug === "tile-ceramic" || slug === "ceramic-tiles") {
    return <React.Suspense fallback={<div role="status" className="min-h-[300px] flex items-center justify-center">در حال بارگذاری صفحه صنایع کاشی و سرامیک…</div>}><TileCeramicIndustryPage /></React.Suspense>;
  }
  if (slug === "textile") {
    return (
      <React.Suspense fallback={<div role="status" className="min-h-[300px] flex items-center justify-center">در حال بارگذاری صفحه تخصصی نساجی…</div>}>
        <TextileIndustryPage />
      </React.Suspense>
    );
  }
  return (
    <div className={`editorial industry-page industry-${industry.slug}`}>
      <section className={`industry-hero industry-hero--${industry.slug}`}>
        <img
          src={industry.image}
          alt={`خط تولید ${industry.title}`}
          fetchPriority="high"
        />
        <div className="industry-hero-shade" />
        <div className="editorial-wrap">
          <nav className="editorial-crumb">
            <Link to="/">صنعت پیش</Link>
            <span>/</span>
            <Link to="/industries">صنایع</Link>
          </nav>
          <span className="industry-kicker">{industry.eyebrow}</span>
          <h1>
            همراه خط تولید
            <br />
            <em>{industry.title}</em>
          </h1>
          <p>{industry.description}</p>
          <div className="editorial-actions">
            <a className="store-btn-primary" href="#industry-parts">
              کاوش قطعات این صنعت <ArrowLeft size={17} />
            </a>
            <Link
              className="industry-secondary"
              to={`/ai-consult?industry=${industry.slug}`}
            >
              مشاوره با FORZA <MessageSquare size={17} />
            </Link>
          </div>
        </div>
      </section>
      <IndustryTools key={industry.slug} industry={industry} />
      <IndustryVisualModule industry={industry} />
      <section className="editorial-wrap editorial-split scroll-mt-24" id="industry-parts">
        <SectionHeading
          eyebrow="از کاربرد شروع کنید"
          title="قطعه مناسب برای کدام بخش خط؟"
          text="این گروه‌ها نقطه شروع بررسی هستند. سازگاری هر کد با دستگاه و شرایط کار شما باید جداگانه تأیید شود."
        />
        <div className="industry-part-links">
          {industry.parts.map((p, i) => (
            <Link
              key={p}
              to={`/products?q=${encodeURIComponent(industry.terms[i])}`}
            >
              <Layers size={22} />
              <span>
                {p}
                <small>مشاهده خانواده‌ها و مشخصات</small>
              </span>
              <ArrowUpLeft size={19} />
            </Link>
          ))}
        </div>
      </section>
      <section className="industry-check-band" id="industry-checks">
        <div className="editorial-wrap editorial-split">
          <div>
            <SectionHeading
              eyebrow="انتخاب دقیق‌تر"
              title="قبل از استعلام، این اطلاعات را آماده کنید"
            />
            <p className="technical-note">{industry.note}</p>
          </div>
          <div className="industry-check-list">
            {industry.checks.map((c) => (
              <div key={c}>
                <Check size={18} />
                {c}
              </div>
            ))}
            <Link
              to={`/ai-consult?industry=${industry.slug}`}
              className="store-btn-secondary"
            >
              <ScanLine size={18} />
              ارسال تصویر و بررسی مشخصات
            </Link>
          </div>
        </div>
      </section>
      <section className="editorial-wrap" id="industry-catalog">
        <SectionHeading
          eyebrow="از کاتالوگ واقعی سایت"
          title="خانواده‌های مرتبط برای بررسی اولیه"
        />
        {products.length > 0 ? (
          <div className="editorial-products">
            {products.map((p) => (
              <ProductCard key={p.code} product={p} />
            ))}
          </div>
        ) : (
          <div className="industry-catalog-empty" role="status">
            <strong>فعلاً محصول تأییدشده‌ای برای نمایش این بخش پیدا نشد.</strong>
            <p>برای جلوگیری از پیشنهاد کالای نامرتبط، فقط خانواده‌های واقعی و فعال کاتالوگ نمایش داده می‌شوند.</p>
            <Link to={`/products?q=${encodeURIComponent(industry.terms.join(" "))}`} className="store-btn-secondary">
              جستجو در کاتالوگ کامل
            </Link>
          </div>
        )}
        <MemberAccess />
      </section>
      <section className="editorial-wrap" id="industry-related">
        <SectionHeading
          eyebrow="صنعت پیش، برای صنعت شما"
          title="صنایع دیگر را هم بررسی کنید"
        />
        <div className="industry-related">
          {INDUSTRIES.filter((i) => i.slug !== industry.slug).map((i) => (
            <Link to={`/industries/${i.slug}`} key={i.slug}>
              <img src={i.image} alt="" loading="lazy" />
              <span>
                {i.title}
                <ArrowUpLeft size={17} />
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
export function IndustriesPage() {
  useEffect(() => title("صنایع تحت پوشش"), []);
  return (
    <main className="company-page company-page--industries" dir="rtl">
      <section className="company-hero company-hero--industries">
        <div className="company-hero-copy">
          <span className="company-kicker">صنایع تحت پوشش</span>
          <h1>هر صنعت، نیاز فنی خودش را دارد؛ <em>مسیر تأمین هم باید تخصصی باشد.</em></h1>
          <p>
            برای شناخت گروه قطعات، کاربردها و اطلاعات لازم جهت بررسی فنی،
            صنعت موردنظر را انتخاب کنید. هر صفحه به نیازهای همان صنعت و
            خانواده‌های مرتبط در کاتالوگ متصل است.
          </p>
          <div className="company-hero-actions">
            <Link to="/ai-consult" className="company-button company-button--primary">
              مشاوره متناسب با صنعت <MessageSquare size={18} />
            </Link>
            <Link to="/products" className="company-button company-button--secondary">
              جستجو در کاتالوگ <Search size={18} />
            </Link>
          </div>
        </div>
        <div className="company-hero-visual">
          <img src={A.industries.bgPlant} alt="نمای یک مجموعه صنعتی و خطوط تولید" fetchPriority="high" />
          <div className="company-hero-visual-shade" />
          <div className="company-hero-visual-caption">
            <span>صنعت پیش</span>
            <strong>تأمین متناسب با کاربرد</strong>
            <small>از شناخت نیاز تا بررسی قطعه</small>
          </div>
        </div>
      </section>

      <section className="company-industry-intro">
        <div>
          <span className="company-kicker">انتخاب صنعت</span>
          <h2>صفحه اختصاصی هر صنعت را ببینید</h2>
          <p>در هر صفحه، گروه‌های قطعه و معیارهای فنی مرتبط با همان حوزه معرفی می‌شوند؛ پیشنهاد محصول نیز از کاتالوگ واقعی و خانواده‌های فعال انتخاب می‌شود.</p>
        </div>
        <span className="company-industry-count">{INDUSTRIES.length.toLocaleString("fa-IR")} حوزه تخصصی</span>
      </section>

      <section className="company-industry-grid">
        {INDUSTRIES.map((industry) => (
          <Link to={`/industries/${industry.slug}`} key={industry.slug} className="company-industry-card">
            <img src={industry.image} alt={`خط تولید ${industry.title}`} loading="lazy" />
            <div className="company-industry-card-shade" />
            <div className="company-industry-card-copy">
              <span>{industry.eyebrow}</span>
              <h2>{industry.title}</h2>
              <p>{industry.description}</p>
              <div className="company-industry-tags">
                {industry.parts.slice(0, 3).map((part) => <small key={part}>{part}</small>)}
              </div>
              <b>ورود به صفحه این صنعت <ArrowUpLeft size={18} /></b>
            </div>
          </Link>
        ))}
      </section>
      <section className="company-bottom-cta">
        <div>
          <span className="company-kicker">نیاز خط تولید شما</span>
          <h2>اگر صنعت یا کاربرد خود را پیدا نکردید، با ما مطرح کنید.</h2>
          <p>کارشناسان می‌توانند برای شناسایی نیاز و بررسی قطعه راهنمایی‌تان کنند.</p>
        </div>
        <Link to="/contact" className="company-button company-button--primary">تماس و هماهنگی <ArrowLeft size={18} /></Link>
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
    title("برندها و محصولات");
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
    () => Array.from(new Set(publishedBrands.flatMap((brand) => brand.specialties || []))).sort((a, b) => a.localeCompare(b, "fa")),
    [publishedBrands],
  );
  const brands = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    return publishedBrands.filter((brand) =>
      brand.active !== false &&
      `${brand.name} ${brand.nameEn} ${brand.country} ${brand.specialties?.join(" ")}`.toLocaleLowerCase().includes(q) &&
      (!specialty || brand.specialties?.includes(specialty)),
    );
  }, [publishedBrands, query, specialty]);

  return (
    <main className="company-page company-page--brands" dir="rtl">
      <section className="company-hero company-hero--brands">
        <div className="company-hero-copy">
          <span className="company-kicker">برندها و محصولات</span>
          <h1>برند را بشناسید؛ <em>قطعه را با مشخصات فنی انتخاب کنید.</em></h1>
          <p>
            فهرست زیر از برندهای منتشرشده در اطلاعات صنعت پیش خوانده می‌شود.
            برای بررسی کالاهای هر برند، وارد کاتالوگ شوید و کد، مشخصات و
            وضعیت قیمت همان محصول را ببینید.
          </p>
          <div className="company-hero-actions">
            <a href="#brand-directory" className="company-button company-button--primary">کاوش برندها <ArrowLeft size={18} /></a>
            <Link to="/products" className="company-button company-button--secondary">کاتالوگ قطعات <Layers size={18} /></Link>
          </div>
        </div>
        <div className="company-hero-visual">
          <img src={A.brandsFullbleedBg} alt="برندها و قطعات صنعتی" fetchPriority="high" />
          <div className="company-hero-visual-shade" />
          <div className="company-hero-visual-caption">
            <span>انتخاب آگاهانه</span>
            <strong>برند، کد فنی، مشخصات</strong>
            <small>اطلاعات برندهای منتشرشده در کاتالوگ</small>
          </div>
        </div>
      </section>

      <section className="company-brand-toolbar" id="brand-directory">
        <div>
          <span className="company-kicker">فهرست برندها</span>
          <h2>برندهای ثبت‌شده در کاتالوگ صنعت پیش</h2>
        </div>
        <label className="company-brand-search">
          <Search size={19} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام برند، کشور یا حوزه تخصصی…" aria-label="جستجوی برندها" />
        </label>
      </section>

      {specialties.length > 0 && (
        <div className="company-brand-filters" role="group" aria-label="فیلتر حوزه تخصصی برند">
          <button type="button" aria-pressed={!specialty} onClick={() => setSpecialty("")}>همه حوزه‌ها</button>
          {specialties.map((item) => (
            <button type="button" key={item} aria-pressed={specialty === item} onClick={() => setSpecialty(item)}>{item}</button>
          ))}
        </div>
      )}

      {brands.length > 0 ? (
        <section className="company-brand-grid" aria-live="polite">
          {brands.map((brand) => {
            const logo = brand.id === "forza" ? A.logoForza : brand.id === "swr" ? A.swrLogo : (brand.image || brand.logo);
            return (
              <article className="company-brand-card" key={brand.id}>
                <div className="company-brand-logo">
                  {logo ? <img src={logo} alt={brand.nameEn || brand.name} loading="lazy" /> : <span>{(brand.nameEn || brand.name).slice(0, 2).toUpperCase()}</span>}
                </div>
                <div className="company-brand-card-copy">
                  <div className="company-brand-card-meta">
                    <span>{brand.country || "برند صنعتی"}</span>
                    {brand.isExclusive && <b>همکاری انحصاری اطلس</b>}
                  </div>
                  <h3>{brand.name}</h3>
                  <p>{brand.description || "برای مشاهده محصولات و کدهای مرتبط، کاتالوگ صنعت پیش را بررسی کنید."}</p>
                  {!!brand.specialties?.length && (
                    <div className="company-brand-tags">
                      {brand.specialties.slice(0, 4).map((item) => <small key={item}>{item}</small>)}
                    </div>
                  )}
                  <Link to={`/products?q=${encodeURIComponent(brand.nameEn || brand.name)}`}>
                    بررسی محصولات این برند <ArrowUpLeft size={17} />
                  </Link>
                </div>
              </article>
            );
          })}
        </section>
      ) : (
        <div className="company-empty-state" role="status" aria-live="polite">
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

      <p className="company-brand-disclaimer">
        نمایش نام یک برند به‌تنهایی به معنی موجودی همه محصولات یا تأیید نمایندگی رسمی آن نیست؛ وضعیت هر کالا و شرایط تأمین باید در صفحه محصول یا از طریق استعلام بررسی شود.
      </p>
    </main>
  );
}
export function KnowledgePage() {
  const { slug } = useParams();
  const [query, setQuery] = useState("");
  const article = ARTICLES.find((a) => a.slug === slug);
  useEffect(() => title(article?.title || "دانشنامه صنعت پیش"), [article]);
  if (slug && !article)
    return (
      <div className="editorial editorial-wrap">
        <h1>این راهنما پیدا نشد</h1>
        <Link to="/knowledge">بازگشت به دانشنامه</Link>
      </div>
    );
  if (article)
    return (
      <article className="editorial knowledge-article">
        <header className="editorial-wrap">
          <Link to="/knowledge" className="editorial-text-link">
            دانشنامه صنعت پیش <ArrowLeft size={17} />
          </Link>
          <span className="store-eyebrow">
            {article.category} · {article.minutes} دقیقه مطالعه
          </span>
          <h1>{article.title}</h1>
          <p>{article.summary}</p>
        </header>
        <img
          className="knowledge-cover"
          src={article.image}
          alt={article.title}
        />
        <div className="knowledge-reading">
          <aside>
            <strong>در این راهنما</strong>
            {article.sections.map(([h], i) => (
              <a href={`#part-${i}`} key={h}>
                {h}
              </a>
            ))}
          </aside>
          <div>
            {article.sections.map(([h, p], i) => (
              <section id={`part-${i}`} key={h}>
                <h2>{h}</h2>
                <p>{p}</p>
              </section>
            ))}
            <div className="editorial-note">
              این مطلب راهنمای عمومی انتخاب و آماده‌سازی اطلاعات است؛ مشخصات
              کاتالوگ سازنده و دستورالعمل دستگاه ملاک تأیید نهایی هستند.
            </div>
            <div className="editorial-actions">
              <Link to="/ai-consult" className="store-btn-primary">
                پرسش از FORZA <MessageSquare size={17} />
              </Link>
              <Link
                to={`/products?q=${encodeURIComponent(article.query)}`}
                className="store-btn-secondary"
              >
                بررسی محصولات مرتبط
              </Link>
            </div>
          </div>
        </div>
      </article>
    );
  const list = ARTICLES.filter((a) =>
    `${a.title} ${a.category}`.includes(query),
  );
  return (
    <div className="editorial editorial-wrap">
      <section className="knowledge-intro">
        <div>
          <span className="store-eyebrow">دانشنامه صنعت پیش</span>
          <h1>
            شناخت بهتر قطعه،
            <br />
            <em>انتخاب مطمئن‌تر.</em>
          </h1>
          <p>
            راهنماهای کوتاه و کاربردی برای شناسایی، انتخاب و درخواست ساخت قطعات
            صنعتی.
          </p>
          <label className="editorial-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="جستجوی دانشنامه"
              placeholder="دنبال چه راهنمایی هستید؟"
            />
          </label>
        </div>
        <BookOpen size={120} strokeWidth={1} />
      </section>
      <div className="knowledge-grid">
        {list.map((a) => (
          <KnowledgeCard key={a.slug} article={a} />
        ))}
      </div>
      {!list.length && <p role="status">راهنمایی با این عبارت پیدا نشد.</p>}
    </div>
  );
}
export function KnowledgeCard({
  article: a,
}: {
  article: (typeof ARTICLES)[number];
}) {
  return (
    <Link to={`/knowledge/${a.slug}`} className="knowledge-card">
      <img src={a.image} alt="" loading="lazy" />
      <div>
        <span>
          {a.category} · {a.minutes} دقیقه مطالعه
        </span>
        <h3>{a.title}</h3>
        <p>{a.summary}</p>
        <b>
          مطالعه راهنما <ArrowUpLeft size={17} />
        </b>
      </div>
    </Link>
  );
}
export function HomeKnowledge() {
  const articlesScrollRef = useRef<HTMLDivElement>(null);

  const featuredArticles = [
    {
      slug: "belt-selection",
      title: "نقش قطعات باکیفیت در افزایش بهره‌وری خطوط تولید",
      date: "۱۴۰۳/۰۲/۱۸",
      image: A.whySanatQc,
    },
    {
      slug: "roller-wear",
      title: "اهمیت نگهداری و تعویض به‌موقع قطعات انتقال نیرو",
      date: "۱۴۰۳/۰۲/۲۰",
      image: A.heroPulley,
    },
    {
      slug: "visual-inquiry",
      title: "بررسی مشکلات رایج در نقاله‌های کاشی و سرامیک",
      date: "۱۴۰۳/۰۲/۲۴",
      image: A.industries.ceramic,
    },
    {
      slug: "belt-selection",
      title: "راهنمای انتخاب تسمه مناسب برای خط تولید کاشی",
      date: "۱۴۰۳/۰۲/۲۵",
      image: A.categories.belts,
    },
  ];

  const scrollArticles = (dir: "prev" | "next") => {
    if (!articlesScrollRef.current) return;
    const offset = dir === "next" ? -280 : 280;
    articlesScrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  return (
    <section
      aria-labelledby="home-knowledge-heading"
      className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 my-10 sm:my-14"
      dir="rtl"
    >
      {/* Top Section Header Bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <span className="w-1 h-6 sm:h-7 rounded-full bg-[#E06518] shrink-0" />
          <div>
            <h2
              id="home-knowledge-heading"
              className="text-lg sm:text-xl lg:text-2xl font-black text-[#23262B] tracking-tight"
            >
              اخبار و مقالات
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
              چند دقیقه برای انتخاب بهتر
            </p>
          </div>
        </div>

        <Link
          to="/knowledge"
          className="text-xs sm:text-sm font-bold text-[#E06518] hover:text-[#C95210] inline-flex items-center gap-1 transition-colors"
        >
          <span>مشاهده همه مقالات</span>
          <ChevronLeft className="w-4 h-4" />
        </Link>
      </div>

      {/* Main Content Container with Side Navigation Chevrons */}
      <div className="relative">
        {/* Right Carousel Arrow */}
        <button
          type="button"
          onClick={() => scrollArticles("prev")}
          aria-label="مقالات قبلی"
          className="hidden sm:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white hover:bg-orange-50 border border-slate-200 hover:border-[#E06518] text-slate-600 hover:text-[#E06518] shadow-md items-center justify-center transition-all cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Left Carousel Arrow */}
        <button
          type="button"
          onClick={() => scrollArticles("next")}
          aria-label="مقالات بعدی"
          className="hidden sm:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white hover:bg-orange-50 border border-slate-200 hover:border-[#E06518] text-slate-600 hover:text-[#E06518] shadow-md items-center justify-center transition-all cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* ================================================================= */}
          {/* RIGHT COLUMN IN RTL (4 cols): دانلود کاتالوگ کامل محصولات          */}
          {/* ================================================================= */}
          <div className="lg:col-span-4 rounded-2xl bg-[#F2F4F7] border border-slate-200/90 p-5 flex items-center justify-between gap-4 relative overflow-hidden shadow-2xs">
            {/* 3D Catalog Book Illustration (Right side inside the card) */}
            <div className="w-32 sm:w-36 h-40 sm:h-44 shrink-0 flex items-center justify-center relative">
              <div className="relative w-28 sm:w-32 h-36 sm:h-40 rounded-r-lg rounded-l-xs bg-white shadow-[10px_14px_25px_rgba(15,23,42,0.18)] border border-slate-200 overflow-hidden -rotate-6 transform-gpu">
                {/* Book Spine & Page Edge Highlight */}
                <div className="absolute inset-y-0 right-0 w-2 bg-gradient-to-l from-slate-300 to-slate-100 z-20" />
                {/* Top Brand Header on Cover */}
                <div className="p-2.5 flex items-center justify-between text-[8px] font-mono font-bold text-slate-600">
                  <span className="text-[#E06518] font-black">FORZA</span>
                  <span>SANAT PISH</span>
                </div>
                {/* Geometric Industrial Diagonal Stripes matching Image 2 */}
                <svg
                  viewBox="0 0 120 140"
                  className="w-full h-full"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <polygon points="0,15 120,75 120,108 0,48" fill="#23262B" />
                  <polygon points="0,56 120,116 120,140 0,100" fill="#E06518" />
                  <polygon points="35,0 120,42 120,66 35,24" fill="#E2E8F0" />
                </svg>
                {/* Bottom Label on Cover */}
                <div className="absolute bottom-2 left-2.5 text-[7px] font-mono font-bold text-slate-700 bg-white/90 px-1.5 py-0.5 rounded">
                  CATALOG 2026
                </div>
              </div>
            </div>

            {/* Catalog Text & Download CTA (Left side inside the card, right-aligned) */}
            <div className="flex-1 text-right space-y-2 z-10">
              <h3 className="text-base sm:text-lg font-black text-[#23262B] leading-snug">
                دانلود کاتالوگ کامل
              </h3>
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                محصولات
              </p>
              <div
                className="text-[11px] font-mono font-semibold text-slate-400 pt-0.5"
                dir="ltr"
              >
                PDF - 12.5MB
              </div>

              <div className="pt-2">
                <Link
                  to="/products"
                  className="w-full sm:w-auto h-10 px-4 rounded-xl bg-[#E06518] hover:bg-[#C95210] text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-sm shadow-orange-500/20 transition-all active:scale-95 whitespace-nowrap"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  <span>دانلود کاتالوگ</span>
                </Link>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* LEFT COLUMN IN RTL (8 cols): 4 Article Cards                      */}
          {/* Responsive: Horizontal Snap Carousel on Mobile, 4-Col on Desktop  */}
          {/* ================================================================= */}
          <div
            ref={articlesScrollRef}
            className="lg:col-span-8 flex lg:grid lg:grid-cols-4 gap-3.5 sm:gap-4 overflow-x-auto lg:overflow-visible snap-x snap-mandatory pb-2 lg:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {featuredArticles.map((art, index) => (
              <Link
                key={`${art.slug}-${index}`}
                to={`/knowledge/${art.slug}`}
                className="group min-w-[230px] sm:min-w-[240px] lg:min-w-0 snap-start bg-white rounded-2xl border border-slate-200/90 hover:border-[#E06518]/60 shadow-2xs hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="w-full h-32 sm:h-36 bg-slate-100 overflow-hidden">
                    <img
                      src={art.image}
                      alt={art.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-3.5 text-right">
                    <h3 className="text-xs sm:text-[13px] font-extrabold text-[#23262B] group-hover:text-[#E06518] leading-relaxed line-clamp-2 transition-colors">
                      {art.title}
                    </h3>
                  </div>
                </div>

                <div className="px-3.5 pb-3 pt-1 flex items-center justify-end">
                  <span className="text-[11px] text-slate-400 font-medium">
                    {art.date}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Mobile Carousel Controls Indicator */}
        <div className="flex sm:hidden items-center justify-between pt-3 px-1">
          <span className="text-[11px] text-slate-400 font-medium">
            برای مشاهده سایر مقالات به چپ بکشید
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => scrollArticles("prev")}
              aria-label="قبلی"
              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs active:scale-95"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollArticles("next")}
              aria-label="بعدی"
              className="w-8 h-8 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center shadow-2xs active:scale-95"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
export function AboutNavigation({ onNavigate }: { onNavigate: () => void }) {
  return (
    <div className="about-navigation">
      <div>
        <span className="store-eyebrow">با صنعت پیش، هوشمندانه پیش بروید</span>
        <h3>تجربه صنعتی، مسیر خرید هوشمند</h3>
        <p>از تأمین و ساخت قطعه تا انتخاب آگاهانه و پیگیری سفارش.</p>
        <div className="about-navigation-links">
          {[
            ["/about", "آشنایی با صنعت پیش"],
            ["/services", "توانمندی‌ها و خدمات"],
            ["/industries", "صنایع تحت پوشش"],
            ["/brands", "برندها و محصولات"],
            ["/knowledge", "دانشنامه کاربردی"],
            ["/contact", "تماس و هماهنگی مراجعه"],
          ].map(([to, text]) => (
            <Link key={to} to={to} onClick={onNavigate}>
              {text}
              <ArrowUpLeft size={15} />
            </Link>
          ))}
        </div>
      </div>
      <MapCard compact />
    </div>
  );
}
export function AboutPage() {
  useEffect(() => title("درباره صنعت پیش"), []);
  const pathways = [
    {
      to: "/services",
      title: "توانمندی‌ها و خدمات",
      text: "از تأمین قطعات و مشاوره فنی تا شناسایی تصویری و بررسی ساخت قطعات خاص.",
      image: A.whySanatCadEngineering,
      Icon: Wrench,
      action: "مشاهده خدمات",
    },
    {
      to: "/industries",
      title: "صنایع تحت پوشش",
      text: "مسیرهای اختصاصی برای شناخت نیازهای خطوط تولید در صنایع مختلف.",
      image: A.industries.bgPlant,
      Icon: Factory,
      action: "انتخاب صنعت",
    },
    {
      to: "/brands",
      title: "برندها و محصولات",
      text: "شناخت برندهای ثبت‌شده در کاتالوگ و رفتن به محصولات مرتبط.",
      image: A.brandsFullbleedBg,
      Icon: Boxes,
      action: "بررسی برندها",
    },
    {
      to: "/products",
      title: "کاتالوگ قطعات",
      text: "جستجو بر اساس نام، برند، خانواده محصول و کد فنی.",
      image: A.partsWarehouseVault,
      Icon: Package,
      action: "ورود به کاتالوگ",
    },
    {
      to: "/knowledge",
      title: "دانشنامه کاربردی",
      text: "راهنماهای انتخاب، نگهداری و آماده‌سازی اطلاعات فنی قطعات.",
      image: A.aiSearchMobile,
      Icon: BookOpen,
      action: "مطالعه راهنماها",
    },
    {
      to: "/contact",
      title: "تماس و هماهنگی مراجعه",
      text: "راه‌های ارتباط با کارشناسان و هماهنگی پیش از مراجعه حضوری.",
      image: A.engineerWhyAtlas,
      Icon: Headphones,
      action: "ارتباط با مجموعه",
    },
  ];

  return (
    <main className="company-page company-page--about" dir="rtl">
      <section className="company-hero company-hero--about">
        <div className="company-hero-copy">
          <div className="company-brand-pair">
            <img src={A.atlasLogo} alt="لوگوی اطلس" />
            <span>با پشتوانه بازرگانی تسمه اطلس</span>
          </div>
          <span className="company-kicker">درباره صنعت پیش</span>
          <h1>
            از تجربه اطلس تا
            <em> بازار جامع قطعات صنعتی ایران</em>
          </h1>
          <p>
            صنعت پیش با پشتوانه بازرگانی تسمه اطلس شکل گرفته است تا مسیر
            تأمین قطعات صنعتی را ساده‌تر، شفاف‌تر و تخصصی‌تر کند.
          </p>
          <p>
            چشم‌انداز ما گردآوری قطعات و برندهای صنعتی در یک بازار آنلاین
            تخصصی است؛ بستری برای جستجو با نام و کد فنی، بررسی مشخصات، مقایسه،
            دریافت مشاوره، استعلام و خرید؛ متمرکز بر نیاز کارخانه‌ها و فعالان
            صنعت، نه کالاهای عمومی.
          </p>
          <div className="company-hero-actions">
            <Link to="/products" className="company-button company-button--primary">
              ورود به کاتالوگ قطعات <ArrowLeft size={18} />
            </Link>
            <Link to="/contact" className="company-button company-button--secondary">
              تماس با صنعت پیش <Phone size={17} />
            </Link>
          </div>
        </div>
        <div className="company-hero-visual">
          <img src={A.whySanatDirectFactory} alt="فضای صنعتی و زنجیره تأمین قطعات" fetchPriority="high" />
          <div className="company-hero-visual-shade" />
          <div className="company-hero-visual-caption">
            <span>صنعت پیش</span>
            <strong>پیش به صنعت</strong>
            <small>بازار تخصصی قطعات و تجهیزات صنعتی</small>
          </div>
          <div className="company-hero-visual-logo">
            <img src={A.atlasLogo} alt="اطلس" />
            <span>پشتوانه تجربه صنعتی</span>
          </div>
        </div>
      </section>

      <section className="company-story">
        <div className="company-story-copy">
          <span className="company-kicker">ریشه و مسیر شکل‌گیری</span>
          <h2>تجربه اطلس، پایه‌ای برای یک تجربه آنلاین تخصصی</h2>
          <p>
            در بازار قطعات صنعتی، پیدا کردن کالا فقط با دانستن نام آن تمام
            نمی‌شود. کد فنی، برند، ابعاد، شرایط کار و سازگاری با دستگاه در
            انتخاب درست نقش دارند. صنعت پیش می‌خواهد این اطلاعات و مسیرهای
            تأمین را در یک نقطه قابل جستجو و پیگیری کنار هم قرار دهد.
          </p>
          <p>
            این پلتفرم با تکیه بر تجربه اطلس و با توسعه تدریجی کاتالوگ، ابزارهای
            جستجو و خدمات دیجیتال ساخته می‌شود تا ارتباط میان نیاز صنعت و
            تأمین‌کنندگان قطعات، روشن‌تر و سریع‌تر شود.
          </p>
        </div>
        <div className="company-story-visual">
          <img src={A.heroPulley} alt="نمونه‌ای از قطعات مکانیکی و انتقال قدرت" loading="lazy" />
          <div>
            <strong>بازار آنلاین، فقط برای صنعت</strong>
            <span>قطعات · برندها · مشخصات فنی · استعلام و خرید</span>
          </div>
        </div>
      </section>

      <section className="company-vision-banner">
        <img src={A.refineryDuskWide} alt="" loading="lazy" />
        <div>
          <span>چشم‌انداز صنعت پیش</span>
          <h2>برای هر نیاز صنعتی، یک مسیر روشن از جستجو تا تأمین</h2>
          <p>
            هدف، ساخت مرجعی تخصصی است که قطعات و برندهای صنعتی را به کاتالوگی
            منسجم و تجربه‌ای یکپارچه برای انتخاب، استعلام و خرید آنلاین پیوند
            دهد.
          </p>
          <Link to="/products">شروع جستجو در کاتالوگ <ArrowLeft size={17} /></Link>
        </div>
      </section>

      <section className="company-pathways" id="capabilities">
        <div className="company-section-heading">
          <span className="company-kicker">مسیرهای مرتبط با صنعت پیش</span>
          <h2>از اینجا وارد بخش موردنیاز خود شوید</h2>
          <p>هر بخش صفحه مستقل و اطلاعات مرتبط با خودش را دارد؛ از خدمات تا صنایع، برندها و راه‌های ارتباط.</p>
        </div>
        <div className="company-pathway-grid">
          {pathways.map(({ to, title: cardTitle, text, image, Icon, action }) => (
            <Link to={to} className="company-pathway-card" key={to}>
              <div className="company-pathway-media">
                <img src={image} alt="" loading="lazy" />
                <span><Icon size={23} strokeWidth={1.8} /></span>
              </div>
              <div className="company-pathway-copy">
                <h3>{cardTitle}</h3>
                <p>{text}</p>
                <b>{action} <ArrowUpLeft size={17} /></b>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="company-price-callout">
        <div>
          <span className="company-kicker">دسترسی مشتریان</span>
          <h2>قیمت به‌روز هر کد، در حساب مشتری</h2>
          <p>
            قیمت کالا پس از ورود به حساب و بر اساس دسترسی و لیست قیمت فعال همان
            مشتری نمایش داده می‌شود. برای خانواده‌های چندکددار، ابتدا باید کد
            فنی موردنظر انتخاب شود؛ کالاهای بدون قیمت فعال نیز از مسیر استعلام
            پیگیری می‌شوند.
          </p>
        </div>
        <MemberAccess compact />
      </section>
    </main>
  );
}
