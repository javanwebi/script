import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { STORE_ASSETS } from "../assets/images";
import "./BeltSelectionPage.css";

const BELT_ENGINEERING_PROMPT =
  "می‌خواهم تسمه صنعتی مناسب دستگاه خود را انتخاب کنم. لطفاً ابتدا نوع کاربرد و اطلاعاتی را که دارم بررسی کن و سپس فقط مشخصات ضروریِ باقی‌مانده مثل نوع تسمه، پروفیل، طول مرجع، توان، دور، قطر پولی‌ها و شرایط کاری را مرحله‌به‌مرحله از من بپرس. در پایان گزینه‌های قابل بررسی را با کاتالوگ صنعت پیش تطبیق بده و موارد نامطمئن را قطعی اعلام نکن.";

export function BeltSelectionPage() {
  const [beltCode, setBeltCode] = useState("");
  const navigate = useNavigate();

  const handleCodeSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const query = beltCode.trim();
    if (!query) return;
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const engineeringUrl = `/ai-consult?prompt=${encodeURIComponent(BELT_ENGINEERING_PROMPT)}`;

  return (
    <div className="belt-selection-page" dir="rtl">
      <div className="bsp-container">
        <nav className="bsp-breadcrumb" aria-label="مسیر راهنما">
          <Link to="/">صفحه اصلی</Link>
          <span aria-hidden="true">/</span>
          <strong>انتخاب هوشمند تسمه</strong>
        </nav>

        <section className="bsp-hero" aria-labelledby="bsp-hero-title">
          <div className="bsp-hero-copy">
            <span className="bsp-eyebrow">راهنمای انتخاب تسمه صنعتی · FORZA</span>
            <h1 id="bsp-hero-title">
              برای انتخاب تسمه، لازم نیست همه‌چیز را از قبل بدانید.
            </h1>
            <p>
              عکس، کد فنی، اندازه‌ها یا مشخصات دستگاه را دارید؟ از همان اطلاعات
              شروع کنید. مسیر مناسب را انتخاب کنید تا از شناسایی و محاسبه تا
              بررسی مهندسی و پیدا کردن محصول در کاتالوگ همراهتان باشیم.
            </p>
            <div className="bsp-method-line" aria-label="روش‌های انتخاب">
              <span>تصویر و مارکینگ</span>
              <span>کد فنی</span>
              <span>اندازه‌ها</span>
              <span>مشخصات دستگاه</span>
            </div>
          </div>
          <div className="bsp-hero-media">
            <img
              src={STORE_ASSETS.subcategories.timingBeltHero}
              alt="نمای نزدیک تسمه تایمینگ صنعتی و دندانه‌های آن"
              loading="eager"
              fetchPriority="high"
              decoding="async"
            />
            <span>از شناسایی تا انتخاب مطمئن</span>
          </div>
        </section>

        <section className="bsp-start" aria-labelledby="bsp-start-title">
          <div className="bsp-section-heading">
            <span>شروع از اطلاعاتی که دارید</span>
            <h2 id="bsp-start-title">کدام مسیر به وضعیت شما نزدیک‌تر است؟</h2>
            <p>لازم نیست همه مشخصات را بدانید؛ یک نقطه شروع کافی است.</p>
          </div>

          <div className="bsp-path-list">
            <div className="bsp-path-row">
              <span className="bsp-path-number">۰۱</span>
              <div className="bsp-path-copy">
                <h3>تسمه قبلی را دارم</h3>
                <p>از نوشته‌های روی تسمه یا ظاهر آن عکس بفرستید تا برای شناسایی بررسی شود.</p>
              </div>
              <Link to="/identify-part?from=belt-selection" className="bsp-path-action">
                ارسال تصویر
                <ArrowLeft size={16} aria-hidden="true" />
              </Link>
            </div>

            <div className="bsp-path-row bsp-path-row-code">
              <span className="bsp-path-number">۰۲</span>
              <div className="bsp-path-copy">
                <h3>کد تسمه را می‌دانم</h3>
                <p>کد چاپ‌شده روی تسمه یا کد ثبت‌شده در دفترچه دستگاه را جست‌وجو کنید.</p>
              </div>
              <form className="bsp-code-search" onSubmit={handleCodeSearch}>
                <label className="bsp-visually-hidden" htmlFor="bsp-belt-code">
                  کد فنی تسمه
                </label>
                <input
                  id="bsp-belt-code"
                  value={beltCode}
                  onChange={(event) => setBeltCode(event.target.value)}
                  placeholder="مثلاً SPB 2000 یا 8M 1200"
                  autoComplete="off"
                  dir="auto"
                />
                <button type="submit" disabled={!beltCode.trim()}>
                  جست‌وجوی کد
                  <ArrowLeft size={16} aria-hidden="true" />
                </button>
              </form>
            </div>

            <div className="bsp-path-row bsp-path-row-engineering">
              <span className="bsp-path-number">۰۳</span>
              <div className="bsp-path-copy">
                <h3>اندازه‌ها یا مشخصات دستگاه را دارم</h3>
                <p>طول تقریبی را از روی پولی‌ها محاسبه کنید یا انتخاب فنی را با FORZA پیش ببرید.</p>
              </div>
              <div className="bsp-path-actions">
                <Link to="/ai-consult?tool=belt-calculator" className="bsp-path-action bsp-path-action-light">
                  محاسبه با پولی‌ها
                </Link>
                <Link to={engineeringUrl} className="bsp-path-action">
                  راهنمایی مهندسی
                  <ArrowLeft size={16} aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="bsp-help" aria-label="مشاوره انتخاب تسمه با FORZA">
          <div>
            <span>اگر هنوز مطمئن نیستید</span>
            <h2>از هرجا هستید، انتخاب را با FORZA ادامه دهید.</h2>
            <p>اطلاعات ناقص هم قابل شروع است؛ FORZA برای تکمیل مشخصات لازم سؤال می‌پرسد.</p>
          </div>
          <Link to={engineeringUrl}>
            شروع مشاوره
            <ArrowLeft size={17} aria-hidden="true" />
          </Link>
        </section>

        <div className="bsp-catalog-note">
          <p>نوع تسمه را می‌شناسید و فقط می‌خواهید محصولات را ببینید؟</p>
          <Link to="/search?q=تسمه">
            مشاهده تسمه‌های کاتالوگ
            <ArrowLeft size={15} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}
