import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, ArrowUpLeft, CheckCircle2, Factory, Headphones, Package,
  Phone, ScanLine, Wrench, type LucideIcon,
} from "lucide-react";
import { STORE_ASSETS as A } from "../assets/images";
import { INDUSTRIES } from "../data/siteContent";
import { getManagedBrands } from "../data/brands";
import { getManagedCategories } from "../data/categories";
import { getAllProducts, subscribeCatalogChanges } from "../data/mockGenerator";
import { databaseStorageEnabled } from "../services/durableStorage";

type CatalogStats = { ready: boolean; brands: number; categories: number; families: number; skus: number };
type ServiceItem = {
  id: string; title: string; description: string; highlights: string[];
  href: string; action: string; Icon: LucideIcon;
};

const EMPTY_STATS: CatalogStats = { ready: false, brands: 0, categories: 0, families: 0, skus: 0 };

const PRINCIPLES = [
  {
    id: "mission", title: "ماموریت ما", image: A.reverseEngineeringLab,
    alt: "بررسی مهندسی و ساخت قطعات صنعتی",
    body: "ساده‌تر و شفاف‌تر کردن مسیر تأمین قطعات صنعتی؛ از شناخت نیاز و جست‌وجوی کد تا بررسی مشخصات، دریافت مشاوره و پیگیری درخواست.",
  },
  {
    id: "vision", title: "چشم‌انداز ما", image: A.refineryDuskWide,
    alt: "نمای یک مجموعه صنعتی در پایان روز کاری",
    body: "ساخت بستری قابل اتکا برای کشف و تأمین قطعات صنعتی در ایران؛ با پیوند تجربه بازار، اطلاعات فنی، ابزارهای دیجیتال و ارتباط مؤثر میان تأمین‌کننده و مصرف‌کننده صنعتی.",
  },
  {
    id: "values", title: "ارزش‌های ما", image: A.whySanatQc,
    alt: "کنترل و بررسی کیفیت قطعات صنعتی",
    body: "دقت در اطلاعات فنی، شفافیت در اعلام شرایط تأمین، پاسخگویی مسئولانه، احترام به زمان مشتری و ساختن همکاری‌های بلندمدت، اصولی هستند که به آن‌ها پایبندیم.",
  },
];

const SERVICE_ITEMS: ServiceItem[] = [
  {
    id: "supply", title: "تأمین قطعات و تجهیزات صنعتی",
    description: "کمک به یافتن و پیگیری تأمین قطعات استاندارد و تخصصی از مسیر کاتالوگ و شبکه تأمین مجموعه. موجودی، زمان تحویل و شرایط هر قلم در زمان استعلام بررسی و اعلام می‌شود.",
    highlights: ["جست‌وجو بر اساس نام، برند و کد فنی", "بررسی امکان تأمین اقلام خاص", "پیگیری درخواست و سفارش"],
    href: "/services", action: "مشاهده مسیر خدمات تأمین", Icon: Package,
  },
  {
    id: "consulting", title: "مشاوره فنی و انتخاب قطعه",
    description: "بررسی کد، ابعاد، پروفیل، جنس، سرعت، بار و شرایط محیطی دستگاه برای محدود کردن گزینه‌ها و انتخاب معادل مناسب. تأیید نهایی باید با مشخصات سازنده و شرایط واقعی کار تطبیق داده شود.",
    highlights: ["بررسی ابعاد و مشخصات کاربردی", "مقایسه گزینه‌های جایگزین", "کاهش خطای انتخاب پیش از سفارش"],
    href: "/services", action: "آشنایی با خدمات فنی", Icon: Headphones,
  },
  {
    id: "forza", title: "شناسایی هوشمند قطعه با FORZA",
    description: "استفاده از تصویر، کد و گفت‌وگو برای شروع جست‌وجوی هوشمند در کاتالوگ و یافتن گزینه‌های نزدیک. نتیجه شناسایی تصویری راهنمای اولیه است و پیش از سفارش باید با مشخصات قطعه و بررسی کارشناسی تأیید شود.",
    highlights: ["شروع جست‌وجو از روی تصویر قطعه", "کمک به یافتن خانواده‌ها و گزینه‌های مشابه", "امکان ادامه بررسی در مسیر مشاوره"],
    href: "/identify-part", action: "شروع شناسایی تصویری", Icon: ScanLine,
  },
  {
    id: "reverse", title: "بررسی مهندسی معکوس و ساخت",
    description: "بررسی نمونه، نقشه، ابعاد و تلرانس برای ارزیابی امکان مدل‌سازی و ساخت قطعات خاص یا کمیاب. قابلیت اجرا، جنس پیشنهادی و زمان‌بندی پس از بررسی فنی اعلام می‌شود.",
    highlights: ["بررسی نمونه یا نقشه فنی", "ارزیابی جنس و تلرانس موردنیاز", "اعلام امکان‌پذیری پس از بررسی"],
    href: "/services", action: "مشاهده توانمندی‌های مهندسی", Icon: Wrench,
  },
  {
    id: "projects", title: "تأمین پروژه‌ای و پشتیبانی صنایع",
    description: "دریافت فهرست قطعات موردنیاز پروژه، تعمیرات اساسی یا برنامه نگهداری؛ سپس بررسی گروهی اقلام و هماهنگی استعلام و تحویل مرحله‌ای، متناسب با امکان تأمین.",
    highlights: ["بررسی فهرست قطعات و BOM", "هماهنگی نیازهای تعمیرات و اورهال", "پیگیری درخواست‌های سازمانی"],
    href: "/contact", action: "ثبت درخواست همکاری", Icon: Factory,
  },
];

function readCatalogStats(): CatalogStats {
  if (!databaseStorageEnabled()) return EMPTY_STATS;
  const families = getAllProducts().filter((product) => product.active !== false);
  const skus = families.reduce(
    (total, family) => total + (family.variants || []).filter((variant) => variant.active !== false).length,
    0,
  );
  return {
    ready: true,
    brands: getManagedBrands().filter((brand) => brand.active !== false).length,
    categories: getManagedCategories().filter((category) => category.active !== false).length,
    families: families.length,
    skus,
  };
}

const formatCount = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

function HeroSection() {
  return (
    <section id="about" className="relative flex min-h-[390px] w-full items-center overflow-hidden bg-[#17232d] sm:min-h-[430px] lg:min-h-[500px]">
      <img src={A.companyPages.aboutHero} alt="نمایی از قطعات انتقال قدرت و تجهیزات مکانیکی صنعتی" className="absolute inset-0 h-full w-full object-cover object-center" fetchPriority="high" decoding="async" />
      <div className="absolute inset-0 bg-gradient-to-l from-[#101820]/95 via-[#101820]/78 to-[#101820]/25" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#101820]/55 via-transparent to-[#101820]/15 md:hidden" />
      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
        <div className="max-w-[680px]">
          <div className="mb-4 flex items-center gap-2 text-xs font-bold text-slate-200 sm:text-sm">
            <span className="font-black text-[#E56B1E]">/</span>
            <span>درباره صنعت پیش</span>
            <span className="mx-1 text-white/35">·</span>
            <span className="text-white/70">پیش به صنعت</span>
          </div>
          <h1 className="text-balance text-[30px] font-black leading-[1.55] text-white sm:text-[40px] lg:text-[48px]">
            تأمین قطعات صنعتی،
            <span className="mt-1 block text-[#F28A45]">با شناخت فنی و پشتوانه تجربه</span>
          </h1>
          <p className="mt-5 max-w-[620px] text-justify text-[13px] leading-8 text-slate-200 sm:text-[14px] lg:text-[15px]">
            صنعت پیش بستری تخصصی برای جست‌وجو، بررسی و پیگیری تأمین قطعات و تجهیزات صنعتی است.
            تجربه بازرگانی تسمه اطلس، اطلاعات کاتالوگی و مسیر ارتباط با کارشناسان را کنار هم قرار
            داده‌ایم تا پیدا کردن قطعه مناسب، از کد فنی و مشخصات تا استعلام و سفارش، روشن‌تر و
            منظم‌تر انجام شود.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link to="/products" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#E56B1E] px-6 py-3 text-xs font-extrabold text-white shadow-lg shadow-black/20 transition-colors hover:bg-[#c95612] sm:text-sm">
              مشاهده کاتالوگ قطعات <ArrowLeft size={17} />
            </Link>
            <Link to="/services" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/55 bg-white/5 px-6 py-3 text-xs font-extrabold text-white backdrop-blur-sm transition-colors hover:border-white hover:bg-white/12 sm:text-sm">
              توانمندی‌ها و خدمات <ArrowLeft size={17} />
            </Link>
          </div>
          <div className="mt-7 border-r-2 border-[#E56B1E] pr-3 text-[11px] leading-6 text-slate-200 sm:text-xs">
            <span className="block font-bold text-white">یک مسیر تخصصی برای نیازهای صنعت</span>
            <span>قطعات · برندها · مشخصات فنی · مشاوره · استعلام و پیگیری</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function StorySection() {
  return (
    <section id="story" className="relative z-10 mx-auto -mt-7 max-w-[1280px] px-4 sm:-mt-10 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_8px_34px_rgba(15,23,42,0.08)] sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 items-stretch gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="flex flex-col justify-between lg:col-span-7">
            <div>
              <div className="mb-4 flex items-center gap-2.5">
                <span className="h-6 w-1 shrink-0 rounded-full bg-[#E56B1E]" />
                <h2 className="text-lg font-extrabold leading-snug text-slate-900 sm:text-xl lg:text-[23px]">داستان ما؛ از بازرگانی تسمه اطلس تا صنعت پیش</h2>
              </div>
              <div className="space-y-3.5 text-justify text-xs leading-7 text-slate-600 sm:text-[13px] lg:text-sm lg:leading-8">
                <p>
                  <strong className="font-extrabold text-slate-900">بازرگانی تسمه اطلس</strong>{" "}
                  فعالیت خود را از سال <strong className="text-slate-900">۱۳۶۶</strong> در زمینه
                  تأمین تسمه‌های صنعتی و قطعات موردنیاز صنایع آغاز کرد. در این مسیر، شناخت کاربرد
                  قطعات، تفاوت مشخصات فنی و نیازهای روزمره واحدهای تولیدی به پشتوانه‌ای برای ادامه
                  فعالیت مجموعه تبدیل شده است.
                </p>
                <p>
                  <strong className="font-extrabold text-slate-900">صنعت پیش</strong> با هدف توسعه
                  همین تجربه در قالب یک بستر دیجیتال شکل گرفته است؛ تا فعالان صنعت بتوانند محصولات
                  را بر اساس نام، برند، دسته یا کد فنی جست‌وجو کنند، مشخصات موجود را بررسی کنند و
                  برای موارد نیازمند بررسی، درخواست خود را در مسیر مشخصی به کارشناسان برسانند.
                </p>
                <p>
                  اطلس پشتوانه تجربه بازار است و صنعت پیش، مسیر دیجیتال و توسعه‌یافته این تجربه؛
                  مسیری برای نزدیک‌تر کردن نیاز واقعی کارخانه‌ها به اطلاعات، خدمات و گزینه‌های
                  تأمین.
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-[#f0dfd0] bg-[#fff8f1] p-3.5 sm:flex-row sm:p-4">
              <div className="relative flex h-[76px] w-[112px] shrink-0 items-center justify-center">
                <img src={A.atlasLogo} alt="نشان بازرگانی تسمه اطلس" className="max-h-[62px] max-w-[108px] object-contain" loading="lazy" />
              </div>
              <div className="text-center text-xs leading-6 text-slate-700 sm:text-right sm:text-[13px]">
                <strong className="block font-extrabold text-slate-900">ریشه تجربه بازرگانی اطلس؛ از سال ۱۳۶۶</strong>
                <span className="text-slate-600">صنعت پیش این سابقه را در قالب ابزارهای دیجیتال و مسیرهای نوین جست‌وجو، بررسی و پیگیری تأمین توسعه می‌دهد.</span>
              </div>
            </div>
          </div>
          <div className="relative min-h-[240px] overflow-hidden rounded-xl bg-slate-900 sm:min-h-[300px] lg:col-span-5">
            <img src={A.companyPages.aboutWarehouse} alt="فضای انبار و نگهداری قطعات صنعتی بازرگانی تسمه اطلس" className="absolute inset-0 h-full w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 text-[11px] font-bold text-white sm:text-xs">
              <span>بازرگانی تسمه اطلس · پشتوانه تجربه صنعتی</span>
              <span className="shrink-0 font-black tracking-wider text-[#F28A45]">SANAT PISH</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhoWeAreSection() {
  const audiences = [
    "کارخانه‌ها و واحدهای تولیدی", "واحدهای نگهداری و تعمیرات",
    "مدیران خرید و تدارکات صنعتی", "ماشین‌سازان و کارگاه‌های مهندسی",
    "پیمانکاران و تأمین‌کنندگان صنعتی",
  ];
  return (
    <section className="mx-auto max-w-[1280px] px-4 pb-7 pt-12 sm:px-6 sm:pt-16 lg:px-8">
      <div className="grid grid-cols-1 items-center gap-6 lg:grid-cols-12 lg:gap-10">
        <div className="lg:col-span-7">
          <div className="mb-4 flex items-center gap-2.5">
            <span className="h-6 w-1 shrink-0 rounded-full bg-[#E56B1E]" />
            <h2 className="text-lg font-extrabold leading-snug text-slate-900 sm:text-xl lg:text-[23px]">صنعت پیش برای چه کسب‌وکارهایی است؟</h2>
          </div>
          <div className="space-y-3 text-justify text-xs leading-7 text-slate-600 sm:text-[13px] lg:text-sm lg:leading-8">
            <p>
              صنعت پیش برای مجموعه‌هایی طراحی شده که انتخاب و تأمین قطعه در تداوم فعالیت آن‌ها
              اهمیت دارد؛ از کارخانه‌ها و واحدهای نگهداری و تعمیرات تا مدیران خرید، ماشین‌سازان،
              کارگاه‌های مهندسی، پیمانکاران و فروشندگان قطعات صنعتی.
            </p>
            <p>
              نیاز شما ممکن است یک کد فنی مشخص، قطعه‌ای با پلاک ناخوانا، نمونه‌ای فرسوده، یک نقشه
              ساخت یا فهرست قطعات موردنیاز یک پروژه باشد. مسیر کار با اطلاعاتی که در اختیار دارید
              آغاز می‌شود؛ سپس امکان شناسایی، انتخاب جایگزین، تأمین یا بررسی ساخت سفارشی پیگیری
              خواهد شد.
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {audiences.map((audience) => (
              <span key={audience} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-700 sm:text-[11px]">{audience}</span>
            ))}
          </div>
        </div>
        <div className="lg:col-span-5">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl border border-slate-200/70 bg-slate-900 shadow-sm">
            <img src={A.companyPages.servicesEngineeringConsult} alt="کارشناس فنی در حال بررسی مشخصات و راهکار یک قطعه صنعتی" className="h-full w-full object-cover" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/35 via-transparent to-transparent" />
            <span className="absolute bottom-4 right-4 rounded-lg border border-white/20 bg-slate-950/55 px-3 py-2 text-[11px] font-bold text-white backdrop-blur-sm">شناخت نیاز، پیش از پیشنهاد قطعه</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function MissionVisionValuesSection() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
        {PRINCIPLES.map((item) => (
          <article key={item.id} className="relative flex min-h-[245px] flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f2f4f7] shadow-[0_2px_14px_rgba(15,23,42,0.04)]">
            <div className="relative h-36 w-full overflow-hidden md:hidden">
              <img src={item.image} alt={item.alt} className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#f2f4f7] via-[#f2f4f7]/25 to-transparent" />
            </div>
            <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[56%] overflow-hidden md:block">
              <img src={item.image} alt="" className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-l from-[#f2f4f7] via-[#f2f4f7]/70 to-transparent" />
            </div>
            <div className="relative z-10 p-5 md:pl-[34%]">
              <h3 className="mb-2.5 flex items-center gap-2 text-base font-extrabold text-slate-900 sm:text-lg">
                <span className="font-black text-[#E56B1E]">/</span>{item.title}
              </h3>
              <p className="text-xs leading-7 text-slate-700 sm:text-[13px]">{item.body}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function CapabilitiesSection() {
  const [activeServiceId, setActiveServiceId] = useState<string | null>("supply");
  const activeService = SERVICE_ITEMS.find((item) => item.id === activeServiceId) || null;
  return (
    <section id="capabilities" className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <div className="mb-5">
        <div className="mb-2 flex items-center gap-2.5">
          <span className="h-6 w-1 shrink-0 rounded-full bg-[#E56B1E]" />
          <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl lg:text-[23px]">توانمندی‌ها و خدمات صنعت پیش</h2>
        </div>
        <p className="max-w-4xl text-justify text-xs leading-7 text-slate-600 sm:text-sm">
          از تأمین قطعات و مشاوره فنی تا شناسایی هوشمند، بررسی مهندسی معکوس و پشتیبانی درخواست‌های
          پروژه‌ای؛ هر مسیر بر اساس اطلاعات و شرایط واقعی قطعه بررسی می‌شود.
        </p>
      </div>
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_4px_22px_rgba(15,23,42,0.06)]">
        <div className="relative h-44 overflow-hidden bg-slate-900 sm:h-52 md:h-56">
          <img src={A.companyPages.servicesHero} alt="بررسی ابعاد و کنترل فنی قطعات و تجهیزات صنعتی" className="h-full w-full object-cover object-[center_38%]" loading="lazy" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />
          <div className="absolute bottom-4 right-4 left-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-xl text-white">
              <span className="text-[10px] font-black tracking-[0.16em] text-[#F28A45]">INDUSTRIAL SUPPORT</span>
              <strong className="mt-1 block text-sm font-extrabold sm:text-base">از شناخت نیاز تا انتخاب مسیر مناسب تأمین</strong>
            </div>
            <Link to="/services" className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-full bg-[#E56B1E] px-5 py-2 text-[11px] font-extrabold text-white transition-colors hover:bg-[#c95612] sm:self-auto">
              مشاهده صفحه خدمات <ArrowLeft size={15} />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-1 divide-y divide-slate-200 bg-white sm:grid-cols-2 sm:divide-y-0 sm:divide-x sm:divide-x-reverse lg:grid-cols-5" role="group" aria-label="فهرست توانمندی‌ها و خدمات صنعت پیش">
          {SERVICE_ITEMS.map((service) => {
            const isActive = activeServiceId === service.id;
            const Icon = service.Icon;
            const tabClass = "flex min-h-[78px] items-center justify-center gap-2 px-3 py-4 text-center text-xs font-extrabold transition-colors sm:min-h-[88px] sm:flex-col sm:gap-2 sm:px-4 ";
            return (
              <button key={service.id} type="button" aria-pressed={isActive} onClick={() => setActiveServiceId(isActive ? null : service.id)} className={tabClass + (isActive ? "bg-orange-50 text-[#bd4f0d] ring-1 ring-inset ring-[#E56B1E]/30" : "text-slate-700 hover:bg-slate-50 hover:text-[#bd4f0d]")}>
                <Icon size={19} className={isActive ? "text-[#E56B1E]" : "text-slate-400"} aria-hidden="true" />
                <span className="leading-6">{service.title}</span>
              </button>
            );
          })}
        </div>
        {activeService && (
          <div className="flex flex-col justify-between gap-4 border-t border-orange-100 bg-[#fffaf5] p-4 sm:p-5 md:flex-row md:items-center">
            <div className="max-w-3xl space-y-2">
              <h3 className="text-sm font-extrabold text-slate-900 sm:text-base">{activeService.title}</h3>
              <p className="text-xs leading-7 text-slate-600 sm:text-[13px]">{activeService.description}</p>
              <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
                {activeService.highlights.map((highlight) => (
                  <span key={highlight} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700">
                    <CheckCircle2 size={14} className="text-[#E56B1E]" aria-hidden="true" />{highlight}
                  </span>
                ))}
              </div>
            </div>
            <Link to={activeService.href} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-full bg-[#E56B1E] px-5 py-2.5 text-xs font-extrabold text-white transition-colors hover:bg-[#c95612] md:self-center">
              {activeService.action} <ArrowLeft size={15} />
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function ContactRequestSection() {
  return (
    <section id="contact" className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-[#f2f4f7] shadow-[0_2px_16px_rgba(15,23,42,0.04)]">
        <div className="relative h-48 w-full overflow-hidden sm:h-56 lg:absolute lg:inset-y-0 lg:left-0 lg:h-full lg:w-[44%]">
          <img src={A.companyPages.contactShowroom} alt="فضای مراجعه و ارتباط حضوری با مجموعه صنعت پیش" className="h-full w-full object-cover object-center" loading="lazy" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#f2f4f7] via-transparent to-transparent lg:bg-gradient-to-l lg:from-[#f2f4f7] lg:via-[#f2f4f7]/45 lg:to-transparent" />
        </div>
        <div className="relative z-10 p-5 sm:p-7 lg:min-h-[285px] lg:py-9 lg:pl-[40%] lg:pr-9">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="h-6 w-1 shrink-0 rounded-full bg-[#E56B1E]" />
            <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl">تماس، هماهنگی و ثبت درخواست</h2>
          </div>
          <p className="max-w-2xl text-justify text-xs leading-7 text-slate-600 sm:text-[13px] sm:leading-8">
            اگر کد فنی، تصویر، نقشه یا نمونه قطعه در اختیار دارید، از مسیر تماس و هماهنگی درخواست
            خود را ثبت کنید. برای مشاوره، بررسی امکان تأمین، هماهنگی بازدید یا ارسال نمونه نیز
            جزئیات نیازتان را در همان صفحه با کارشناسان در میان بگذارید.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/contact" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#E56B1E] px-6 py-3 text-xs font-extrabold text-white transition-colors hover:bg-[#c95612] sm:text-[13px]">
              ثبت درخواست و هماهنگی <ArrowLeft size={16} />
            </Link>
            <Link to="/services" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#E56B1E]/55 bg-white px-5 py-3 text-xs font-extrabold text-slate-800 transition-colors hover:bg-orange-50 hover:text-[#bd4f0d] sm:text-[13px]">
              آشنایی با خدمات تخصصی <ArrowLeft size={16} className="text-[#E56B1E]" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function IndustriesSection({ stats }: { stats: CatalogStats }) {
  const metrics = [
    { id: "brands", value: stats.ready ? formatCount(stats.brands) : "—", label: "برند فعال در کاتالوگ" },
    { id: "categories", value: stats.ready ? formatCount(stats.categories) : "—", label: "دسته‌بندی فعال" },
    { id: "families", value: stats.ready ? formatCount(stats.families) : "—", label: "خانواده محصول" },
    { id: "skus", value: stats.ready ? formatCount(stats.skus) : "—", label: "کد کالای ثبت‌شده در خانواده‌ها" },
  ];
  return (
    <section className="mx-auto max-w-[1280px] px-4 py-7 sm:px-6 sm:py-9 lg:px-8">
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2.5">
            <span className="h-6 w-1 shrink-0 rounded-full bg-[#E56B1E]" />
            <h2 className="text-lg font-extrabold text-slate-900 sm:text-xl lg:text-[23px]">همراهی با صنایع مختلف</h2>
          </div>
          <p className="max-w-3xl text-justify text-xs leading-7 text-slate-600 sm:text-sm">
            نیاز هر خط تولید با توجه به کاربرد، شرایط محیطی و مشخصات دستگاه متفاوت است. صنعت موردنظر
            را انتخاب کنید تا مسیرها و گروه‌های مرتبط را دقیق‌تر بررسی کنید.
          </p>
        </div>
        <Link to="/industries" className="inline-flex min-h-10 shrink-0 items-center gap-2 self-start rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 transition-colors hover:border-[#E56B1E]/50 hover:text-[#bd4f0d] sm:self-auto">
          مشاهده همه صنایع <ArrowUpLeft size={15} />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
        {INDUSTRIES.map((industry) => (
          <Link key={industry.slug} to={"/industries/" + industry.slug} className="group relative min-h-[220px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:min-h-[250px]">
            <img src={industry.image} alt={"خط تولید و کاربردهای صنعت " + industry.title} className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" decoding="async" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-slate-950/5" />
            <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
              <span className="mb-1 block text-[10px] font-bold text-[#ffad79] sm:text-[11px]">{industry.eyebrow}</span>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-white sm:text-lg">{industry.title}</h3>
                  <p className="mt-1 line-clamp-2 max-w-[440px] text-[11px] leading-6 text-slate-200 sm:text-xs">{industry.description}</p>
                </div>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/35 bg-white/10 text-white transition-colors group-hover:border-[#E56B1E] group-hover:bg-[#E56B1E]">
                  <ArrowUpLeft size={17} />
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {industry.parts.slice(0, 2).map((part) => (
                  <span key={part} className="rounded-full border border-white/20 bg-black/20 px-2.5 py-1 text-[9px] font-bold text-white/90">{part}</span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_14px_rgba(15,23,42,0.04)]">
        <div className="grid grid-cols-2 lg:grid-cols-4" aria-live="polite">
          {metrics.map((metric, index) => {
            const metricClass = "flex min-h-[104px] flex-col items-center justify-center px-3 py-5 text-center ";
            const borders = (index < 2 ? "border-b border-slate-200/80 lg:border-b-0 " : "") +
              (index % 2 === 0 ? "border-l border-slate-200/80 " : "") +
              (index < 3 ? "lg:border-l" : "lg:border-l-0");
            return (
              <div key={metric.id} className={metricClass + borders}>
                <strong className="text-2xl font-black leading-tight text-[#E56B1E] tabular-nums sm:text-3xl">{metric.value}</strong>
                <span className="mt-1 text-[10px] font-bold text-slate-700 sm:text-xs">{metric.label}</span>
                {!stats.ready && <span className="mt-1 text-[9px] text-slate-400">پس از همگام‌سازی کاتالوگ</span>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BottomCtaBanner() {
  return (
    <section className="mx-auto max-w-[1280px] px-4 pb-10 pt-2 sm:px-6 sm:pb-14 lg:px-8">
      <div className="relative flex min-h-[190px] items-center overflow-hidden rounded-2xl bg-[#1b1714] shadow-md sm:min-h-[210px]">
        <img src={A.ctaConsultBanner} alt="" className="absolute inset-0 h-full w-full object-cover object-center" loading="lazy" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-l from-[#17120f]/95 via-[#17120f]/80 to-[#17120f]/20" />
        <div className="relative z-10 flex w-full flex-col justify-between gap-6 p-5 sm:flex-row sm:items-center sm:p-8 lg:px-10">
          <div className="max-w-2xl">
            <h2 className="text-lg font-extrabold leading-relaxed text-white sm:text-xl lg:text-2xl">
              برای تأمین، مشاوره یا بررسی فنی
              <span className="block">با <span className="text-[#F28A45]">صنعت پیش</span> در ارتباط باشید</span>
            </h2>
            <p className="mt-2 text-xs leading-7 text-slate-200 sm:text-[13px]">کد کالا، تصویر، نقشه یا شرح نیاز خود را آماده کنید تا مسیر بررسی و پیگیری با کارشناسان مشخص شود.</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link to="/contact" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-xs font-extrabold text-slate-900 shadow-lg transition-colors hover:bg-orange-50">
              تماس و ثبت درخواست <Phone size={15} className="text-[#E56B1E]" />
            </Link>
            <Link to="/products" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/45 bg-white/5 px-5 py-3 text-xs font-extrabold text-white transition-colors hover:bg-white/15">
              جست‌وجوی قطعه <ArrowLeft size={15} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function AboutPageTemplate() {
  const [stats, setStats] = useState<CatalogStats>(EMPTY_STATS);

  useEffect(() => {
    const previousTitle = document.title;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = description?.getAttribute("content") ?? null;
    document.title = "درباره صنعت پیش | تأمین قطعات و تجهیزات صنعتی";
    description?.setAttribute("content", "با صنعت پیش آشنا شوید؛ بستری تخصصی برای جست‌وجو، بررسی و پیگیری تأمین قطعات صنعتی با پشتوانه تجربه بازرگانی تسمه اطلس از سال ۱۳۶۶.");
    return () => {
      document.title = previousTitle;
      if (description && previousDescription !== null) description.setAttribute("content", previousDescription);
    };
  }, []);

  useEffect(() => {
    const refreshStats = () => setStats(readCatalogStats());
    refreshStats();
    const unsubscribeCatalog = subscribeCatalogChanges(refreshStats);
    const events = ["sanat-durable-hydrated", "atlas-brands-updated", "atlas-categories-updated", "atlas-catalog-updated"];
    events.forEach((eventName) => window.addEventListener(eventName, refreshStats));
    return () => {
      unsubscribeCatalog();
      events.forEach((eventName) => window.removeEventListener(eventName, refreshStats));
    };
  }, []);

  return (
    <div className="min-h-screen w-full overflow-x-clip bg-[#f7f8fa] text-slate-900" dir="rtl">
      <HeroSection />
      <StorySection />
      <WhoWeAreSection />
      <MissionVisionValuesSection />
      <CapabilitiesSection />
      <ContactRequestSection />
      <IndustriesSection stats={stats} />
      <BottomCtaBanner />
    </div>
  );
}
