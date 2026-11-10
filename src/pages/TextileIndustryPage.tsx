import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpLeft,
  Boxes,
  Clock3,
  Factory,
  Gauge,
  Headset,
  Layers3,
  MoveHorizontal,
  PackageCheck,
  Ruler,
  ScanLine,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Waves,
  Zap,
} from "lucide-react";
import { INDUSTRIES } from "../data/siteContent";
import { STORE_ASSETS as A } from "../assets/images";
import { getAllProducts, subscribeCatalogChanges } from "../data/mockGenerator";
import { rankIndustryProducts } from "../utils/industryCatalog";
import { ProductCard } from "../components/product/ProductCard";
import { MemberAccess } from "../components/storefront/MemberAccess";
import type { Product } from "../types";
import "../textile-industry.css";

const industry = INDUSTRIES.find((item) => item.slug === "textile")!;

const stages = [
  {
    number: "۰۱",
    title: "ریسندگی",
    short: "تبدیل الیاف به نخ",
    description:
      "در ریسندگی، کشش یکنواخت و انتقال نیروی پایدار به کیفیت نخ و کاهش توقف دستگاه کمک می‌کند.",
    search: "تسمه ریسندگی بلبرینگ پولی",
    icon: Waves,
  },
  {
    number: "۰۲",
    title: "بافندگی",
    short: "حرکت هماهنگ ماشین",
    description:
      "برای ماشین‌های بافندگی، سرعت، لرزش و دقت حرکت اجزای انتقال نیرو را در کنار هم بررسی کنید.",
    search: "بلبرینگ تسمه پولی بافندگی",
    icon: MoveHorizontal,
  },
  {
    number: "۰۳",
    title: "رنگرزی",
    short: "کار در رطوبت و مواد",
    description:
      "رطوبت، دما و تماس احتمالی با مواد شیمیایی باید در انتخاب جنس قطعات و آب‌بندی لحاظ شوند.",
    search: "قطعات پلیمری آب بندی نساجی",
    icon: Waves,
  },
  {
    number: "۰۴",
    title: "تکمیل",
    short: "کنترل و پرداخت پارچه",
    description:
      "در بخش تکمیل، پایداری حرکت و سلامت سطح پارچه اهمیت دارد؛ فشار و سرعت کاری را مشخص کنید.",
    search: "غلتک گاید ریل صنعتی",
    icon: Settings2,
  },
  {
    number: "۰۵",
    title: "برش و بسته‌بندی",
    short: "هدایت و جمع‌آوری",
    description:
      "برای هدایت و جمع‌کردن پارچه، ابعاد، نوع تماس و سرعت خط را با مشخصات قطعه تطبیق دهید.",
    search: "گاید تسمه نقاله چرخ صنعتی",
    icon: PackageCheck,
  },
];

const benefits = [
  { icon: Headset, title: "مشاوره تخصصی رایگان", detail: "انتخاب دقیق‌تر قطعه" },
  { icon: Boxes, title: "موجودی و تأمین", detail: "بررسی خانواده‌های کاتالوگ" },
  { icon: ShieldCheck, title: "تأمین صنعتی مطمئن", detail: "برندها و مشخصات قابل بررسی" },
  { icon: Factory, title: "پوشش خط تولید", detail: "از ریسندگی تا تکمیل پارچه" },
];

const reasons = [
  { icon: Settings2, title: "دسترسی به برندهای معتبر", detail: "بررسی گزینه‌های متناسب با نیاز فنی خط تولید" },
  { icon: Headset, title: "مشاوره تخصصی", detail: "کمک به انتخاب قطعه با توجه به محل نصب و شرایط کار" },
  { icon: Ruler, title: "مهندسی و تطبیق قطعه", detail: "بررسی ابعاد، پروفیل و مشخصات فنی جایگزین" },
  { icon: Zap, title: "تأمین و پیگیری", detail: "پیگیری درخواست قطعه از مسیر پنل مشتریان" },
  { icon: Clock3, title: "همراهی در تداوم تولید", detail: "تمرکز بر انتخاب درست و کاهش ریسک توقف خط" },
];

const criteria = [
  { icon: Gauge, title: "سرعت عملکرد", detail: "دور یا متر بر دقیقه" },
  { icon: Waves, title: "رطوبت محیط", detail: "شرایط شست‌وشو و RH" },
  { icon: Thermometer, title: "دمای کاری", detail: "دمای واقعی محل نصب" },
  { icon: Ruler, title: "ابعاد شفت", detail: "قطر، طول و نوع اتصال" },
  { icon: MoveHorizontal, title: "نوع حرکت", detail: "دورانی، خطی یا انتقالی" },
  { icon: Factory, title: "مرحله تولید", detail: "ریسندگی تا بسته‌بندی" },
  { icon: ShieldCheck, title: "شرایط محیط", detail: "گردوغبار و مواد شیمیایی" },
  { icon: Layers3, title: "سازگاری مواد", detail: "جنس قطعه و سطح تماس" },
];

function TextileSectionTitle({
  eyebrow,
  title,
  detail,
  action,
}: {
  eyebrow: string;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="textile-section-heading">
      <div>
        <span className="textile-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  );
}

export function TextileIndustryPage() {
  const [selectedStage, setSelectedStage] = useState(0);
  const [catalogVersion, setCatalogVersion] = useState(0);

  useEffect(() => {
    document.title = "قطعات و راهکارهای صنعت نساجی | صنعت پیش";
    return subscribeCatalogChanges(() => setCatalogVersion((version) => version + 1));
  }, []);

  const products = useMemo<Product[]>(
    () => rankIndustryProducts(getAllProducts(), industry, 6),
    [catalogVersion],
  );
  const activeStage = stages[selectedStage];
  const StageIcon = activeStage.icon;

  return (
    <main className="textile-page" dir="rtl">
      <section className="textile-hero" aria-labelledby="textile-title">
        <img
          className="textile-hero-image"
          src={A.industries.textile}
          alt="ماشین‌آلات و خط تولید صنعت نساجی"
          fetchPriority="high"
          decoding="async"
        />
        <div className="textile-hero-shade" />
        <div className="textile-hero-grid textile-wrap">
          <div className="textile-hero-copy">
            <span className="textile-hero-kicker">راهکارهای تخصصی صنعت نساجی</span>
            <h1 id="textile-title">نساجی</h1>
            <span className="textile-title-rule" />
            <p>
              تأمین قطعات تخصصی برای خطوط ریسندگی، بافندگی، رنگرزی و تکمیل پارچه؛
              با تمرکز بر انتخاب فنی، حرکت پایدار و کاهش ریسک توقف تولید.
            </p>
            <div className="textile-hero-actions">
              <a className="textile-button textile-button-primary" href="#textile-products">
                مشاهده قطعات مرتبط <ArrowLeft size={17} />
              </a>
              <Link
                className="textile-button textile-button-ghost"
                to="/ai-consult?industry=textile"
              >
                مشاوره با FORZA <ActivityIcon />
              </Link>
            </div>
          </div>
          <div className="textile-hero-points" aria-label="مزیت‌های راهکار نساجی">
            <div><ShieldCheck /><span><b>قابلیت اطمینان بالا</b><small>در مسیر تولید پیوسته</small></span></div>
            <div><Waves /><span><b>مقاومت در برابر رطوبت</b><small>با انتخاب متناسب با محیط</small></span></div>
            <div><Gauge /><span><b>کاهش توقفات خط تولید</b><small>با بررسی فنی پیش از انتخاب</small></span></div>
            <div><Settings2 /><span><b>افزایش عمر تجهیزات</b><small>با تطبیق قطعه و کاربرد</small></span></div>
          </div>
        </div>
      </section>

      <section className="textile-benefit-strip" aria-label="خدمات صنعت پیش برای نساجی">
        <div className="textile-wrap textile-benefit-grid">
          {benefits.map(({ icon: Icon, title, detail }) => (
            <div className="textile-benefit" key={title}>
              <Icon aria-hidden="true" />
              <span><b>{title}</b><small>{detail}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section className="textile-wrap textile-production" id="textile-production">
        <TextileSectionTitle
          eyebrow="راهنمای خط تولید"
          title="مراحل خط تولید نساجی"
          detail="ایستگاه را انتخاب کنید تا قطعات و نکات فنی مرتبط با همان بخش را ببینید."
        />
        <div className="textile-production-panel">
          <div className="textile-production-visual">
            <img
              src={A.categories.textile}
              alt="تجهیزات و ماشین‌آلات مورد استفاده در تولید نساجی"
              loading="lazy"
              decoding="async"
            />
            <span className="textile-visual-caption"><Factory size={15} /> مسیر تأمین قطعات خط نساجی</span>
          </div>
          <div className="textile-production-content">
            <div className="textile-stage-list" role="tablist" aria-label="مراحل خط تولید نساجی">
              {stages.map((stage, index) => {
                const Icon = stage.icon;
                const selected = selectedStage === index;
                return (
                  <button
                    type="button"
                    role="tab"
                    id={`textile-stage-tab-${index}`}
                    aria-selected={selected}
                    aria-controls="textile-stage-panel"
                    key={stage.number}
                    onClick={() => setSelectedStage(index)}
                    className={selected ? "is-active" : ""}
                  >
                    <Icon aria-hidden="true" />
                    <b>{stage.title}</b>
                    <small>{stage.number}</small>
                  </button>
                );
              })}
            </div>
            <div
              className="textile-stage-detail"
              id="textile-stage-panel"
              role="tabpanel"
              aria-labelledby={`textile-stage-tab-${selectedStage}`}
              aria-live="polite"
            >
              <span className="textile-stage-index">ایستگاه {activeStage.number}</span>
              <div className="textile-stage-detail-title"><StageIcon /><h3>{activeStage.title}</h3></div>
              <b>{activeStage.short}</b>
              <p>{activeStage.description}</p>
              <div className="textile-stage-actions">
                <Link to={`/products?q=${encodeURIComponent(activeStage.search)}`}>
                  قطعات مرتبط <ArrowLeft size={15} />
                </Link>
                <Link to={`/ai-consult?industry=textile&stage=${encodeURIComponent(activeStage.title)}`}>
                  مشاوره FORZA <ScanLine size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="textile-wrap textile-products-section" id="textile-products">
        <TextileSectionTitle
          eyebrow="انتخاب از کاتالوگ صنعت پیش"
          title="قطعات صنعتی پیشنهادی برای خطوط نساجی"
          detail="پیشنهادها بر اساس ارتباط نام، دسته‌بندی و مشخصات فنی با کاربرد نساجی مرتب شده‌اند."
          action={<Link className="textile-section-link" to="/products?q=نساجی">مشاهده همه قطعات <ArrowLeft size={16} /></Link>}
        />
        {products.length > 0 ? (
          <div className="textile-product-grid">
            {products.map((product) => <ProductCard key={product.code} product={product} />)}
          </div>
        ) : (
          <div className="textile-empty-catalog" role="status">
            <Boxes />
            <div>
              <b>در حال حاضر خانواده تأییدشده‌ای برای پیشنهاد مستقیم پیدا نشد.</b>
              <p>برای جلوگیری از نمایش کالای نامرتبط، می‌توانید کاتالوگ را با عبارت‌های مرتبط با نساجی جستجو کنید.</p>
            </div>
            <Link to="/products?q=نساجی">جستجو در کاتالوگ <ArrowLeft size={16} /></Link>
          </div>
        )}
        <MemberAccess />
      </section>

      <section className="textile-why-section">
        <div className="textile-wrap">
          <TextileSectionTitle
            eyebrow="همراه صنعت شما"
            title="چرا صنعت پیش برای کارخانه‌های نساجی؟"
            detail="از شناخت نیاز خط تا بررسی گزینه‌های تأمین، مسیر انتخاب قطعه را یکپارچه دنبال کنید."
          />
          <div className="textile-why-grid">
            {reasons.map(({ icon: Icon, title, detail }, index) => (
              <article className="textile-why-card" key={title}>
                <span className="textile-why-number">۰{index + 1}</span>
                <Icon aria-hidden="true" />
                <h3>{title}</h3>
                <p>{detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="textile-wrap textile-forza-banner" aria-labelledby="textile-forza-title">
        <div className="textile-forza-copy">
          <span className="textile-forza-brand">FORZA <Sparkles size={18} /></span>
          <h2 id="textile-forza-title">دستیار هوشمند صنعت پیش</h2>
          <p>
            برای انتخاب قطعه مناسب، بررسی مشخصات فنی و پیدا کردن مسیر تأمین،
            از FORZA کمک بگیرید؛ متناسب با نیاز واقعی خط نساجی شما.
          </p>
          <div className="textile-forza-actions">
            <Link to="/ai-consult?industry=textile" className="textile-button textile-button-primary">
              شروع مشاوره با FORZA <ArrowLeft size={17} />
            </Link>
            <Link to="/part-identification" className="textile-forza-secondary">
              شناسایی تصویری قطعه <ScanLine size={16} />
            </Link>
          </div>
        </div>
        <div className="textile-forza-visual">
          <img src={A.forzaAiRobotHalo} alt="دستیار هوشمند FORZA صنعت پیش" loading="lazy" decoding="async" />
        </div>
        <div className="textile-forza-shortcuts">
          <span><Boxes /> راهنمای انتخاب قطعه مناسب</span>
          <span><Search /> بررسی موجودی و زمان تأمین</span>
          <span><ScanLine /> پیشنهاد تخصصی متناسب با خط تولید</span>
        </div>
      </section>

      <section className="textile-wrap textile-guide-section" id="textile-guide">
        <TextileSectionTitle
          eyebrow="راهنمای فنی انتخاب"
          title="راهنمای انتخاب قطعه مناسب در صنعت نساجی"
          detail="پیش از انتخاب یا استعلام، این معیارها را با مشخصات واقعی دستگاه و محل نصب تطبیق دهید."
        />
        <div className="textile-criteria-grid">
          {criteria.map(({ icon: Icon, title, detail }) => (
            <article className="textile-criteria-card" key={title}>
              <Icon aria-hidden="true" />
              <b>{title}</b>
              <small>{detail}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="textile-wrap textile-final-cta">
        <img src={A.industries.textile} alt="" loading="lazy" decoding="async" />
        <div className="textile-final-cta-shade" />
        <div className="textile-final-cta-copy">
          <span>همراه خط تولید شما</span>
          <h2>برای خط نساجی خود، راهکار مطمئن و تخصصی می‌خواهید؟</h2>
          <p>از انتخاب قطعه تا بررسی فنی و پیگیری درخواست، صنعت پیش در کنار شماست.</p>
        </div>
        <div className="textile-final-cta-actions">
          <Link to="/products?q=نساجی" className="textile-button textile-button-primary">
            مشاهده قطعات نساجی <ArrowLeft size={16} />
          </Link>
          <Link to="/ai-consult?industry=textile" className="textile-button textile-button-ghost">
            مشاوره تخصصی رایگان <Headset size={16} />
          </Link>
        </div>
      </section>
    </main>
  );
}

function ActivityIcon() {
  return <span className="textile-activity-icon" aria-hidden="true"><Zap size={15} /></span>;
}
