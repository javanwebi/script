import { IndustryTools } from "../components/storefront/IndustryTools";
const TileCeramicIndustryPage = React.lazy(() => import("./TileCeramicIndustryPage").then(m => ({default:m.TileCeramicIndustryPage})));
const TextileIndustryPage = React.lazy(() => import("./TextileIndustryPage").then(m => ({ default: m.TextileIndustryPage })));
import { scrollToSectionElement } from "../components/layout/ScrollToTop";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
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
  ShoppingCart,
  ShieldCheck,
  Users,
  Zap,
  Tag,
  Building2,
  Copy,
} from "lucide-react";
import { INDUSTRIES, ARTICLES } from "../data/siteContent";
import { getManagedBrands } from "../data/brands";
import { getManagedCategories } from "../data/categories";
import type { Brand } from "../types";
import { databaseStorageEnabled } from "../services/durableStorage";
import { STORE_ASSETS as A } from "../assets/images";
import { getAllProducts, subscribeCatalogChanges } from "../data/mockGenerator";
import { ProductCard } from "../components/product/ProductCard";
import { MemberAccess } from "../components/storefront/MemberAccess";
import { rankIndustryProducts } from "../utils/industryCatalog";
import "./industry-pages-premium.css";
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
              src={A.companyPages.yazdRegionMap}
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
      <section className={`industry-hero industry-hero--${industry.slug}`} aria-labelledby="industry-hero-title">
        <div className="industry-hero-layout">
          <div className="industry-hero-visual">
            <img
              src={industry.image}
              alt={`خط تولید ${industry.title}`}
              fetchPriority="high"
              decoding="async"
            />
            <div className="industry-hero-shade" />
            <div className="industry-hero-visual-caption">
              <span>فرآیند تولید {industry.title}</span>
              <strong>انتخاب قطعه بر اساس کاربرد و شرایط واقعی خط</strong>
            </div>
          </div>
          <div className="industry-hero-copy">
            <nav className="editorial-crumb industry-hero-crumb" aria-label="مسیر صفحه">
              <Link to="/">صنعت پیش</Link>
              <span>/</span>
              <Link to="/industries">صنایع</Link>
              <span>/</span>
              <span>{industry.title}</span>
            </nav>
            <span className="industry-kicker">{industry.eyebrow}</span>
            <h1 id="industry-hero-title" className="industry-hero-title">
              همراه خط تولید
              <em>{industry.title}</em>
            </h1>
            <p className="industry-hero-description">{industry.description}</p>
            <div className="industry-hero-tags" aria-label="گروه‌های مرتبط این صنعت">
              {industry.parts.slice(0, 4).map(part => <span key={part}>{part}</span>)}
            </div>
            <div className="industry-hero-actions">
              <a className="industry-hero-primary" href="#industry-parts">
                کاوش قطعات این صنعت <ArrowLeft size={16} />
              </a>
              <Link className="industry-hero-secondary" to={`/ai-consult?industry=${industry.slug}`}>
                مشاوره با FORZA <MessageSquare size={16} />
              </Link>
              <Link className="industry-hero-identify" to="/identify-part">
                شناسایی با تصویر <ScanLine size={16} />
              </Link>
            </div>
            <div className="industry-hero-metrics">
              <span><b>{industry.parts.length.toLocaleString("fa-IR")}</b> گروه قطعه مرتبط</span>
              <span><b>{industry.checks.length.toLocaleString("fa-IR")}</b> معیار بررسی فنی</span>
            </div>
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
  const [query, setQuery] = useState("");
  useEffect(() => title("صنایع تحت پوشش"), []);

  const filteredIndustries = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    if (!q) return INDUSTRIES;
    return INDUSTRIES.filter((ind) =>
      `${ind.title} ${ind.eyebrow} ${ind.description} ${ind.parts.join(" ")}`.toLocaleLowerCase().includes(q),
    );
  }, [query]);

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
            <Link to="/about" className="company-button company-button--secondary">
              درباره صنعت پیش
            </Link>
          </div>
        </div>
        <div className="company-hero-visual">
          <img src={A.companyPages.industriesHero} alt="خطوط تولید مکانیزه و نوار نقاله‌های صنعتی" fetchPriority="high" />
          <div className="company-hero-visual-shade" />
          <div className="company-hero-visual-caption">
            <span>صنعت پیش</span>
            <strong>تأمین متناسب با کاربرد</strong>
            <small>از شناخت نیاز تا بررسی قطعه در خطوط تولید</small>
          </div>
        </div>
      </section>

      <section className="company-industry-intro">
        <div>
          <span className="company-kicker">انتخاب صنعت</span>
          <h2>صفحه اختصاصی هر صنعت را ببینید</h2>
          <p>در هر صفحه، گروه‌های قطعه و معیارهای فنی مرتبط با همان حوزه معرفی می‌شوند؛ پیشنهاد محصول نیز از کاتالوگ واقعی و خانواده‌های فعال انتخاب می‌شود.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="company-brand-search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جستجوی صنعت یا قطعه خط تولید…"
              aria-label="جستجوی صنایع"
            />
          </label>
          <span className="company-industry-count tabular-nums">
            {filteredIndustries.length.toLocaleString("fa-IR")} حوزه تخصصی
          </span>
        </div>
      </section>

      {filteredIndustries.length > 0 ? (
        <section className="company-industry-grid" aria-live="polite">
          {filteredIndustries.map((industry) => (
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
      ) : (
        <div className="company-empty-state" role="status">
          <strong>صنعتی با این عبارت پیدا نشد.</strong>
          <p>عبارت جستجو را تغییر دهید یا از فهرست کامل کاتالوگ قطعه را جستجو کنید.</p>
        </div>
      )}

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
            <Link to="/services" className="company-button company-button--secondary">توانمندی‌ها و خدمات</Link>
          </div>
        </div>
        <div className="company-hero-visual">
          <img src={A.companyPages.brandsHero} alt="قطعات انتقال قدرت، شیرآلات و بلبرینگ‌های برندهای معتبر صنعتی" fetchPriority="high" />
          <div className="company-hero-visual-shade" />
          <div className="company-hero-visual-caption">
            <span>انتخاب آگاهانه</span>
            <strong>برند، کد فنی، مشخصات</strong>
            <small>اطلاعات برندهای منتشرشده در کاتالوگ صنعت پیش</small>
          </div>
        </div>
      </section>

      <section className="company-brand-toolbar" id="brand-directory">
        <div>
          <span className="company-kicker">فهرست برندها</span>
          <h2>برندهای ثبت‌شده در کاتالوگ صنعت پیش ({brands.length.toLocaleString("fa-IR")} برند)</h2>
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

      <section className="company-bottom-cta">
        <div>
          <span className="company-kicker">استعلام مستقیم و مشاوره</span>
          <h2>برای تأمین کد فنی خاص از برند موردنظر با ما در ارتباط باشید.</h2>
          <p>کد فنی یا تصویر قطعه را ارسال کنید تا موجودی و مسیر تأمین بررسی شود.</p>
        </div>
        <Link to="/contact" className="company-button company-button--primary">تماس و هماهنگی <ArrowLeft size={18} /></Link>
      </section>
    </main>
  );
}
export function KnowledgePage() {
  const { slug } = useParams();
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const article = ARTICLES.find((a) => a.slug === slug);
  useEffect(() => title(article?.title || "دانشنامه کاربردی صنعت پیش"), [article]);

  const categories = useMemo(
    () => Array.from(new Set(ARTICLES.map((item) => item.category))),
    [],
  );

  if (slug && !article) {
    return (
      <main className="company-page" dir="rtl">
        <div className="company-empty-state">
          <strong>این راهنما پیدا نشد</strong>
          <p>ممکن است نشانی راهنما تغییر کرده باشد. از فهرست دانشنامه مورد بعدی را انتخاب کنید.</p>
          <div className="mt-4 flex justify-center">
            <Link to="/knowledge" className="company-button company-button--primary">
              بازگشت به دانشنامه کاربردی <ArrowLeft size={17} />
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (article) {
    return (
      <main className="company-page editorial knowledge-article" dir="rtl">
        <header className="sp-knowledge-article-hero">
          <div>
            <Link to="/knowledge" className="inline-flex items-center gap-2 text-xs font-bold text-[#ffb27a] hover:text-white mb-4">
              <ArrowLeft size={16} className="rotate-180" />
              بازگشت به دانشنامه صنعت پیش
            </Link>
            <div className="text-xs font-extrabold text-[#ffb27a]">
              {article.category} · {article.minutes} دقیقه مطالعه
            </div>
            <h1>{article.title}</h1>
            <p>{article.summary}</p>
          </div>
          <div className="sp-knowledge-article-cover">
            <img src={article.image} alt={article.title} />
          </div>
        </header>

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
      </main>
    );
  }

  const featuredArticle = ARTICLES[0];
  const list = ARTICLES.filter((a) => {
    const q = query.trim().toLocaleLowerCase();
    const matchesQuery = !q || `${a.title} ${a.category} ${a.summary}`.toLocaleLowerCase().includes(q);
    const matchesCategory = !selectedCategory || a.category === selectedCategory;
    return matchesQuery && matchesCategory;
  });

  return (
    <main className="company-page company-page--knowledge" dir="rtl">
      <section className="sp-knowledge-hero">
        <div>
          <span className="company-kicker">دانشنامه کاربردی</span>
          <h1>
            شناخت بهتر قطعه، <em>انتخاب مطمئن‌تر.</em>
          </h1>
          <p>
            راهنماهای کوتاه و کاربردی برای اندازه‌گیری، عکاسی فنی، تطبیق کد و
            آماده‌سازی اطلاعات پیش از سفارش یا درخواست ساخت قطعات صنعتی.
          </p>
          <div className="company-hero-actions">
            <Link to="/identify-part" className="company-button company-button--primary">
              شناسایی تصویری قطعه <ScanLine size={18} />
            </Link>
            <Link to="/ai-consult" className="company-button company-button--secondary">
              مشاوره تخصصی FORZA
            </Link>
          </div>
        </div>

        <Link to={`/knowledge/${featuredArticle.slug}`} className="sp-knowledge-featured">
          <img src={featuredArticle.image} alt={featuredArticle.title} fetchPriority="high" />
          <div className="sp-knowledge-featured-shade" />
          <div className="sp-knowledge-featured-copy">
            <span>راهنمای منتخب · {featuredArticle.category}</span>
            <strong>{featuredArticle.title}</strong>
            <b>
              مطالعه کامل راهنما <ArrowUpLeft size={16} />
            </b>
          </div>
        </Link>
      </section>

      <div className="sp-knowledge-toolbar">
        <div className="sp-filter-tabs" role="group" aria-label="فیلتر موضوع دانشنامه">
          <button
            type="button"
            aria-pressed={!selectedCategory}
            onClick={() => setSelectedCategory("")}
          >
            همه راهنماها
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        <label className="company-brand-search">
          <Search size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="جستجوی دانشنامه"
            placeholder="دنبال چه راهنمایی هستید؟"
          />
        </label>
      </div>

      {list.length > 0 ? (
        <div className="sp-knowledge-grid" aria-live="polite">
          {list.map((a) => (
            <KnowledgeCard key={a.slug} article={a} />
          ))}
        </div>
      ) : (
        <div className="company-empty-state" role="status">
          <strong>راهنمایی با این عبارت پیدا نشد.</strong>
          <p>موضوع دیگری را انتخاب کنید یا عبارت جستجو را کوتاه‌تر بنویسید.</p>
        </div>
      )}

      <section className="company-bottom-cta">
        <div>
          <span className="company-kicker">پاسخ اختصاصی به مسئله خط شما</span>
          <h2>اگر پاسخ موردنظر در راهنماها نبود، مستقیماً از کارشناس یا FORZA بپرسید.</h2>
          <p>عکس قطعه یا کد فنی را بفرستید تا راهنمایی متناسب ارائه شود.</p>
        </div>
        <Link to="/contact" className="company-button company-button--primary">
          تماس و هماهنگی <ArrowLeft size={18} />
        </Link>
      </section>
    </main>
  );
}
export function KnowledgeCard({
  article: a,
}: {
  article: (typeof ARTICLES)[number];
}) {
  return (
    <Link to={`/knowledge/${a.slug}`} className="sp-knowledge-card">
      <div className="sp-knowledge-card-media">
        <img src={a.image} alt={a.title} loading="lazy" />
      </div>
      <div className="sp-knowledge-card-body">
        <div className="sp-knowledge-card-meta">
          <span>{a.category}</span>
          <span>·</span>
          <span>{a.minutes} دقیقه مطالعه</span>
        </div>
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
      slug: "maintenance",
      title: "پیش از سفارش قطعه جایگزین چه چیزهایی را بررسی کنیم؟",
      date: "۱۴۰۳/۰۲/۱۸",
      image: A.companyPages.articleMaintenance,
    },
    {
      slug: "custom-part",
      title: "چک‌لیست درخواست ساخت قطعه صنعتی",
      date: "۱۴۰۳/۰۲/۲۰",
      image: A.companyPages.articleCustomPart,
    },
    {
      slug: "part-photo",
      title: "چطور از قطعه عکس بگیریم تا بهتر شناسایی شود؟",
      date: "۱۴۰۳/۰۲/۲۴",
      image: A.companyPages.articlePartPhoto,
    },
    {
      slug: "identify-belt",
      title: "برای شناسایی تسمه چه اطلاعاتی لازم است؟",
      date: "۱۴۰۳/۰۲/۲۵",
      image: A.companyPages.articleIdentifyBelt,
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
  const { pathname } = useLocation();
  const navItems = [
    { to: "/about", text: "آشنایی با صنعت پیش", Icon: Building2 },
    { to: "/services", text: "توانمندی‌ها و خدمات", Icon: Wrench },
    { to: "/industries", text: "صنایع تحت پوشش", Icon: Factory },
    { to: "/brands", text: "برندها و محصولات", Icon: Tag },
    { to: "/knowledge", text: "دانشنامه کاربردی", Icon: BookOpen },
    { to: "/contact", text: "تماس و هماهنگی مراجعه", Icon: Phone },
  ];

  return (
    <div className="about-navigation" dir="rtl">
      <div>
        <span className="store-eyebrow">با صنعت پیش، هوشمندانه پیش بروید</span>
        <h3>تجربه صنعتی، مسیر خرید هوشمند</h3>
        <p>از تأمین و ساخت قطعه تا انتخاب آگاهانه و پیگیری سفارش.</p>
        <div className="about-navigation-links">
          {navItems.map(({ to, text, Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={onNavigate}
              className={pathname === to ? "is-current" : undefined}
            >
              <span className="about-navigation-link-label">
                <Icon size={15} />
                <span>{text}</span>
              </span>
              <ArrowUpLeft size={15} />
            </Link>
          ))}
        </div>
      </div>
      <MapCard compact />
    </div>
  );
}

const ABOUT_BRANCHES = [
  {
    id: "yazd" as const,
    tab: "فروشگاه و دفتر مرکزی یزد",
    title: "صنعت پیش (بازرگانی اطلس) — شعبه مرکزی یزد",
    address: "یزد، بلوار جمهوری، بعد از بیمارستان افشار، جنب بانک سپه، بازرگانی اطلس",
    phone: "۰۳۵-۳۵۲۵۴۷۰۳",
    phoneRaw: "03535254703",
    hours: "شنبه تا پنجشنبه ۸:۰۰ تا ۲۰:۰۰",
    bbox: "54.3318%2C31.9164%2C54.3518%2C31.9304",
    lat: 31.9234,
    lng: 54.3418,
  },
  {
    id: "meybod" as const,
    tab: "مجتمع لجستیک و انبار میبد",
    title: "انبار مرکزی و کارگاه ساخت قطعات میبد",
    address: "استان یزد، میبد، کیلومتر ۳ جاده سنتو، روبروی شهرک صنعتی جهان‌آباد",
    phone: "۰۹۹۰۳۴۲۷۰۲۷",
    phoneRaw: "09903427027",
    hours: "پشتیبانی خطوط تولید و سفارشات فوری",
    bbox: "54.0050%2C32.2150%2C54.0320%2C32.2360",
    lat: 32.2256,
    lng: 54.0185,
  },
  {
    id: "tehran" as const,
    tab: "دفتر بازرگانی تهران",
    title: "دفتر بازرگانی و فروش سازمانی تهران",
    address: "تهران، خیابان سعدی جنوبی، روبروی بانک تجارت، پاساژ صدوقی، طبقه ۲، واحد ۲۴",
    phone: "۰۲۱-۳۳۹۲۸۴۵۰",
    phoneRaw: "02133928450",
    hours: "شنبه تا چهارشنبه ۸:۳۰ تا ۱۷:۳۰ | پنجشنبه ۸:۳۰ تا ۱۳:۳۰",
    bbox: "51.4150%2C35.6790%2C51.4310%2C35.6910",
    lat: 35.6852,
    lng: 51.4231,
  },
];

export function AboutPage() {
  useEffect(() => title("درباره صنعت پیش"), []);

  const [catalogStats, setCatalogStats] = useState({
    ready: databaseStorageEnabled(),
    brands: 0,
    categories: 0,
    families: 0,
    industries: INDUSTRIES.length,
  });
  const [featuredBrands, setFeaturedBrands] = useState<Brand[]>(() =>
    getManagedBrands().filter((brand) => brand.active !== false).slice(0, 6),
  );
  const [selectedBranchId, setSelectedBranchId] = useState<"yazd" | "meybod" | "tehran">("yazd");
  const [mapActive, setMapActive] = useState(false);
  const [copiedBranchAddress, setCopiedBranchAddress] = useState(false);

  useEffect(() => {
    const refreshStats = () => {
      if (!databaseStorageEnabled()) {
        setCatalogStats({
          ready: false,
          brands: 0,
          categories: 0,
          families: 0,
          industries: INDUSTRIES.length,
        });
        setFeaturedBrands([]);
        return;
      }

      const activeBrands = getManagedBrands().filter((brand) => brand.active !== false);
      const activeFamilies = getAllProducts().filter((product) => product.active !== false);
      setFeaturedBrands(activeBrands.slice(0, 6));
      setCatalogStats({
        ready: true,
        brands: activeBrands.length,
        categories: getManagedCategories().filter((category) => category.active !== false).length,
        families: activeFamilies.length,
        industries: INDUSTRIES.length,
      });
    };

    refreshStats();
    const unsubscribeCatalog = subscribeCatalogChanges(refreshStats);
    const events = [
      "sanat-durable-hydrated",
      "atlas-brands-updated",
      "atlas-categories-updated",
      "atlas-catalog-updated",
    ];
    events.forEach((eventName) => window.addEventListener(eventName, refreshStats));

    return () => {
      unsubscribeCatalog();
      events.forEach((eventName) => window.removeEventListener(eventName, refreshStats));
    };
  }, []);

  const formatCount = (value: number) => new Intl.NumberFormat("fa-IR").format(value);
  const activeBranch =
    ABOUT_BRANCHES.find((branch) => branch.id === selectedBranchId) || ABOUT_BRANCHES[0];

  const handleCopyBranchAddress = () => {
    navigator.clipboard.writeText(activeBranch.address);
    setCopiedBranchAddress(true);
    window.setTimeout(() => setCopiedBranchAddress(false), 2400);
  };

  const pathways = [
    {
      to: "/services",
      title: "خدمات و توانمندی‌ها",
      text: "از تأمین قطعات و مشاوره فنی تا شناسایی تصویری و مهندسی معکوس.",
      image: A.companyPages.servicesHero,
      Icon: Wrench,
      action: "مشاهده خدمات",
    },
    {
      to: "/industries",
      title: "صنایع تحت پوشش",
      text: "مسیرهای تخصصی برای شناخت نیاز خطوط تولید در صنایع مختلف.",
      image: A.companyPages.industriesHero,
      Icon: Factory,
      action: "انتخاب صنعت",
    },
    {
      to: "/brands",
      title: "برندهای صنعتی",
      text: "آشنایی با برندهای ثبت‌شده و دسترسی به محصولات مرتبط.",
      image: A.companyPages.brandsHero,
      Icon: Tag,
      action: "مشاهده برندها",
    },
    {
      to: "/knowledge",
      title: "دانشنامه تخصصی",
      text: "راهنماها و محتوای فنی برای شناخت و انتخاب آگاهانه قطعات.",
      image: A.companyPages.knowledgeHero,
      Icon: BookOpen,
      action: "مطالعه دانشنامه",
    },
    {
      to: "/contact",
      title: "ارتباط با کارشناسان",
      text: "برای پیگیری نیازهای صنعتی و هماهنگی مشاوره با ما در ارتباط باشید.",
      image: A.companyPages.contactShowroom,
      Icon: Headphones,
      action: "تماس با ما",
    },
  ];

  const capabilities = [
    {
      title: "تأمین قطعات",
      text: "دسترسی به قطعات و تجهیزات موردنیاز خطوط تولید در یک بازار تخصصی.",
      image: A.whySanatExpressDelivery,
      Icon: Package,
    },
    {
      title: "مشاوره تخصصی",
      text: "راهنمایی برای بررسی مشخصات و انتخاب متناسب با کاربرد قطعه.",
      image: A.companyPages.servicesEngineeringConsult,
      Icon: Headphones,
    },
    {
      title: "شناسایی هوشمند قطعه",
      text: "کمک به یافتن قطعات مشابه از طریق تصویر و اطلاعات فنی.",
      image: A.aiSearchMobile,
      Icon: ScanLine,
    },
    {
      title: "پشتیبانی صنایع",
      text: "همراهی در تأمین نیاز خطوط تولید، پاسخگویی سریع و پیگیری مسیر سفارش.",
      image: A.companyPages.industriesHero,
      Icon: Factory,
    },
  ];

  const milestones = [
    { year: "۱۳۸۴", title: "آغاز فعالیت بازرگانی تسمه اطلس", text: "شناخت بازار و تأمین نیازهای واقعی قطعات صنعتی" },
    { year: "۱۳۹۰", title: "گسترش سبد محصولات", text: "توسعه پوشش محصولات و همراهی با صنایع بیشتر" },
    { year: "۱۴۰۱", title: "توسعه زیرساخت‌های دیجیتال", text: "آماده‌سازی بستر آنلاین برای جستجو و پیگیری تأمین" },
    { year: "امروز", title: "صنعت پیش", text: "بازار آنلاین تخصصی قطعات صنعتی؛ پیش به صنعت" },
  ];

  const highlights = [
    {
      title: "برندهای صنعتی",
      value: catalogStats.ready ? `${formatCount(catalogStats.brands)} برند` : "—",
      text: catalogStats.ready ? "برندهای فعال ثبت‌شده در سامانه" : "پس از دریافت داده‌های معتبر سامانه",
      Icon: Tag,
    },
    {
      title: "دسته‌بندی تخصصی",
      value: catalogStats.ready ? `${formatCount(catalogStats.categories)} دسته` : "—",
      text: catalogStats.ready ? "دسته‌بندی‌های فعال کاتالوگ" : "پس از دریافت داده‌های معتبر سامانه",
      Icon: Layers,
    },
    {
      title: "خانواده قطعات",
      value: catalogStats.ready ? `${formatCount(catalogStats.families)} خانواده` : "—",
      text: catalogStats.ready ? "خانواده‌های فعال ثبت‌شده در کاتالوگ" : "پس از دریافت داده‌های معتبر سامانه",
      Icon: Boxes,
    },
    {
      title: "صنایع تحت پوشش",
      value: `${formatCount(catalogStats.industries)} صنعت`,
      text: "مسیرهای تخصصی معرفی‌شده در صنعت پیش",
      Icon: Factory,
    },
  ];

  return (
    <main className="company-page company-page--about sp-about-approved" dir="rtl" data-testid="approved-about-page">
      <section className="sp-about-hero" aria-labelledby="sp-about-title">
        <div className="sp-about-hero-copy">
          <div className="sp-about-breadcrumb">
            <Link to="/">صفحه اصلی</Link>
            <ChevronLeft size={13} aria-hidden="true" />
            <span>درباره ما</span>
          </div>
          <span className="sp-about-eyebrow">درباره صنعت پیش</span>
          <h1 id="sp-about-title">
            بازار تخصصی
            <br />
            قطعات صنعتی
            <em>با پشتوانه اطلس</em>
          </h1>
          <p>
            صنعت پیش، یک بازار آنلاین جامع برای تأمین، جستجو و خرید انواع قطعات و
            تجهیزات صنعتی است؛ با تکیه بر تجربه و اعتبار بازرگانی تسمه اطلس از سال ۱۳۶۶.
          </p>
          <div className="sp-about-hero-actions">
            <Link to="/products" className="sp-about-btn sp-about-btn--primary">
              <ShoppingCart size={17} />
              ورود به بازار قطعات
            </Link>
            <Link to="/services" className="sp-about-btn sp-about-btn--outline">
              توانمندی‌ها و خدمات
              <ArrowLeft size={17} />
            </Link>
          </div>
          <div className="sp-about-hero-note">
            <span>یک مسیر تخصصی برای نیازهای صنعت</span>
            <strong>قطعات · برندها · مشخصات فنی · مشاوره · استعلام و خرید</strong>
          </div>
        </div>
        <div className="sp-about-hero-visual">
          <img
            src={A.companyPages.aboutHero}
            alt="چرخ‌دنده‌های دقیق صنعتی، تسمه تایمینگ و کوپلینگ‌های برنزی در کارگاه مهندسی صنعت پیش"
            fetchPriority="high"
          />
          <div className="sp-about-hero-image-shade" />
          <div className="sp-about-hero-image-label">
            <span>INDUSTRIAL PARTS MARKETPLACE</span>
            <strong>تخصص در قطعات، تمرکز بر صنعت</strong>
          </div>
          <div className="sp-about-hero-image-index">SANAT PISH / 01</div>
        </div>
        <div className="sp-about-hero-slash" aria-hidden="true" />
      </section>

      <section className="sp-about-story" id="sp-about-story">
        <div className="sp-about-story-visual">
          <img
            src={A.companyPages.aboutWarehouse}
            alt="مرکز لجستیک، قفسه‌بندی صنعتی و دپوی قطعات بازرگانی تسمه اطلس"
            loading="lazy"
          />
          <div className="sp-about-story-image-frame" aria-hidden="true" />
          <div className="sp-about-atlas-mark">
            <img src={A.atlasLogo} alt="نشان بازرگانی تسمه اطلس" />
            <span>پشتوانه تجربه صنعتی از ۱۳۶۶</span>
          </div>
          <div className="sp-about-story-image-caption">
            <span>داستان ما</span>
            <strong>تجربه اطلس؛ افق تازه صنعت پیش</strong>
          </div>
        </div>
        <div className="sp-about-story-copy">
          <span className="sp-about-eyebrow sp-about-eyebrow--light">داستان ما</span>
          <h2>با پشتوانه بازرگانی تسمه <em>اطلس</em></h2>
          <p>
            صنعت پیش با پشتوانه بازرگانی تسمه اطلس و تجربه این مجموعه شکل گرفته است؛
            مجموعه‌ای که شناخت بازار قطعات صنعتی و نیاز کسب‌وکارها را به یک
            بستر آنلاین تخصصی پیوند می‌دهد.
          </p>
          <p>
            هدف ما گردآوری قطعات و برندهای صنعتی در یک بازار تخصصی است؛ جایی که
            فعالان صنعت بتوانند قطعه موردنیاز خود را با نام، برند یا کد فنی
            جستجو کنند، مشخصات را بررسی کنند و مسیر استعلام و خرید را ساده‌تر
            پیش ببرند.
          </p>
          <div className="sp-about-proof-grid">
            <div>
              <ShieldCheck size={24} />
              <strong>تجربه و اعتبار اطلس</strong>
              <span>پشتوانه‌ای برای فعالیت در بازار قطعات صنعتی</span>
            </div>
            <div>
              <Layers size={24} />
              <strong>تبدیل تجربه به پلتفرم</strong>
              <span>یک بازار آنلاین تخصصی و قابل توسعه</span>
            </div>
            <div>
              <Users size={24} />
              <strong>تمرکز بر نیاز صنعت</strong>
              <span>پاسخ به نیاز واقعی کارخانه‌ها و کسب‌وکارها</span>
            </div>
          </div>
        </div>
        <div className="sp-about-timeline" aria-label="مسیر شکل‌گیری صنعت پیش">
          {milestones.map((item, index) => (
            <div className="sp-about-timeline-item" key={item.year}>
              <span className="sp-about-timeline-node">{String(index + 1).padStart(2, "0")}</span>
              <span className="sp-about-timeline-year">{item.year}</span>
              <strong>{item.title}</strong>
              <small>{item.text}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="sp-about-capabilities" id="about-capabilities">
        <img className="sp-about-capabilities-bg" src={A.refineryDuskWide} alt="" loading="lazy" />
        <div className="sp-about-capabilities-overlay" />
        <div className="sp-about-section-inner">
          <div className="sp-about-centered-heading">
            <span className="sp-about-eyebrow">توانمندی‌ها و خدمات ما</span>
            <h2>آنچه <em>صنعت پیش</em> را متمایز می‌کند</h2>
            <p>از پیدا کردن قطعه تا انتخاب، مشاوره مهندسی، شناسایی هوشمند و پیگیری مسیر تأمین</p>
          </div>
          <div className="sp-about-capability-grid">
            {capabilities.map(({ title: itemTitle, text, image, Icon }, index) => (
              <article className="sp-about-capability" key={itemTitle}>
                <img src={image} alt={itemTitle} loading="lazy" />
                <div className="sp-about-capability-shade" />
                <span className="sp-about-capability-icon"><Icon size={24} strokeWidth={1.8} /></span>
                <div className="sp-about-capability-copy">
                  <h3>{itemTitle}</h3>
                  <p>{text}</p>
                </div>
                <span className="sp-about-capability-index">۰{index + 1}</span>
              </article>
            ))}
          </div>

          <div className="sp-about-services-strip">
            <div className="sp-about-services-strip-copy">
              <strong>مسیر جامع توانمندی‌ها و خدمات فنی صنعت پیش</strong>
              <p>
                از جستجوی کد فنی و مشاوره FORZA تا بررسی ساخت و مهندسی معکوس قطعات سفارشی و صدور پیش‌فاکتور رسمی.
              </p>
              <div className="sp-about-services-chips">
                <span><Boxes size={13} /> تأمین خطوط تولید</span>
                <span><ScanLine size={13} /> شناسایی تصویری FORZA</span>
                <span><Wrench size={13} /> مهندسی معکوس و ساخت</span>
                <span><Clock size={13} /> پیگیری سفارش و استعلام</span>
              </div>
            </div>
            <Link to="/services" className="sp-about-btn sp-about-btn--primary">
              مشاهده صفحه توانمندی‌ها و خدمات
              <ArrowLeft size={16} />
            </Link>
          </div>
        </div>
      </section>

      <section className="sp-about-highlights">
        <div className="sp-about-section-inner">
          <div className="sp-about-highlights-heading">
            <span className="sp-about-eyebrow sp-about-eyebrow--light">شناخت ظرفیت‌های مجموعه</span>
            <h2>صنعت پیش در یک نگاه</h2>
          </div>
          <div className="sp-about-highlights-grid" aria-live="polite">
            {highlights.map(({ title: itemTitle, value, text, Icon }) => (
              <div className="sp-about-highlight" key={itemTitle}>
                <Icon size={27} strokeWidth={1.8} />
                <strong>{itemTitle}</strong>
                <b>{value}</b>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sp-about-ecosystem" aria-label="برندها و صنایع مرتبط در صنعت پیش">
        <div className="sp-about-section-inner">
          <div className="sp-about-ecosystem-block">
            <div className="sp-about-eco-head">
              <div>
                <span className="sp-about-eyebrow sp-about-eyebrow--light">برندها و محصولات</span>
                <h2>برندهای فعال در کاتالوگ صنعت پیش</h2>
                <p>
                  برای بررسی محصولات و کدهای فنی هر برند، روی برند موردنظر کلیک کنید یا وارد فهرست کامل برندها شوید.
                </p>
              </div>
              <Link to="/brands" className="sp-about-eco-link">
                مشاهده همه برندها و محصولات
                <ArrowLeft size={15} />
              </Link>
            </div>

            {featuredBrands.length > 0 ? (
              <div className="sp-about-brands-row">
                {featuredBrands.map((brand) => {
                  const logo =
                    brand.id === "forza"
                      ? A.logoForza
                      : brand.id === "swr"
                        ? A.swrLogo
                        : brand.image || brand.logo;
                  return (
                    <Link
                      key={brand.id}
                      to={`/products?q=${encodeURIComponent(brand.nameEn || brand.name)}`}
                      className="sp-about-brand-tile"
                    >
                      <div className="sp-about-brand-logo">
                        {logo ? (
                          <img src={logo} alt={brand.nameEn || brand.name} loading="lazy" />
                        ) : (
                          <span>{(brand.nameEn || brand.name).slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="sp-about-brand-meta">
                        <strong>{brand.name}</strong>
                        <small>{brand.country || "برند صنعتی"}</small>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="company-empty-state" role="status">
                <strong>برندهای فعال پس از دریافت اطلاعات کاتالوگ نمایش داده می‌شوند.</strong>
                <p>می‌توانید مستقیماً وارد صفحه برندها و محصولات شوید.</p>
              </div>
            )}
          </div>

          <div className="sp-about-ecosystem-block">
            <div className="sp-about-eco-head">
              <div>
                <span className="sp-about-eyebrow sp-about-eyebrow--light">صنایع تحت پوشش</span>
                <h2>مسیرهای تخصصی برای خطوط تولید کشور</h2>
                <p>
                  نیاز هر صنعت با توجه به دما، سرعت، بار خط و نوع قطعه متفاوت است؛ صنعت موردنظر خود را انتخاب کنید.
                </p>
              </div>
              <Link to="/industries" className="sp-about-eco-link">
                مشاهده همه صنایع
                <ArrowLeft size={15} />
              </Link>
            </div>

            <div className="sp-about-industries-row">
              {INDUSTRIES.map((industry) => (
                <Link
                  key={industry.slug}
                  to={`/industries/${industry.slug}`}
                  className="sp-about-industry-card"
                >
                  <img src={industry.image} alt={industry.title} loading="lazy" />
                  <div className="sp-about-industry-shade" />
                  <div>
                    <div>
                      <span>{industry.eyebrow}</span>
                      <strong>{industry.title}</strong>
                    </div>
                    <ArrowUpLeft size={18} />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="sp-about-destinations">
        <div className="sp-about-section-inner">
          <div className="sp-about-destinations-heading">
            <div>
              <span className="sp-about-eyebrow sp-about-eyebrow--light">مسیرهای بیشتر در صنعت پیش</span>
              <h2>بخش‌های مرتبط را مستقیم باز کنید</h2>
            </div>
            <p>تمامی بخش‌های تخصصی توانمندی‌ها، صنایع، برندها، دانشنامه و تماس در دسترس شماست.</p>
          </div>
          <div className="sp-about-destination-grid">
            {pathways.map(({ to, title: itemTitle, text, image, Icon, action }) => (
              <Link to={to} className="sp-about-destination" key={to}>
                <img src={image} alt="" loading="lazy" />
                <span className="sp-about-destination-shade" />
                <span className="sp-about-destination-icon"><Icon size={21} /></span>
                <span className="sp-about-destination-copy">
                  <strong>{itemTitle}</strong>
                  <small>{text}</small>
                  <b>{action}<ArrowUpLeft size={16} /></b>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="sp-about-contact-hub" aria-labelledby="sp-about-contact-title">
        <div className="sp-about-section-inner">
          <div className="sp-about-contact-grid">
            <div className="sp-about-contact-info">
              <div>
                <span className="sp-about-eyebrow sp-about-eyebrow--light">ارتباط مستقیم و هماهنگی مراجعه</span>
                <h2 id="sp-about-contact-title">تماس با شعب و هماهنگی بازدید یا تحویل نمونه</h2>
                <p>
                  پیش از مراجعه حضوری به فروشگاه مرکزی یزد، انبار و کارگاه میبد یا دفتر بازرگانی تهران،
                  ساعت حضور و نشانی شعبه را بررسی و هماهنگ کنید.
                </p>
              </div>

              <div className="sp-about-branch-tabs" role="group" aria-label="انتخاب شعبه صنعت پیش">
                {ABOUT_BRANCHES.map((branch) => (
                  <button
                    key={branch.id}
                    type="button"
                    aria-pressed={activeBranch.id === branch.id}
                    onClick={() => {
                      setSelectedBranchId(branch.id);
                      setCopiedBranchAddress(false);
                    }}
                  >
                    {branch.tab}
                  </button>
                ))}
              </div>

              <div className="sp-about-branch-card">
                <strong>{activeBranch.title}</strong>
                <div className="sp-about-branch-row">
                  <MapPin size={16} />
                  <span>{activeBranch.address}</span>
                </div>
                <div className="sp-about-branch-row">
                  <Phone size={16} />
                  <a href={`tel:${activeBranch.phoneRaw}`} dir="ltr" className="font-mono font-bold text-[#16232f] hover:text-[#e06518]">
                    {activeBranch.phone}
                  </a>
                </div>
                <div className="sp-about-branch-row">
                  <Clock size={16} />
                  <span>{activeBranch.hours}</span>
                </div>
              </div>

              <div className="sp-about-contact-actions">
                <Link to="/contact" className="sp-about-btn sp-about-btn--primary">
                  ثبت پیام و هماهنگی مراجعه <ArrowLeft size={16} />
                </Link>
                <button
                  type="button"
                  onClick={handleCopyBranchAddress}
                  className="sp-about-contact-copy-btn"
                >
                  {copiedBranchAddress ? (
                    <>
                      <Check size={15} />
                      نشانی کپی شد
                    </>
                  ) : (
                    <>
                      <Copy size={15} />
                      کپی نشانی شعبه
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="sp-about-map-box">
              {mapActive ? (
                <iframe
                  key={activeBranch.id}
                  title={`نقشه ${activeBranch.title}`}
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${activeBranch.bbox}&layer=mapnik&marker=${activeBranch.lat}%2C${activeBranch.lng}`}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <>
                  <img
                    src={A.companyPages.yazdRegionMap}
                    alt="نقشه منطقه‌ای یزد و میبد از OpenStreetMap"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => setMapActive(true)}
                    className="location-map-activate"
                  >
                    فعال کردن نقشه تعاملی <Compass size={15} />
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
          </div>
        </div>
      </section>

      <section className="sp-about-cta">
        <img src={A.ctaConsultBanner} alt="" loading="lazy" />
        <div className="sp-about-cta-shade" />
        <div className="sp-about-cta-copy">
          <span className="sp-about-eyebrow">همراه مطمئن نیازهای صنعتی</span>
          <h2>همین امروز، نیاز صنعتی خود را در <em>صنعت پیش</em> تأمین کنید</h2>
          <p>دسترسی به برندها و قطعات صنعتی، اطلاعات فنی و پشتیبانی تخصصی در یک مسیر آنلاین.</p>
          <div className="sp-about-hero-actions">
            <Link to="/products" className="sp-about-btn sp-about-btn--primary">
              <ShoppingCart size={17} />
              ورود به بازار قطعات
            </Link>
            <Link to="/contact" className="sp-about-btn sp-about-btn--outline">
              <Headphones size={17} />
              دریافت مشاوره
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
