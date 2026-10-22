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
} from "lucide-react";
import { STORE_ASSETS as A } from "../../assets/images";
import { INDUSTRIES } from "../../data/siteContent";
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
        <img
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
        <img
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
      <img
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
                <img src={i.image} alt={i.title} loading="lazy" />
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
  return (
    <section className="home-membership editorial-wrap">
      <span className="account-symbol">
        <Layers size={28} />
      </span>
      <div>
        <span className="store-eyebrow">با صنعت پیش، هوشمندانه پیش بروید</span>
        <h2>از دیدن قطعه تا پیگیری خرید، یک حساب فاصله است.</h2>
        <p>
          قیمت و موجودی را در پنل ببینید، استعلام بگیرید و سفارش‌ها و مسیر
          باشگاه مشتریان را دنبال کنید.
        </p>
      </div>
      <Link to="/register" className="store-btn-primary">
        <UserPlus size={19} />
        ساخت حساب کاربری
      </Link>
      <Link to="/login" className="editorial-text-link">
        قبلاً ثبت‌نام کرده‌اید؟ ورود <ArrowLeft size={16} />
      </Link>
    </section>
  );
}
