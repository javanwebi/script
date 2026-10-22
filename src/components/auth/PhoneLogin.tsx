import React, { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw, Smartphone } from "lucide-react";
import { portalRequest, hydratePortal } from "../../services/portalRepository";
import { Customer } from "../../types";
export function PhoneLogin({
  onSuccess,initialPhone="",initialSent=false,
}: {
  initialPhone?:string;initialSent?:boolean;
  onSuccess: (user: Customer, requiresCredentials?: boolean) => void;
}) {
  const [phone, setPhone] = useState(initialPhone),
    [code, setCode] = useState(""),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
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
    try {
      let r;
      try { r = await portalRequest({ action: "otp_request", phone }); }
      catch (error) {
        if (!import.meta.env.DEV) throw error;
        r = await portalRequest({ action: "dev_otp_request", phone });
      }
      setDevOtp(r.preview === true ? {code:r.devCode,requestId:r.requestId} : null);
      setSent(true);
      setSeconds(r.retryAfter || 60);
      setNotice(r.message);
    } catch (e: any) {
      setError(e.message || "ارسال پیامک انجام نشد.");
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
          {devOtp && <p role="status" className="account-help">کد آزمایشی محیط توسعه: <strong dir="ltr">{devOtp.code}</strong> — ورود واقعی ایجاد نمی‌شود.</p>}
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
      <button className="store-btn-primary account-submit" disabled={busy}>
        {busy ? "در حال بررسی…" : sent ? "تأیید کد و ورود" : "دریافت کد پیامکی"}
        {sent ? <ArrowLeft size={17} /> : <Smartphone size={17} />}
      </button>
    </form>
  );
}
