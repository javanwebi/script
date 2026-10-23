import React, { useEffect, useState } from "react";
import {Link} from "react-router-dom";
import { ArrowLeft, RotateCcw, Smartphone } from "lucide-react";
import { portalRequest, hydratePortal } from "../../services/portalRepository";
import { Customer } from "../../types";
export function PhoneLogin({
  onSuccess,initialPhone="",initialSent=false,demoOnly=false,
}: {
  initialPhone?:string;initialSent?:boolean;demoOnly?:boolean;
  onSuccess: (user: Customer, requiresCredentials?: boolean) => void;
}) {
  const [phone, setPhone] = useState(initialPhone),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [mustRegister, setMustRegister] = useState(false);
  const [devOtp, setDevOtp] = useState<{code:string;requestId:string}|null>(null);
  const [sent, setSent] = useState(initialSent),
    [busy, setBusy] = useState(false),
    [seconds, setSeconds] = useState(initialSent?60:0);
  useEffect(() => {
    if (!seconds) return;
    const timer = setTimeout(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);
  const request = async () => {
    setBusy(true);
    setError("");
    setMustRegister(false);
    try {
      let r;
      if (demoOnly && import.meta.env.DEV) {
        r = await portalRequest({ action: "dev_otp_request", phone });
      } else {
        try { r = await portalRequest({ action: "otp_request", phone }); }
        catch (error) {
          if (!import.meta.env.DEV) throw error;
          r = await portalRequest({ action: "dev_otp_request", phone });
        }
      }
      setDevOtp(r.preview === true ? {code:r.devCode,requestId:r.requestId} : null);
      setSent(true);
      setSeconds(r.retryAfter || 60);
      setNotice(r.message);
    } catch (e: any) {
      const message=e.message || "ارسال پیامک انجام نشد.";
      setMustRegister(message.includes("ابتدا ثبت‌نام کنید"));
      setError(message);
    } finally {
      setBusy(false);
    }
  };
  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sent) return request();
    setBusy(true);
    setError("");
    try {
      if(devOtp){
        const r = await portalRequest({ action: "dev_otp_verify", phone, code, requestId:devOtp.requestId });
        if(r.previewVerified){setNotice(r.message);setDevOtp(null);setSent(false);setCode("");}
        return;
      }
      const r = await portalRequest({ action: "otp_verify", phone, code });
      await hydratePortal();
      onSuccess(r.user,r.requiresCredentials);
    } catch (e: any) {
      setError(e.message || "کد معتبر نیست.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="account-fields" onSubmit={verify}>
      <label>
        شماره موبایل ثبت‌شده
        <input
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="tel"
          required
          value={phone}
          disabled={sent}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="09123456789"
        />
      </label>
      {sent && (
        <>
          <p role="status" className="account-help">
            {notice || "کد ارسال‌شده به شماره موبایل خود را وارد کنید."}
          </p>
          {devOtp && (
            <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center space-y-2">
              <p className="text-xs font-bold text-amber-900">کد تأیید آزمایشی — فقط محیط توسعه محلی</p>
              <strong dir="ltr" className="block text-3xl tracking-[0.3em] tabular-nums text-[#55565A] select-all">{devOtp.code}</strong>
              <p className="text-[11px] text-amber-800 leading-5">برای آزمایش فرم، این کد را پایین وارد کنید. شماره موبایل در واقعیت تأیید نمی‌شود و حساب یا نشست ورود ساخته نمی‌شود.</p>
              <button type="button" onClick={()=>setCode(devOtp.code)} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-amber-900">قراردادن کد در کادر</button>
            </div>
          )}
          <label>
            کد شش‌رقمی
            <input
              autoFocus
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              minLength={6}
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="------"
            />
          </label>
          <div className="otp-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setSent(false);
                setCode("");
                setError("");
                setDevOtp(null);
              }}
            >
              اصلاح شماره
            </button>
            <button
              type="button"
              disabled={busy || seconds > 0}
              onClick={request}
            >
              <RotateCcw size={14} />
              {seconds
                ? `ارسال مجدد تا ${seconds.toLocaleString("fa-IR")} ثانیه`
                : "ارسال مجدد کد"}
            </button>
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="account-error">
          {error}
        </p>
      )}
      {mustRegister && <Link to="/register" className="store-btn-primary account-submit">انتقال به صفحه ثبت‌نام <ArrowLeft size={17}/></Link>}
      <button className="store-btn-primary account-submit" disabled={busy}>
        {busy ? "در حال بررسی…" : sent ? (devOtp ? "بررسی کد آزمایشی" : "تأیید کد و ورود") : demoOnly ? "دریافت کد تست در همین صفحه" : "دریافت کد پیامکی"}
        {sent ? <ArrowLeft size={17} /> : <Smartphone size={17} />}
      </button>
    </form>
  );
}
