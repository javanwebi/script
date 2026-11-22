import React, { useRef } from "react";
import { PartIdentificationLink as Link } from "../search/PartIdentificationProvider";
import {
  ArrowLeft,
  ArrowUpLeft,
  Camera,
  MessageSquare,
  Layers,
  ScanLine,
  UserPlus,
  LogIn,
  ShieldCheck,
  Zap,
  FileText,
  Sparkles,
} from "lucide-react";
import { STORE_ASSETS as A } from "../../assets/images";
import { INDUSTRIES } from "../../data/siteContent";
import { useAuth } from "../../context/AuthContext";
export function HomeAiIntroduction() {
  return (
    <section className="home-ai-introduction" aria-labelledby="home-ai-title">
      <div className="home-ai-title">
        <span className="store-eyebrow">
          FORZA · یک میزکار، چند مسیر برای رسیدن به قطعه
        </span>
        <h2 id="home-ai-title">
          نیازتان را بگویید؛
          <br />
          هوشمندانه‌تر به قطعه برسید.
        </h2>
        <p>
          از پرسش فنی و بررسی کدهای کاتالوگ تا شناسایی اولیه با تصویر؛ ابزارهای
          انتخاب کنار هم هستند.
        </p>
        <Link to="/ai-consult" className="editorial-text-link">
          آشنایی با میزکار FORZA <ArrowUpLeft size={18} />
        </Link>
      </div>
      <div className="home-ai-feature">
        <img fetchPriority="low" decoding="async"
          src={A.aiConsultRobot}
          alt="نمای معرفی مشاور هوشمند FORZA"
          loading="lazy"
        />
        <div>
          <span>
            <MessageSquare size={16} />
            گفتگوی مهندسی
          </span>
          <h3>پرسش شما، با زمینهٔ کاتالوگ</h3>
          <p>
            کد، کاربرد یا مشخصات قطعه را بنویسید. برای تصمیم بهتر، اطلاعات فنی
            لازم را قدم‌به‌قدم بررسی کنید.
          </p>
          <Link to="/ai-consult" className="store-btn-primary">
            شروع گفتگو <ArrowLeft size={17} />
          </Link>
        </div>
      </div>
      <div className="home-ai-feature">
        <img fetchPriority="low" decoding="async"
          src={A.aiSearchMobile}
          alt="نمای معرفی جستجوی تصویری قطعات"
          loading="lazy"
        />
        <div>
          <span>
            <Camera size={16} />
            شناسایی با تصویر
          </span>
          <h3>عکس دارید، کد را نمی‌دانید؟</h3>
          <p>
            تصویر روشن و ابعاد را ارسال کنید؛ نتیجهٔ پیشنهادی را با کد و مشخصات
            واقعی محصول تطبیق دهید.
          </p>
          <Link to="/identify-part" className="store-btn-secondary">
            بررسی تصویر قطعه <ScanLine size={17} />
          </Link>
        </div>
      </div>
      <p className="home-ai-disclaimer">
        پیشنهاد هوش مصنوعی نیازمند بررسی فنی است. قیمت، موجودی و ثبت استعلام در
        پنل کاربری در دسترس است.
      </p>
    </section>
  );
}
export function HomeIndustryShowcase() {
  const deck = useRef<HTMLDivElement>(null);
  return (
    <section className="home-industrial-supply" id="industries">
      <img fetchPriority="low" decoding="async"
        className="home-supply-background"
        src={A.industries.bgPlant}
        alt=""
        loading="lazy"
      />
      <div className="home-supply-inner">
        <div className="home-supply-story">
          <span className="store-eyebrow">صنعت پیش · همراه خطوط تولید</span>
          <span className="home-supply-label">تأمین قطعات و تجهیزات صنعتی</span>
          <h2>
            تأمین قطعات خطوط
            <br />
            <em>صنایع مختلف</em>
          </h2>
          <p>
            از کاشی و سرامیک و نساجی تا بسته‌بندی، صنایع غذایی، ماشین‌سازی و
            لاستیک؛ از کاربرد خط شروع کنید و به خانواده قطعه و مشخصات مورد نیاز
            برسید.
          </p>
          <Link className="store-btn-primary" to="/industries">
            مشاهده قطعات خطوط <ArrowLeft size={19} />
          </Link>
        </div>
        <div className="home-supply-carousel">
          <div className="home-supply-deck" ref={deck}>
            {INDUSTRIES.map((i, n) => (
              <Link
                to={`/industries/${i.slug}`}
                key={i.slug}
                className={n === 0 ? "is-featured" : ""}
              >
                <img fetchPriority="low" decoding="async" src={i.image} alt={i.title} loading="lazy" />
                <span>
                  <Layers size={16} />
                  <strong>{i.title}</strong>
                  <i>
                    <ArrowLeft size={17} />
                  </i>
                </span>
              </Link>
            ))}
          </div>
          <div className="home-supply-controls">
            <button
              aria-label="صنعت‌های قبلی"
              onClick={() =>
                deck.current?.scrollBy({ left: 300, behavior: "smooth" })
              }
            >
              <ArrowLeft size={18} style={{ transform: "rotate(180deg)" }} />
            </button>
            <span>صنعت خود را انتخاب کنید</span>
            <button
              aria-label="صنعت‌های بعدی"
              onClick={() =>
                deck.current?.scrollBy({ left: -300, behavior: "smooth" })
              }
            >
              <ArrowLeft size={18} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
export function HomeMembership() {
  const { openAuthModal, currentUser } = useAuth();
  if (currentUser) return null;

  return (
    <section
      className="editorial-wrap my-10 overflow-hidden rounded-3xl border border-[#2B313A] bg-gradient-to-l from-[#2B313A] via-[#22272F] to-[#1A1E24] p-6 sm:p-9 text-white shadow-xl"
      aria-labelledby="strategic-auth-banner-title"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="space-y-3 max-w-2xl">
          <div className="inline-flex items-center gap-2 text-xs font-extrabold text-[#FF9D5C]">
            <Sparkles size={15} />
            <span>استراتژی تأمین هوشمند صنعت پیش و FORZA</span>
          </div>
          <h2 id="strategic-auth-banner-title" className="text-xl sm:text-2xl lg:text-3xl font-black leading-snug text-white">
            از استعلام فوری قیمت کارخانه تا تأمین تضمینی خط تولید، یک ورود فاصله است
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            با ورود یا ساخت حساب صنعتی، لیست قیمت همکاری، سبد خرید یکپارچه، پیش‌فاکتور رسمی و سوابق شناسایی قطعه در میزکار FORZA برای شما فعال می‌شود.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 text-xs text-slate-200">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <Zap size={15} className="text-[#E06518] shrink-0" />
              <span className="font-bold">لیست قیمت کارخانه و همکاری</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <FileText size={15} className="text-[#E06518] shrink-0" />
              <span className="font-bold">صدور آنی پیش‌فاکتور رسمی</span>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <ShieldCheck size={15} className="text-[#E06518] shrink-0" />
              <span className="font-bold">ذخیره سوابق اسکن و سبد خرید</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0 lg:min-w-[230px]">
          <button
            type="button"
            onClick={() => openAuthModal("/consumer-dashboard", "register")}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-[#E06518] hover:bg-[#C95210] px-6 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserPlus size={18} />
            <span>ساخت حساب و دریافت قیمت</span>
          </button>
          <button
            type="button"
            onClick={() => openAuthModal(undefined, "login")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-6 text-xs sm:text-sm font-bold text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <LogIn size={17} />
            <span>قبلاً ثبت‌نام کرده‌اید؟ ورود سریع</span>
          </button>
        </div>
      </div>
    </section>
  );
}
