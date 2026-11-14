import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpLeft,
  Boxes,
  Check,
  ChevronLeft,
  FileSearch,
  Gauge,
  Headphones,
  Layers,
  MapPin,
  PackageSearch,
  Phone,
  ScanLine,
  Search,
  ShieldCheck,
  Sparkles,
  Wrench,
} from "lucide-react";
import { STORE_ASSETS as A } from "../assets/images";
import { INDUSTRIES, ARTICLES } from "../data/siteContent";
import { INDUSTRY_PAGE_DETAILS, type IndustryPageSlug } from "../data/industryPageDetails";
import { getAllProducts, subscribeCatalogChanges } from "../data/mockGenerator";
import { isDatabaseCatalogHydrated } from "../services/durableStorage";
import { rankIndustryProducts } from "../utils/industryCatalog";
import { ProductCard } from "../components/product/ProductCard";
import { PartIdentificationLink } from "../components/search/PartIdentificationProvider";
import { CustomPartRequestModal } from "../components/home/CustomPartRequestModal";
import "./industry-template.css";

const INTENTS = [
  { id: "supply", title: "تأمین قطعه یدکی", description: "کد یا نام قطعه را دارید و می‌خواهید کالاهای واقعی کاتالوگ را بررسی کنید.", action: "مشاهده قطعات مرتبط", icon: PackageSearch },
  { id: "identify", title: "شناسایی قطعه", description: "کد فنی مشخص نیست؛ از تصویر، نوشته روی قطعه و ابعاد برای شروع بررسی استفاده کنید.", action: "شروع شناسایی تصویری", icon: ScanLine },
  { id: "replacement", title: "انتخاب جایگزین", description: "برای تطبیق ابعاد، جنس، بار و شرایط کاری قطعه فعلی راهنمایی می‌خواهید.", action: "گفت‌وگو با FORZA", icon: Layers },
  { id: "custom", title: "ساخت قطعه کمیاب", description: "نمونه، نقشه یا مشخصات قطعه را برای بررسی امکان ساخت و مهندسی معکوس ارسال کنید.", action: "ثبت درخواست بررسی ساخت", icon: Wrench },
  { id: "maintenance", title: "مشکل خط تولید", description: "علائم خرابی یا شرایط غیرعادی دستگاه را برای بررسی اولیه توضیح دهید.", action: "شرح مشکل برای FORZA", icon: Gauge },
] as const;

const ARTICLE_SLUGS: Record<IndustryPageSlug, string[]> = {
  ceramic: ["maintenance", "part-photo", "custom-part"],
  textile: ["identify-belt", "part-photo", "maintenance"],
  packaging: ["maintenance", "custom-part", "identify-belt"],
  food: ["maintenance", "part-photo", "custom-part"],
  machinery: ["custom-part", "maintenance", "part-photo"],
  rubber: ["custom-part", "maintenance", "part-photo"],
};

const normalizeSlug = (raw: string | undefined): IndustryPageSlug | null => {
  if (!raw) return null;
  const aliases: Record<string, IndustryPageSlug> = {
    "tile-ceramic": "ceramic",
    "ceramic-tiles": "ceramic",
    "ceramic-tile": "ceramic",
  };
  const slug = aliases[raw] || raw;
  return ["ceramic", "textile", "packaging", "food", "machinery", "rubber"].includes(slug)
    ? slug as IndustryPageSlug
    : null;
};

const catalogSearchUrl = (query: string) => "/products?q=" + encodeURIComponent(query.trim());
const consultUrl = (slug: IndustryPageSlug, query: string) =>
  "/ai-consult?industry=" + slug + "&q=" + encodeURIComponent(query.trim());
const scrollTo = (id: string) => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
};

export function IndustryTemplatePage() {
  const { slug: rawSlug } = useParams();
  const navigate = useNavigate();
  const slug = normalizeSlug(rawSlug);
  const industry = INDUSTRIES.find(item => item.slug === slug);
  const detail = slug ? INDUSTRY_PAGE_DETAILS[slug] : null;

  const [catalogVersion, setCatalogVersion] = useState(0);
  const [catalogReady, setCatalogReady] = useState(() => isDatabaseCatalogHydrated());
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [selectedIntentId, setSelectedIntentId] = useState<(typeof INTENTS)[number]["id"]>("supply");
  const [technicalQuery, setTechnicalQuery] = useState("");
  const [problemQuery, setProblemQuery] = useState("");
  const [equipment, setEquipment] = useState("");
  const [condition, setCondition] = useState("");
  const [operatingNote, setOperatingNote] = useState("");
  const [showRecommendations, setShowRecommendations] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  useEffect(() => {
    const refreshCatalog = () => {
      setCatalogReady(isDatabaseCatalogHydrated());
      setCatalogVersion(version => version + 1);
    };
    refreshCatalog();
    const unsubscribe = subscribeCatalogChanges(refreshCatalog);
    const eventNames = ["sanat-durable-hydrated", "atlas-catalog-updated", "atlas-categories-updated"];
    eventNames.forEach(name => window.addEventListener(name, refreshCatalog));
    return () => {
      unsubscribe();
      eventNames.forEach(name => window.removeEventListener(name, refreshCatalog));
    };
  }, []);

  useEffect(() => {
    if (!slug || !industry || !detail) return;
    const previousTitle = document.title;
    const title = detail.headline + " | صنعت پیش";
    const description = detail.introduction.slice(0, 155);
    document.title = title;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const createdMeta = !meta;
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    const previousDescription = meta.content;
    meta.content = description;

    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    const createdCanonical = !canonical;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    const previousCanonical = canonical.href;
    canonical.href = window.location.origin + "/industries/" + slug;

    return () => {
      document.title = previousTitle;
      if (meta) {
        if (createdMeta) meta.remove();
        else meta.content = previousDescription;
      }
      if (canonical) {
        if (createdCanonical) canonical.remove();
        else canonical.href = previousCanonical;
      }
    };
  }, [slug, industry, detail]);

  useEffect(() => {
    setActiveStageIndex(0);
    setSelectedIntentId("supply");
    setShowRecommendations(false);
    setTechnicalQuery("");
    setProblemQuery("");
    setEquipment("");
    setCondition("");
    setOperatingNote("");
  }, [slug]);

  const products = useMemo(() => catalogReady ? getAllProducts() : [], [catalogReady, catalogVersion]);
  const stages = detail?.stages || [];
  const activeStage = stages[Math.min(activeStageIndex, Math.max(0, stages.length - 1))];

  const industryProducts = useMemo(
    () => industry ? rankIndustryProducts(products, industry, 6) : [],
    [products, industry],
  );
  const stageProducts = useMemo(
    () => industry && activeStage
      ? rankIndustryProducts(products, { ...industry, terms: [...industry.terms, activeStage.title, activeStage.subtitle] }, 3)
      : [],
    [products, industry, activeStage],
  );
  const recommendationProducts = useMemo(() => {
    if (!showRecommendations || !industry || !activeStage) return [];
    const terms = [
      ...industry.terms,
      activeStage.title,
      activeStage.subtitle,
      equipment,
      condition,
      operatingNote,
    ].filter(Boolean);
    return rankIndustryProducts(products, { ...industry, terms }, 4);
  }, [showRecommendations, products, industry, activeStage, equipment, condition, operatingNote]);

  if (!slug || !industry || !detail) return <Navigate to="/industries" replace />;
  if (rawSlug !== slug) return <Navigate to={"/industries/" + slug} replace />;

  const selectedIntent = INTENTS.find(item => item.id === selectedIntentId) || INTENTS[0];
  const relatedArticles = ARTICLES.filter(article => ARTICLE_SLUGS[slug].includes(article.slug));
  const industryContext = "صنعت: " + industry.title + "؛ مرحله خط: " + (activeStage?.title || "نامشخص");

  const runSelectedIntent = () => {
    if (selectedIntentId === "supply") {
      scrollTo("ipt-catalog");
      return;
    }
    if (selectedIntentId === "identify") {
      navigate("/identify-part?industry=" + slug);
      return;
    }
    if (selectedIntentId === "custom") {
      setRequestOpen(true);
      return;
    }
    const topic = selectedIntentId === "replacement"
      ? "برای انتخاب جایگزین قطعه در " + industry.title + " راهنمایی می‌خواهم. " + industryContext + " لطفاً ابعاد، جنس، بار و شرایط کاری لازم را مرحله‌به‌مرحله بررسی کنید."
      : "در خط " + industry.title + " با این مسئله روبه‌رو هستم. " + industryContext + " لطفاً برای بررسی اولیه اطلاعات لازم را از من بپرسید.";
    navigate(consultUrl(slug, topic));
  };

  const handleTechnicalSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!technicalQuery.trim()) return;
    navigate(catalogSearchUrl(technicalQuery));
  };

  const handleProblemSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!problemQuery.trim()) return;
    navigate(consultUrl(slug, industryContext + "؛ شرح مسئله: " + problemQuery.trim()));
  };

  const handleRecommendation = (event: React.FormEvent) => {
    event.preventDefault();
    setShowRecommendations(true);
  };

  const recommendationContext = [
    industryContext,
    equipment && "تجهیز: " + equipment,
    condition && "شرایط کاری: " + condition,
    operatingNote && "توضیح تکمیلی: " + operatingNote,
  ].filter(Boolean).join("؛ ");

  return (
    <div className={"industry-template industry-template--" + slug} dir="rtl">
      <section className="ipt-hero" aria-labelledby="ipt-title">
        <div className="ipt-hero-visual">
          <img src={industry.image} alt={"خط تولید " + industry.title} fetchPriority="high" decoding="async" />
          <div className="ipt-hero-visual-shade" />
          <div className="ipt-hero-caption"><span>{detail.heroCaption}</span><strong>شناخت کاربرد، سپس انتخاب قطعه</strong></div>
          <span className="ipt-hero-index">SANAT PISH / INDUSTRY</span>
        </div>
        <div className="ipt-hero-copy">
          <nav className="ipt-breadcrumb" aria-label="مسیر صفحه">
            <Link to="/">صنعت پیش</Link><ChevronLeft size={13} /><Link to="/industries">صنایع</Link><ChevronLeft size={13} /><span>{industry.title}</span>
          </nav>
          <span className="ipt-eyebrow"><span className="ipt-eyebrow-mark" />{industry.eyebrow}</span>
          <h1 id="ipt-title">{detail.headline}</h1>
          <p>{detail.introduction}</p>
          <div className="ipt-hero-tags">
            {industry.parts.slice(0, 4).map(part => <span key={part}>{part}</span>)}
          </div>
          <div className="ipt-hero-actions">
            <a href="#ipt-catalog" className="ipt-button ipt-button--primary" onClick={event => { event.preventDefault(); scrollTo("ipt-catalog"); }}>مشاهده قطعات مرتبط <ArrowLeft size={16} /></a>
            <Link to={consultUrl(slug, "برای صنعت " + industry.title + " مشاوره فنی می‌خواهم.")} className="ipt-button ipt-button--light"><Headphones size={16} /> مشاوره با FORZA</Link>
            <PartIdentificationLink to={"/identify-part?industry=" + slug} className="ipt-button ipt-button--outline"><ScanLine size={16} /> شناسایی با تصویر</PartIdentificationLink>
          </div>
        </div>
      </section>

      <section className="ipt-proof-strip" aria-label="مسیرهای خدمات صنعت پیش">
        <div><span><Boxes size={19} /></span><strong>کاتالوگ متصل به داده واقعی</strong><small>خانواده‌ها و کدهای فعال سایت</small></div>
        <div><span><FileSearch size={19} /></span><strong>جست‌وجو بر اساس کاربرد</strong><small>از صنعت و ایستگاه تولید شروع کنید</small></div>
        <div><span><Headphones size={19} /></span><strong>مسیر مشاوره فنی FORZA</strong><small>انتقال زمینه صنعت به گفت‌وگو</small></div>
        <div><span><ShieldCheck size={19} /></span><strong>تأیید پیش از سفارش</strong><small>بررسی کد و مشخصات فنی قطعه</small></div>
      </section>

      <section className="ipt-section ipt-intent-section">
        <div className="ipt-section-heading">
          <span className="ipt-section-kicker">از نیاز واقعی شروع کنید</span>
          <h2>برای خط تولید شما چه کاری انجام دهیم؟</h2>
          <p>مسیر مناسب را انتخاب کنید تا به کاتالوگ، شناسایی تصویری، مشاوره یا ثبت درخواست ساخت هدایت شوید.</p>
        </div>
        <div className="ipt-intent-grid">
          {INTENTS.map(({ id, title, description, icon: Icon }) => (
            <button type="button" key={id} aria-pressed={selectedIntentId === id} onClick={() => setSelectedIntentId(id)} className="ipt-intent-card">
              <span className="ipt-intent-icon"><Icon size={21} /></span>
              <strong>{title}</strong>
              <p>{description}</p>
              <span className="ipt-intent-arrow"><ArrowUpLeft size={17} /></span>
            </button>
          ))}
        </div>
        <div className="ipt-intent-next" aria-live="polite">
          <div><strong>{selectedIntent.title}</strong><span>{selectedIntent.description}</span></div>
          {selectedIntentId === "identify" ? (
            <PartIdentificationLink to={"/identify-part?industry=" + slug} className="ipt-button ipt-button--primary">{selectedIntent.action}<ArrowLeft size={16} /></PartIdentificationLink>
          ) : (
            <button type="button" className="ipt-button ipt-button--primary" onClick={runSelectedIntent}>{selectedIntent.action}<ArrowLeft size={16} /></button>
          )}
        </div>
      </section>

      <section className="ipt-section ipt-production" id="ipt-production">
        <div className="ipt-section-heading">
          <span className="ipt-section-kicker">مسیر فرایند تولید</span>
          <h2>در هر مرحله از خط، چه قطعاتی اهمیت دارند؟</h2>
          <p>ایستگاه را انتخاب کنید تا ملاحظات فنی و خانواده‌های مرتبط از کاتالوگ فعال نمایش داده شوند.</p>
        </div>
        <div className="ipt-production-shell">
          <div className="ipt-production-visual">
            <img src={industry.image} alt={"نمای خط تولید " + industry.title} loading="lazy" />
            <div className="ipt-production-overlay" />
            <div className="ipt-stage-hotspots" style={{ "--ipt-stage-count": stages.length } as React.CSSProperties}>
              {stages.map((stage, index) => (
                <button type="button" key={stage.title} aria-pressed={activeStageIndex === index} onClick={() => setActiveStageIndex(index)} aria-label={"انتخاب مرحله " + stage.title}>
                  <span>{String(index + 1).padStart(2, "0")}</span><small>{stage.title}</small>
                </button>
              ))}
            </div>
            <div className="ipt-production-caption"><span>مرحله انتخاب‌شده</span><strong>{activeStage?.title}</strong></div>
          </div>
          <div className="ipt-stage-tabs" role="tablist" aria-label="مراحل خط تولید">
            {stages.map((stage, index) => (
              <button type="button" key={stage.title} role="tab" aria-selected={activeStageIndex === index} aria-controls="ipt-stage-panel" onClick={() => setActiveStageIndex(index)}>
                <b>{String(index + 1).padStart(2, "0")}</b><span>{stage.title}<small>{stage.subtitle}</small></span><ChevronLeft size={15} />
              </button>
            ))}
          </div>
          <div className="ipt-stage-panel" id="ipt-stage-panel" role="tabpanel">
            <div className="ipt-stage-copy">
              <span className="ipt-section-kicker">بررسی ایستگاه {String(activeStageIndex + 1).padStart(2, "0")}</span>
              <h3>{activeStage?.title}</h3>
              <p>{activeStage?.description}</p>
              <Link to={catalogSearchUrl(industry.terms.join(" ") + " " + (activeStage?.title || ""))} className="ipt-text-link">جست‌وجوی قطعات این مرحله <ArrowLeft size={15} /></Link>
            </div>
            <div className="ipt-stage-products">
              <div className="ipt-mini-heading"><strong>کالاهای مرتبط در کاتالوگ</strong><span>{stageProducts.length.toLocaleString("fa-IR")} نتیجه</span></div>
              {stageProducts.length ? stageProducts.map(product => (
                <Link key={product.code} to={"/product/" + encodeURIComponent(product.code)} className="ipt-stage-product">
                  <span><PackageSearch size={17} /></span><div><strong>{product.name}</strong><small>{product.categoryName} · {product.subcategory}</small></div><ArrowUpLeft size={16} />
                </Link>
              )) : (
                <div className="ipt-stage-empty" role="status">
                  <strong>{catalogReady ? "کالای تأییدشده‌ای برای این ایستگاه پیدا نشد." : "کاتالوگ در حال همگام‌سازی است."}</strong>
                  <span>برای جلوگیری از نمایش کالای نامرتبط، نتیجه ساختگی ارائه نمی‌شود.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="ipt-section ipt-search-section">
        <div className="ipt-section-heading">
          <span className="ipt-section-kicker">جست‌وجو و تشخیص مسئله</span>
          <h2>از کد قطعه یا نشانه خرابی شروع کنید</h2>
        </div>
        <div className="ipt-search-grid">
          <form className="ipt-search-card" onSubmit={handleTechnicalSearch}>
            <span className="ipt-search-icon"><Search size={20} /></span>
            <div><h3>کد، نام یا مشخصات قطعه</h3><p>نام فارسی، کد فنی یا عبارت درج‌شده روی قطعه را در کاتالوگ جست‌وجو کنید.</p></div>
            <label><span className="sr-only">کد یا نام قطعه</span><input value={technicalQuery} onChange={event => setTechnicalQuery(event.target.value)} placeholder="مثلاً کد فنی یا نام قطعه…" required /></label>
            <button type="submit" className="ipt-button ipt-button--primary">جست‌وجو در کاتالوگ <ArrowLeft size={16} /></button>
          </form>
          <form className="ipt-search-card ipt-search-card--problem" onSubmit={handleProblemSearch}>
            <span className="ipt-search-icon"><Wrench size={20} /></span>
            <div><h3>شرح مشکل خط تولید</h3><p>علائم خرابی، محل نصب یا شرایط غیرعادی را برای بررسی اولیه به FORZA منتقل کنید.</p></div>
            <label><span className="sr-only">شرح مشکل خط تولید</span><input value={problemQuery} onChange={event => setProblemQuery(event.target.value)} placeholder="مثلاً لرزش رولر یا لغزش تسمه…" required /></label>
            <button type="submit" className="ipt-button ipt-button--dark">ارسال برای مشاوره FORZA <ArrowLeft size={16} /></button>
          </form>
        </div>
      </section>

      <section className="ipt-section ipt-recommender" id="ipt-recommender">
        <div className="ipt-recommender-copy">
          <span className="ipt-section-kicker">راهنمای انتخاب اولیه</span>
          <h2>قطعه را با شرایط کاری دستگاه تطبیق دهید</h2>
          <p>ایستگاه، نوع تجهیز و شرایط محیطی را انتخاب کنید. نتایج فقط از خانواده‌های فعال کاتالوگ رتبه‌بندی می‌شوند و جایگزینی نهایی نیازمند تطبیق مشخصات فنی است.</p>
          <div className="ipt-recommender-note"><ShieldCheck size={18} /><span>سرعت، دما، فشار، ابعاد و نوع ماده در تماس را در توضیح تکمیلی بنویسید.</span></div>
        </div>
        <form className="ipt-recommender-form" onSubmit={handleRecommendation}>
          <label>مرحله خط تولید<select value={String(activeStageIndex)} onChange={event => setActiveStageIndex(Number(event.target.value))}>{stages.map((stage, index) => <option key={stage.title} value={String(index)}>{stage.title}</option>)}</select></label>
          <label>نوع تجهیز<select value={equipment} onChange={event => setEquipment(event.target.value)}><option value="">انتخاب نوع تجهیز</option>{detail.equipmentOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
          <label>شرایط غالب کار<select value={condition} onChange={event => setCondition(event.target.value)}><option value="">انتخاب شرایط کاری</option>{detail.conditionOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
          <label className="ipt-recommender-wide">سرعت، دما، فشار یا توضیح تکمیلی<input value={operatingNote} onChange={event => setOperatingNote(event.target.value)} placeholder="شرایط واقعی دستگاه را بنویسید…" /></label>
          <button type="submit" className="ipt-button ipt-button--primary ipt-recommender-wide">نمایش خانواده‌های مرتبط <Sparkles size={16} /></button>
        </form>
        {showRecommendations && (
          <div className="ipt-recommendation-results">
            <div className="ipt-mini-heading"><strong>نتایج اولیه برای بررسی</strong><span>{recommendationProducts.length.toLocaleString("fa-IR")} مورد</span></div>
            {recommendationProducts.length ? (
              <div className="ipt-products-grid">{recommendationProducts.map(product => <ProductCard key={product.code} product={product} />)}</div>
            ) : (
              <div className="ipt-stage-empty" role="status">
                <strong>{catalogReady ? "کالای مرتبطی با این معیارها پیدا نشد." : "کاتالوگ در حال همگام‌سازی است."}</strong>
                <span>می‌توانید جست‌وجوی آزاد انجام دهید یا شرایط را برای مشاوره فنی ارسال کنید.</span>
                <Link to={catalogSearchUrl(industry.terms.join(" ") + " " + equipment)} className="ipt-text-link">جست‌وجو در کل کاتالوگ <ArrowLeft size={15} /></Link>
              </div>
            )}
            <Link to={consultUrl(slug, "درخواست بررسی فنی؛ " + recommendationContext)} className="ipt-button ipt-button--light"><Headphones size={16} /> ارسال شرایط برای FORZA</Link>
          </div>
        )}
      </section>

      <section className="ipt-forza-banner">
        <img src={A.forzaAiRobotHalo} alt="" loading="lazy" />
        <div className="ipt-forza-shade" />
        <div className="ipt-forza-copy">
          <span className="ipt-forza-kicker">FORZA · دستیار هوشمند صنعت پیش</span>
          <h2>وقتی کد قطعه را نمی‌دانید، از مسئله شروع کنید.</h2>
          <p>تصویر قطعه یا توضیح کاربرد و شرایط کار را ارسال کنید تا فرایند شناسایی و مشاوره را آغاز کنید. نتیجه تصویری و پیشنهاد مشابه، راهنمای اولیه است و پیش از سفارش باید تأیید شود.</p>
          <div className="ipt-forza-actions">
            <PartIdentificationLink to={"/identify-part?industry=" + slug} className="ipt-button ipt-button--primary"><ScanLine size={16} /> شناسایی از روی تصویر</PartIdentificationLink>
            <Link to={consultUrl(slug, "برای خط تولید " + industry.title + " مشاوره فنی می‌خواهم.")} className="ipt-button ipt-button--glass">گفت‌وگو با FORZA <ArrowLeft size={16} /></Link>
          </div>
        </div>
      </section>

      <section className="ipt-section ipt-catalog" id="ipt-catalog">
        <div className="ipt-section-heading">
          <span className="ipt-section-kicker">کاتالوگ واقعی صنعت پیش</span>
          <h2>قطعات مرتبط با صنعت {industry.title}</h2>
          <p>این فهرست از کاتالوگ فعال سایت خوانده می‌شود؛ خانواده‌ها، کدهای مستقیم و تنوع‌های هر خانواده در یک مسیر قابل بررسی‌اند.</p>
        </div>
        {industryProducts.length ? (
          <div className="ipt-products-grid">{industryProducts.map(product => <ProductCard key={product.code} product={product} />)}</div>
        ) : (
          <div className="ipt-stage-empty ipt-catalog-empty" role="status">
            <strong>{catalogReady ? "در حال حاضر کالای تأییدشده‌ای برای پیشنهاد مستقیم پیدا نشد." : "کاتالوگ در حال همگام‌سازی است."}</strong>
            <span>برای جلوگیری از پیشنهاد کالای نامرتبط، فقط داده‌های فعال و قابل تطبیق نمایش داده می‌شوند.</span>
            <Link to={catalogSearchUrl(industry.terms.join(" "))} className="ipt-button ipt-button--light">جست‌وجوی کامل کاتالوگ <Search size={16} /></Link>
          </div>
        )}
      </section>

      <section className="ipt-section ipt-checklist">
        <div className="ipt-checklist-copy">
          <span className="ipt-section-kicker">پیش از استعلام آماده کنید</span>
          <h2>چه اطلاعاتی به انتخاب دقیق‌تر کمک می‌کند؟</h2>
          <p>{industry.note}</p>
          <Link to={consultUrl(slug, "برای انتخاب قطعه در صنعت " + industry.title + " راهنمایی می‌خواهم. لطفاً اطلاعات فنی لازم را مرحله‌به‌مرحله بپرسید.")} className="ipt-text-link">دریافت راهنمایی فنی <ArrowLeft size={16} /></Link>
        </div>
        <div className="ipt-checklist-items">
          {industry.checks.map((check, index) => <div key={check}><b>{String(index + 1).padStart(2, "0")}</b><span>{check}</span><Check size={16} /></div>)}
        </div>
      </section>

      <section className="ipt-section ipt-knowledge">
        <div className="ipt-section-heading">
          <span className="ipt-section-kicker">دانش فنی پیش از انتخاب</span>
          <h2>راهنماهایی که در بررسی قطعه کمک می‌کنند</h2>
          <p>محتوای زیر به شناسایی، نگهداری و ثبت مشخصات قطعه کمک می‌کند؛ برای هر صنعت، موضوعات مرتبط‌تر در اولویت آمده‌اند.</p>
        </div>
        <div className="ipt-article-grid">
          {relatedArticles.map(article => (
            <Link to={"/knowledge/" + article.slug} key={article.slug} className="ipt-article-card">
              <div className="ipt-article-image"><img src={article.image} alt={article.title} loading="lazy" /></div>
              <div className="ipt-article-copy"><span>{article.category} · {article.minutes} دقیقه مطالعه</span><strong>{article.title}</strong><p>{article.summary}</p><b>مطالعه راهنما <ArrowUpLeft size={15} /></b></div>
            </Link>
          ))}
        </div>
        <Link to="/knowledge" className="ipt-text-link">رفتن به دانشنامه صنعت پیش <ArrowLeft size={15} /></Link>
      </section>

      <section className="ipt-why">
        <div className="ipt-why-visual">
          <img src={A.whySanatCadEngineering} alt="بررسی فنی و مهندسی قطعات صنعتی" loading="lazy" />
          <div><span>SANAT PISH</span><strong>تجربه صنعتی، مسیر دیجیتال</strong></div>
        </div>
        <div className="ipt-why-copy">
          <span className="ipt-section-kicker">چرا صنعت پیش؟</span>
          <h2>{detail.whyTitle}</h2>
          <p>{detail.whyIntroduction}</p>
          <ul>
            <li><Check size={16} /> جست‌وجو در اطلاعات کاتالوگ و دسته‌بندی‌های منتشرشده</li>
            <li><Check size={16} /> امکان بررسی کد، برند، ابعاد و مشخصات فنی موجود</li>
            <li><Check size={16} /> مسیر مشاوره و پیگیری درخواست متناسب با نوع نیاز</li>
            <li><Check size={16} /> بررسی امکان تأمین یا ساخت پس از دریافت اطلاعات کافی</li>
          </ul>
          <div className="ipt-why-actions">
            <Link to="/about" className="ipt-button ipt-button--light">آشنایی با صنعت پیش <ArrowLeft size={16} /></Link>
            <Link to="/services" className="ipt-text-link">توانمندی‌ها و خدمات <ArrowLeft size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="ipt-lead">
        <div className="ipt-lead-copy">
          <span className="ipt-section-kicker">ارتباط با کارشناسان</span>
          <h2>برای تأمین، بررسی یا ساخت قطعه موردنیاز خط خود اقدام کنید.</h2>
          <p>اگر کد فنی، تصویر، نقشه یا نمونه دارید، اطلاعات را آماده کنید. درخواست ساخت و مهندسی معکوس از فرم امن ثبت درخواست ارسال می‌شود؛ امکان اجرا پس از بررسی فنی اعلام خواهد شد.</p>
          <div className="ipt-lead-actions">
            <button type="button" className="ipt-button ipt-button--primary" onClick={() => setRequestOpen(true)}><Wrench size={16} /> درخواست بررسی ساخت</button>
            <a href="tel:03535254703" className="ipt-button ipt-button--light"><Phone size={16} /> تماس با فروشگاه</a>
            <Link to="/contact" className="ipt-button ipt-button--outline"><MapPin size={16} /> مشاهده نشانی و تلفن شعب</Link>
          </div>
        </div>
        <div className="ipt-lead-side">
          <span>پشتوانه تجربه صنعتی</span>
          <strong>بازرگانی اطلس</strong>
          <small>تأسیس ۱۳۶۶</small>
          <Link to="/contact">اطلاعات شعب و راه‌های ارتباطی <ArrowUpLeft size={16} /></Link>
        </div>
      </section>

      <section className="ipt-section ipt-related">
        <div className="ipt-section-heading">
          <span className="ipt-section-kicker">صنایع تحت پوشش</span>
          <h2>صنایع دیگر را هم بررسی کنید</h2>
        </div>
        <div className="ipt-related-grid">
          {INDUSTRIES.filter(item => item.slug !== slug).map(item => (
            <Link to={"/industries/" + item.slug} key={item.slug} className="ipt-related-card">
              <img src={item.image} alt="" loading="lazy" />
              <span>{item.title}<ArrowUpLeft size={16} /></span>
            </Link>
          ))}
        </div>
      </section>

      <CustomPartRequestModal
        isOpen={requestOpen}
        onClose={() => setRequestOpen(false)}
        initialPartName={"قطعه موردنیاز برای صنعت " + industry.title}
        initialPartType="سایر قطعات مکانیکی خاص"
        initialNotes={"درخواست از صفحه صنعت " + industry.title + ". مرحله خط تولید: " + (activeStage?.title || "مشخص نشده") + ". لطفاً پس از بررسی مشخصات و فایل‌های ارسالی، امکان ساخت یا مهندسی معکوس را اعلام کنید."}
      />
    </div>
  );
}

export default IndustryTemplatePage;
