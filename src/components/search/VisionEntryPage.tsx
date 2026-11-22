import React from 'react';
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Focus,
  Loader2,
  ScanSearch,
  ShieldCheck,
  UploadCloud,
} from 'lucide-react';
import {
  BeltIcon,
  BearingIcon,
  ChainCouplingIcon,
  PulleyIcon,
} from '../forza/ForzaWorkspaceIcons';
import { IMAGES } from '../../assets/images';

interface VisionEntryPageProps {
  onCamera: () => void;
  onUpload: () => void;
  onClose: () => void;
  errorMessage?: string;
  isUploading?: boolean;
}

/**
 * Presentation-only entry screen for the standalone FORZA VISION route.
 * Camera, upload, analysis, privacy and catalogue behaviour remain owned by
 * AiVisualPartSearchModal; this component only invokes the existing handlers.
 */
export const VisionEntryPage: React.FC<VisionEntryPageProps> = ({
  onCamera,
  onUpload,
  onClose,
  errorMessage = '',
  isUploading = false,
}) => {
  const industrialImage = IMAGES.authIndustrialHero || IMAGES.refineryDuskWide;
  const bearingImage = IMAGES.products.bearingNsk || IMAGES.products.bearing;

  return (
    <main
      dir="rtl"
      data-testid="forza-vision-entry"
      className="min-h-[100dvh] w-full bg-[#F6F7F6] text-[#2B313A]"
    >
      <header className="border-b border-[#E5E7E8] bg-white">
        <div className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/images/brand/forza-emblem.webp"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span className="h-8 w-px bg-[#E5E7E8]" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block text-[11px] font-black tracking-[0.16em] text-[#E06518]">
                FORZA VISION
              </span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-[#55565A] sm:text-sm">
                آزمایشگاه شناسایی تصویری قطعات صنعتی
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-[#DFE3E6] bg-white px-3 text-xs font-bold text-[#55565A] transition-colors hover:border-[#E06518] hover:text-[#E06518] sm:px-4"
            aria-label="بازگشت از شناسایی تصویری"
          >
            <ArrowRight size={16} aria-hidden="true" />
            <span>بازگشت</span>
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-12 lg:gap-5">
          <section className="flex min-w-0 flex-col justify-between rounded-3xl border border-[#E3E6E7] bg-white p-5 shadow-[0_12px_36px_-24px_rgba(33,43,54,0.28)] sm:p-7 lg:col-span-7 lg:p-9">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F2D6C4] bg-[#FFF6F0] px-3 py-1.5 text-[10px] font-extrabold tracking-[0.12em] text-[#A94E19] sm:text-[11px]">
                <ScanSearch size={14} aria-hidden="true" />
                INDUSTRIAL PART IDENTIFICATION
              </div>

              <h1 className="mt-5 max-w-2xl text-[25px] font-black leading-[1.55] tracking-tight text-[#252D36] sm:text-3xl lg:text-[38px] lg:leading-[1.45]">
                قطعه صنعتی را با <span className="text-[#E06518]">یک تصویر</span> پیدا کنید
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[#68727C] sm:text-[15px]">
                از قطعه عکس بگیرید یا تصویر واقعی آن را بارگذاری کنید. ناحیه موردنظر را بازبینی کنید
                تا سامانه آن را با اطلاعات و تصاویر کاتالوگ صنعت پیش مقایسه کند.
              </p>

              {errorMessage && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs font-semibold leading-6 text-rose-700"
                >
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={onCamera}
                  disabled={isUploading}
                  className="inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl bg-[#E06518] px-5 text-sm font-extrabold text-white shadow-[0_8px_20px_-10px_rgba(224,101,24,0.7)] transition-colors hover:bg-[#C95210] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  {isUploading ? <Loader2 size={19} className="animate-spin" /> : <Camera size={19} />}
                  <span>شروع اسکن با دوربین</span>
                </button>
                <button
                  type="button"
                  onClick={onUpload}
                  disabled={isUploading}
                  className="inline-flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl border border-[#DDE2E4] bg-[#F8F9F8] px-5 text-sm font-bold text-[#35404A] transition-colors hover:border-[#E06518] hover:bg-[#FFF7F1] hover:text-[#A94E19] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <UploadCloud size={19} aria-hidden="true" />
                  <span>انتخاب تصویر از دستگاه</span>
                </button>
              </div>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-2 border-t border-[#EEF0F0] pt-5 sm:grid-cols-3">
              <div className="flex items-center gap-2.5 rounded-xl bg-[#F8F9F8] px-3 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#E06518]">
                  <Focus size={17} aria-hidden="true" />
                </span>
                <span className="text-[11px] font-bold leading-5 text-[#4B5660]">انتخاب دقیق ناحیه قطعه</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#F8F9F8] px-3 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#E06518]">
                  <ShieldCheck size={17} aria-hidden="true" />
                </span>
                <span className="text-[11px] font-bold leading-5 text-[#4B5660]">مقایسه با کاتالوگ واقعی</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-xl bg-[#F8F9F8] px-3 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[#E06518]">
                  <CheckCircle2 size={17} aria-hidden="true" />
                </span>
                <span className="text-[11px] font-bold leading-5 text-[#4B5660]">بازبینی نتیجه پیش از ادامه</span>
              </div>
            </div>
          </section>

          <section className="relative flex min-h-[300px] min-w-0 flex-col justify-between overflow-hidden rounded-3xl bg-[#202C37] p-5 text-white sm:min-h-[350px] sm:p-7 lg:col-span-5 lg:min-h-[440px]">
            {industrialImage && (
              <img
                src={industrialImage}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full object-cover opacity-35"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-[#17212B] via-[#202C37]/65 to-[#202C37]/35" aria-hidden="true" />
            <div className="relative z-10 flex items-center justify-between gap-3">
              <span className="rounded-full border border-white/20 bg-black/20 px-3 py-1.5 text-[10px] font-bold tracking-[0.14em] text-white/85">
                FORZA / VISION SYSTEM
              </span>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white/75">
                <span className="h-2 w-2 rounded-full bg-[#F28A3B]" />
                آماده دریافت تصویر
              </span>
            </div>

            <div className="relative z-10 mx-auto my-5 flex w-full max-w-[260px] flex-1 items-center justify-center">
              <div className="absolute inset-5 rounded-[28px] border border-[#F28A3B]/35" aria-hidden="true" />
              <span className="absolute left-3 top-3 h-8 w-8 rounded-tl-xl border-l-2 border-t-2 border-[#F28A3B]" aria-hidden="true" />
              <span className="absolute right-3 top-3 h-8 w-8 rounded-tr-xl border-r-2 border-t-2 border-[#F28A3B]" aria-hidden="true" />
              <span className="absolute bottom-3 left-3 h-8 w-8 rounded-bl-xl border-b-2 border-l-2 border-[#F28A3B]" aria-hidden="true" />
              <span className="absolute bottom-3 right-3 h-8 w-8 rounded-br-xl border-b-2 border-r-2 border-[#F28A3B]" aria-hidden="true" />
              {bearingImage && (
                <img
                  src={bearingImage}
                  alt="نمونه تصویری یک قطعه صنعتی"
                  className="relative z-10 max-h-[220px] w-[72%] object-contain drop-shadow-[0_16px_28px_rgba(0,0,0,0.42)]"
                />
              )}
              <span className="absolute bottom-5 right-0 rounded-lg border border-white/15 bg-[#18232D]/90 px-2.5 py-1.5 font-mono text-[10px] text-[#FFC18F]">
                OBJECT / DETECT
              </span>
            </div>

            <div className="relative z-10 border-t border-white/15 pt-4">
              <h2 className="text-base font-extrabold sm:text-lg">از تصویر تا قطعه منطبق</h2>
              <p className="mt-1.5 text-xs leading-6 text-white/70">
                تصویر، ناحیه انتخاب‌شده و نتیجه تطبیق در یک جریان مشخص بررسی می‌شوند؛
                نتیجه‌های پیشنهادی برای بررسی فنی و مقایسه نمایش داده می‌شوند.
              </p>
              <div className="mt-4 grid grid-cols-4 gap-2 text-center">
                <div className="flex flex-col items-center gap-1.5 text-white/85">
                  <BeltIcon size={21} className="text-[#F3A46C]" />
                  <span className="text-[10px] font-bold">تسمه</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-white/85">
                  <PulleyIcon size={21} className="text-[#F3A46C]" />
                  <span className="text-[10px] font-bold">پولی</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-white/85">
                  <BearingIcon size={21} className="text-[#F3A46C]" />
                  <span className="text-[10px] font-bold">بلبرینگ</span>
                </div>
                <div className="flex flex-col items-center gap-1.5 text-white/85">
                  <ChainCouplingIcon size={21} className="text-[#F3A46C]" />
                  <span className="text-[10px] font-bold">کوپلینگ</span>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-3xl border border-[#E3E6E7] bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold tracking-[0.14em] text-[#E06518]">HOW IT WORKS</span>
              <h2 className="mt-1 text-base font-extrabold text-[#2B313A] sm:text-lg">فرآیند شناسایی در سه مرحله</h2>
            </div>
            <span className="text-[11px] font-semibold text-[#7A838A]">بدون ورود دستی کد فنی در شروع کار</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl bg-[#F7F8F7] p-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF0E6] text-sm font-black text-[#B45117]">۱</span>
              <div>
                <h3 className="text-xs font-extrabold text-[#35404A]">ثبت تصویر</h3>
                <p className="mt-1 text-[11px] leading-5 text-[#77818A]">با دوربین یا از طریق فایل تصویری دستگاه.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-[#F7F8F7] p-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF0E6] text-sm font-black text-[#B45117]">۲</span>
              <div>
                <h3 className="text-xs font-extrabold text-[#35404A]">بازبینی ناحیه</h3>
                <p className="mt-1 text-[11px] leading-5 text-[#77818A]">بخش موردنظر را تأیید یا اصلاح کنید.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-[#F7F8F7] p-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF0E6] text-sm font-black text-[#B45117]">۳</span>
              <div>
                <h3 className="text-xs font-extrabold text-[#35404A]">تطبیق کاتالوگ</h3>
                <p className="mt-1 text-[11px] leading-5 text-[#77818A]">گزینه‌های منطبق برای بررسی فنی نمایش داده می‌شوند.</p>
              </div>
            </div>
          </div>
        </section>

        <footer className="py-5 text-center text-[10px] font-medium text-[#8A9298]">
          صنعت پیش · شناسایی تصویری قطعات صنعتی با FORZA
        </footer>
      </div>
    </main>
  );
};
