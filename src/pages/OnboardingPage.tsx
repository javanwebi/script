import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { BRANDS } from "../data/brands";
import { BUSINESS_TYPES } from "../data/iranLocations";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Layers,
  Search,
  ShieldCheck,
} from "lucide-react";
export const OnboardingPage = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    saveOnboardingStep1,
    saveOnboardingStep2,
    setLatestCredentials,
  } = useAuth();
  const [step, setStep] = useState(currentUser?.favoriteBrands?.length ? 2 : 1),
    [brands, setBrands] = useState<string[]>(currentUser?.favoriteBrands || []),
    [business, setBusiness] = useState(currentUser?.businessType || ""),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const finish = () => {
    const root = currentUser?.approvedB2B ? "/account" : "/consumer-dashboard";
    let destination = "";
    try {
      destination = sessionStorage.getItem("sanat_access_destination") || "";
      sessionStorage.removeItem("sanat_access_destination");
    } catch {}
    navigate(destination.startsWith(root + "/product/") ? destination : root, {
      replace: true,
    });
  };
  useEffect(() => {
    if (currentUser?.onboardingCompleted) finish();
  }, [currentUser?.onboardingCompleted]);
  const next = async () => {
    setBusy(true);
    setError("");
    try {
      const saved =
        step === 1
          ? await saveOnboardingStep1(brands)
          : await saveOnboardingStep2(business);
      if (!saved) {
        setError("اطلاعات ذخیره نشد؛ دوباره تلاش کنید.");
        return;
      }
      if (step === 1) {
        setStep(2);
        window.scrollTo({ top: 0 });
      } else {
        setLatestCredentials(null);
        finish();
      }
    } catch {
      setError("ارتباط برقرار نشد؛ انتخاب‌های شما حفظ شده‌اند.");
    } finally {
      setBusy(false);
    }
  };
  const list = BRANDS.filter(
    (b) =>
      b.active !== false &&
      `${b.name} ${b.nameEn}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <main className="onboarding-shell" dir="rtl">
      <div className="onboarding-top">
        <Link to="/" className="onboarding-brand">
          <Layers /> صنعت پیش
        </Link>
        <span>
          <ShieldCheck size={16} /> تکمیل حساب شما
        </span>
      </div>
      <div className="onboarding-layout">
        <aside className="onboarding-story">
          <span className="store-eyebrow">
            یک‌بار تنظیم، تجربه‌ای متناسب با کار شما
          </span>
          <h1>
            صنعت شما را
            <br />
            <em>بهتر بشناسیم.</em>
          </h1>
          <p>
            این دو پرسش کمک می‌کنند محصولات و راهنماهای مرتبط‌تری پیدا کنید.
            تکمیل آن‌ها پیش از اولین ورود به پنل ضروری است.
          </p>
          <ol>
            <li className={step === 1 ? "active" : ""}>
              <b>۰۱</b>
              <span>
                برندهای مورد علاقه<small>انتخاب یک یا چند برند</small>
              </span>
              {step === 2 && <Check size={18} />}
            </li>
            <li className={step === 2 ? "active" : ""}>
              <b>۰۲</b>
              <span>
                نوع کسب‌وکار<small>آشنایی با فعالیت شما</small>
              </span>
            </li>
          </ol>
          <Link to="/">
            بازگشت به سایت <ArrowRight size={16} />
          </Link>
        </aside>
        <section className="onboarding-card" aria-busy={busy}>
          <span className="store-eyebrow">
            مرحله {step === 1 ? "۱" : "۲"} از ۲
          </span>
          <h2>
            {step === 1
              ? "با چه برندهایی کار می‌کنید؟"
              : "نوع کسب‌وکار شما چیست؟"}
          </h2>
          <p>
            {step === 1
              ? "برندهای مورد علاقه خود را انتخاب کنید؛ بعداً می‌توانید آن‌ها را در حساب تغییر دهید."
              : "گزینه‌ای را انتخاب کنید که فعالیت شما را بهتر توصیف می‌کند."}
          </p>
          {step === 1 ? (
            <>
              <label className="editorial-search">
                <Search size={18} />
                <input
                  aria-label="جستجوی برند"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="نام برند را جستجو کنید"
                />
              </label>
              <div className="onboarding-brands">
                {list.map((b) => (
                  <button
                    type="button"
                    key={b.id}
                    aria-pressed={brands.includes(b.id)}
                    onClick={() =>
                      setBrands((v) =>
                        v.includes(b.id)
                          ? v.filter((x) => x !== b.id)
                          : [...v, b.id],
                      )
                    }
                  >
                    <img src={b.logo} alt={b.nameEn} />
                    <span>{b.name}</span>
                    <i>{brands.includes(b.id) && <Check size={16} />}</i>
                  </button>
                ))}
              </div>
              {!list.length && <p role="status">برندی پیدا نشد.</p>}
            </>
          ) : (
            <div
              className="onboarding-options"
              role="radiogroup"
              aria-label="نوع کسب‌وکار"
            >
              {BUSINESS_TYPES.map((b) => (
                <label key={b.id}>
                  <input
                    type="radio"
                    name="business"
                    value={b.id}
                    checked={business === b.id}
                    onChange={() => setBusiness(b.id)}
                  />
                  <span>
                    <strong>{b.title}</strong>
                    <small>{b.description}</small>
                  </span>
                </label>
              ))}
            </div>
          )}
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <div className="onboarding-actions">
            {step === 2 ? (
              <button
                className="store-btn-secondary"
                onClick={() => {
                  setStep(1);
                  setError("");
                }}
                disabled={busy}
              >
                <ArrowRight size={16} /> قبلی
              </button>
            ) : (
              <span>
                {brands.length.toLocaleString("fa-IR")} برند انتخاب شده
              </span>
            )}
            <button
              className="store-btn-primary"
              onClick={next}
              disabled={busy || (step === 1 ? !brands.length : !business)}
            >
              {busy
                ? "در حال ذخیره…"
                : step === 1
                  ? "ثبت و ادامه"
                  : "تکمیل و ورود به پنل"}
              <ArrowLeft size={18} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};
