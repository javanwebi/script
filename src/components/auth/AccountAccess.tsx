import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  Layers,
  CheckCircle2,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { IRAN_PROVINCES, ACTIVITY_FIELDS } from "../../data/iranLocations";
import { normalizeIranianMobile } from "../../utils/usernameGenerator";
import { STORE_ASSETS as A } from "../../assets/images";
import { SanatPishLogo } from "../common/BrandIdentity";
import { RegisterPayload } from "../../types";
import { portalRequest, hydratePortal } from "../../services/portalRepository";
import { PhoneLogin } from "./PhoneLogin";
export function AccountAccess({
  initial = "login",
  onDone,
}: {
  initial?: "login" | "register";
  onDone?: () => void;
}) {
  const auth = useAuth(),
    navigate = useNavigate();
  const [mode, setMode] = useState(initial),
    [step, setStep] = useState(1),
    [method, setMethod] = useState<"password" | "sms">("password");
  const [busy, setBusy] = useState(false),
    [visible, setVisible] = useState(false),
    [error, setError] = useState("");
  const [province, setProvince] = useState(""),
    [city, setCity] = useState("");
  const [requiresVerification,setRequiresVerification]=useState(false);
  const [registrationDemoOnly,setRegistrationDemoOnly]=useState(false);
  const [details, setDetails] = useState<Partial<RegisterPayload>>({});
  const [mustChange,setMustChange] = useState(false);
  useEffect(()=>{
    const user=auth.currentUser as ({registrationCredentialsPending?:boolean;mustChangePassword?:boolean}) | null;
    if(user?.mustChangePassword===true){setMustChange(true);setMode('login');setMethod('password');}
    else if(user?.registrationCredentialsPending){setMode('register');setStep(2);setRequiresVerification(false);}
  },[auth.currentUser]);
  const go = (user = auth.currentUser) => {
    onDone?.();
    const root = user?.approvedB2B ? "/account" : "/consumer-dashboard";
    let destination = "";
    try {
      destination = sessionStorage.getItem("sanat_access_destination") || "";
    } catch {}
    if (user?.role !== "retail" || user?.approvedB2B || user?.onboardingCompleted === true) {
      try {
        sessionStorage.removeItem("sanat_access_destination");
      } catch {}
      navigate(destination.startsWith(root + "/product/") ? destination : root);
    } else navigate("/onboarding");
  };
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    if (mode === "register" && step === 1) {
      const mobile = normalizeIranianMobile(String(data.get("mobile") || ""));
      if (!mobile.isValid) {
        setError("شماره موبایل معتبر وارد کنید.");
        return;
      }
      const registrationDetails = {
        firstName: String(data.get("firstName") || ""),
        lastName: String(data.get("lastName") || ""),
        mobile: mobile.normalized,
        companyName: String(data.get("companyName") || ""),
        email: String(data.get("email") || ""),
        activityField: String(data.get("activityField") || ""),
        provinceId: province,
        cityId: city,
        province: IRAN_PROVINCES.find((p) => p.id === province)?.name,
        city: IRAN_PROVINCES.find((p) => p.id === province)?.cities.find(
          (c) => c.id === city,
        )?.name,
      };
      setDetails(registrationDetails);
      setBusy(true);
      try {
        const result=await auth.registerUser(registrationDetails as RegisterPayload);
        if(!result.success){
          const localhost=typeof window!=='undefined' && ['localhost','127.0.0.1','::1'].includes(window.location.hostname);
          const smsUnavailable=/پیامک|SMS|تأیید/i.test(result.message||'');
          if(import.meta.env.DEV && localhost && smsUnavailable){
            // This independent local preview only tests the OTP UI. It does not create accounts/sessions.
            setRegistrationDemoOnly(true);setRequiresVerification(true);setMode('login');setMethod('sms');
            return;
          }
          setError(result.message || 'ارسال کد انجام نشد.');return;
        }
        setRegistrationDemoOnly(false);setRequiresVerification(true);setMode('login');setMethod('sms');
      } finally {setBusy(false);}
      return;
    }
    if (
      mode === "register" &&
      data.get("password") !== data.get("confirmPassword")
    ) {
      setError("تکرار رمز عبور با رمز یکسان نیست.");
      return;
    }
    setBusy(true);
    try {
      const r =
        mode === "login"
          ? await auth.loginWithPassword(
              String(data.get("identifier") || ""),
              String(data.get("password") || ""),
            )
          : await portalRequest({
              action: "registration_credentials",
              username: String(data.get("username") || ""),
              password: String(data.get("password") || ""),
            });
      if(mode === "register" && r.success)await hydratePortal();
      if (!r.success) {
        setError(r.message || "اطلاعات را بررسی کنید.");
        return;
      }
      if(r.requiresPhoneVerification){setRequiresVerification(true);setMode("login");setMethod("sms");return;}
      if((r as typeof r & {requiresPasswordChange?:boolean}).requiresPasswordChange){setMustChange(true);setMode('login');setMethod('password');return;}
      auth.setLatestCredentials(null);
      go(r.user || null);
    } catch (e:any) {
      setError(e.message || "ارتباط برقرار نشد؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  };
  const savePermanentPassword = async (event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setError('');
    const data=new FormData(event.currentTarget);
    const next=String(data.get('newPassword')||''),confirm=String(data.get('confirmPassword')||'');
    if(next.length<12){setError('رمز جدید باید حداقل ۱۲ نویسه باشد.');return;}
    if(next!==confirm){setError('تکرار رمز جدید یکسان نیست.');return;}
    setBusy(true);
    try{
      const response=await portalRequest({action:'initial_password_change',password:next});
      if(!response.success){setError(response.message||'تغییر رمز انجام نشد.');return;}
      await hydratePortal();
      setMustChange(false);auth.setLatestCredentials(null);
      go(response.user||{...auth.currentUser,mustChangePassword:false});
    }catch(e:any){setError(e?.message||'تغییر رمز انجام نشد.');}
    finally{setBusy(false);}
  };
  const password = (name: string, label: string, confirm = false) => (
    <label>
      {label}
      <div className="account-password">
        <input
          name={name}
          autoComplete={
            mode === "register" ? "new-password" : "current-password"
          }
          type={visible ? "text" : "password"}
          minLength={mode === "register" ? 10 : undefined}
          maxLength={128}
          required
          dir="ltr"
        />
        {!confirm && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "پنهان کردن رمز" : "نمایش رمز"}
          >
            {visible ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        )}
      </div>
    </label>
  );
  if(mustChange) return (
    <div dir="rtl" className="flex min-h-[72vh] items-center justify-center bg-[#F7F8FA] px-3 py-8">
      <form onSubmit={savePermanentPassword} className="w-full max-w-lg space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-9">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-orange-100 p-3 text-[#E56B1E]"><ShieldCheck size={26}/></div>
          <div><h1 className="text-xl font-black text-slate-800">تنظیم رمز دائمی حساب صنعت پیش</h1>
            <p className="mt-1 text-xs leading-6 text-slate-500">برای امنیت حساب، رمز اولیه‌ای که مدیریت تعیین کرده باید در اولین ورود تغییر کند.</p>
          </div>
        </div>
        <label className="block space-y-2 text-sm font-bold text-slate-700">رمز عبور جدید
          <input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" dir="ltr"
            className="h-12 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#E56B1E]"/>
        </label>
        <label className="block space-y-2 text-sm font-bold text-slate-700">تکرار رمز جدید
          <input name="confirmPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" dir="ltr"
            className="h-12 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-[#E56B1E]"/>
        </label>
        {error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-xs leading-6 text-red-700">{error}</p>}
        <button type="submit" disabled={busy} className="w-full rounded-xl bg-[#E56B1E] px-5 py-3 text-sm font-bold text-white disabled:opacity-60">
          {busy?'در حال ذخیره...':'تغییر رمز و ورود به پنل'}
        </button>
        <button type="button" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
          onClick={()=>{auth.logout();setMustChange(false);setMode('login');}}>خروج از حساب</button>
      </form>
    </div>
  );
  return (
    <div className="account-access">
      <aside className="account-access-story">
        <img src={A.authIndustrialHero} alt="" />
        <div>
          <span className="account-symbol" aria-hidden="true"><Layers size={26} /></span>
          <span className="inline-flex items-center justify-center w-36 h-14 rounded-xl bg-white/95 p-2">
            <SanatPishLogo className="w-full h-full object-contain" alt="لوگوی صنعت پیش" />
          </span>
          <h2>
            از انتخاب هوشمند
            <br />
            تا خرید مطمئن.
          </h2>
          <ul>
            {[
              "قیمت و موجودی در پنل شما",
              "استعلام با کد دقیق کالا",
              "پیگیری سفارش و باشگاه مشتریان",
            ].map((t) => (
              <li key={t}>
                <CheckCircle2 size={17} />
                {t}
              </li>
            ))}
          </ul>
          <Link to="/about" onClick={onDone}>
            آشنایی با صنعت پیش <ArrowLeft size={17} />
          </Link>
        </div>
      </aside>
      <section className="account-access-form">
        <div className="account-form-heading">
          <span className="store-eyebrow">
            با صنعت پیش، هوشمندانه پیش بروید
          </span>
          <h1>
            {mode === "login" ? "ورود به حساب شما" : "شروع همکاری با صنعت پیش"}
          </h1>
          <p>
            {mode === "login"
              ? "با شماره موبایل یا نام کاربری وارد شوید."
              : "اطلاعات کسب‌وکار، تأیید موبایل، سپس انتخاب نام کاربری و رمز عبور."}
          </p>
        </div>
        <div
          className="account-tabs"
          role="group"
          aria-label="انتخاب ورود یا ثبت‌نام"
        >
          {(["login", "register"] as const).map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => {
                setMode(m);
                setStep(1);
                setRequiresVerification(false);
                setRegistrationDemoOnly(false);
                setError("");
              }}
            >
              {m === "login" ? "ورود" : "ساخت حساب"}
            </button>
          ))}
        </div>
        {mode === "login" && (
          <div className="login-methods" role="group" aria-label="روش ورود">
            <button
              aria-pressed={method === "password"}
              onClick={() => {
                setMethod("password");
                setError("");
              }}
            >
              با رمز عبور
            </button>
            <button
              aria-pressed={method === "sms"}
              onClick={() => {
                setMethod("sms");
                setError("");
              }}
            >
              با کد پیامکی
            </button>
          </div>
        )}
        {mode === "login" && method === "sms" ? (
          <PhoneLogin initialPhone={requiresVerification?details.mobile:undefined} initialSent={requiresVerification&&!registrationDemoOnly} demoOnly={registrationDemoOnly} onSuccess={(user,pending)=>{if(pending){setRequiresVerification(false);setMode('register');setStep(2);}else if((user as typeof user & {mustChangePassword?:boolean}).mustChangePassword===true){setMustChange(true);setMode('login');setMethod('password');}else go(user);}} />
        ) : (
          <form onSubmit={submit} className="account-fields">
            {mode === "login" ? (
              <>
                <label>
                  موبایل یا نام کاربری
                  <input
                    name="identifier"
                    autoComplete="username"
                    dir="ltr"
                    required
                    placeholder="09123456789"
                  />
                </label>
                {password("password", "رمز عبور")}
                <p className="account-help">
                  رمز عبور خود را وارد کنید؛ امکان ورود با کد پیامکی هم وجود
                  دارد. برای راهنمایی با{" "}
                  <Link to="/contact" onClick={onDone}>
                    پشتیبانی
                  </Link>{" "}
                  تماس بگیرید.
                </p>
              </>
            ) : (
              <>
                <div className="registration-progress">
                  <span data-active={step === 1}>۱. اطلاعات کسب‌وکار</span>
                  <i />
                  <span>۲. تأیید موبایل</span>
                  <i />
                  <span data-active={step === 2}>۳. اطلاعات ورود</span>
                </div>
                {step === 1 ? (
                  <>
                    <div className="account-field-pair">
                      <label>
                        نام
                        <input
                          name="firstName"
                          autoComplete="given-name"
                          defaultValue={details.firstName}
                          required
                        />
                      </label>
                      <label>
                        نام خانوادگی
                        <input
                          name="lastName"
                          autoComplete="family-name"
                          defaultValue={details.lastName}
                          required
                        />
                      </label>
                    </div>
                    <label>
                      شماره موبایل
                      <input
                        name="mobile"
                        type="tel"
                        inputMode="tel"
                        dir="ltr"
                        autoComplete="tel"
                        defaultValue={details.mobile}
                        placeholder="09123456789"
                        required
                      />
                    </label>
                    <label>
                      نام شرکت، کارخانه یا فروشگاه
                      <input
                        name="companyName"
                        autoComplete="organization"
                        defaultValue={details.companyName}
                        required
                      />
                    </label>
                    <div className="account-field-pair">
                      <label>
                        استان
                        <select
                          aria-label="استان"
                          value={province}
                          required
                          onChange={(e) => {
                            setProvince(e.target.value);
                            setCity("");
                          }}
                        >
                          <option value="">انتخاب استان</option>
                          {IRAN_PROVINCES.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        شهر
                        <select
                          aria-label="شهر"
                          value={city}
                          required
                          disabled={!province}
                          onChange={(e) => setCity(e.target.value)}
                        >
                          <option value="">انتخاب شهر</option>
                          {IRAN_PROVINCES.find(
                            (p) => p.id === province,
                          )?.cities.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <label>
                      زمینه فعالیت
                      <select
                        aria-label="زمینه فعالیت"
                        name="activityField"
                        required
                        defaultValue={details.activityField || ""}
                      >
                        <option value="">انتخاب زمینه فعالیت</option>
                        {ACTIVITY_FIELDS.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      ایمیل <small>اختیاری</small>
                      <input
                        name="email"
                        type="email"
                        dir="ltr"
                        autoComplete="email"
                        defaultValue={details.email}
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <label>
                      نام کاربری
                      <input
                        name="username"
                        autoComplete="username"
                        dir="ltr"
                        pattern="[a-zA-Z][a-zA-Z0-9_]{3,31}"
                        minLength={4}
                        maxLength={32}
                        required
                        placeholder="company_name"
                      />
                      <small>
                        ۴ تا ۳۲ حرف انگلیسی، عدد یا زیرخط؛ شروع با حرف
                      </small>
                    </label>
                    {password("password", "رمز عبور")}
                    <p className="account-help">
                      حداقل ۱۰ نویسه و متفاوت با شماره موبایل
                    </p>
                    {password("confirmPassword", "تکرار رمز عبور", true)}
                    <button
                      type="button"
                      className="editorial-text-link"
                      onClick={() => {
                        setStep(1);
                        setError("");
                      }}
                    >
                      اصلاح اطلاعات کسب‌وکار
                    </button>
                  </>
                )}
              </>
            )}
            {error && (
              <p role="alert" className="account-error">
                {error}
              </p>
            )}
            <button
              className="store-btn-primary account-submit"
              disabled={busy}
            >
              {busy
                ? "در حال بررسی…"
                : mode === "login"
                  ? "ورود به پنل"
                  : step === 1
                    ? "ادامه و دریافت کد تأیید"
                    : "ذخیره اطلاعات ورود و ادامه"}
              <ArrowLeft size={17} />
            </button>
          </form>
        )}
        <div className="account-privacy">
          <ShieldCheck size={17} />
          <p>
            مشخصات محصولات برای همه قابل بررسی است؛ قیمت، موجودی و استعلام پس از
            ورود در پنل نمایش داده می‌شود.
          </p>
        </div>
      </section>
    </div>
  );
}
