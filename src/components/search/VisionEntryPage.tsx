import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  Focus,
  Image as GalleryImage,
  Search,
  Sparkles,
  UploadCloud,
} from 'lucide-react';
import {
  BeltIcon,
  BearingIcon,
  ChainCouplingIcon,
  PulleyIcon,
} from '../forza/ForzaWorkspaceIcons';

interface VisionEntryPageProps {
  onCamera: () => void;
  onUpload: () => void;
  onClose: () => void;
  onDropFile?: (file: File) => void;
  errorMessage?: string;
  isUploading?: boolean;
}

/**
 * KIKI-aligned FORZA VISION entry presentation.
 * All image handling, device-only storage, camera capture and matching remain
 * owned by AiVisualPartSearchModal through the callbacks passed into this view.
 */
export const VisionEntryPage: React.FC<VisionEntryPageProps> = ({
  onCamera,
  onUpload,
  onClose,
  onDropFile,
  errorMessage = '',
  isUploading = false,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <main
      dir="rtl"
      data-testid="forza-vision-entry"
      className="min-h-[100dvh] w-full bg-white text-[#2B313A]"
    >
      <header className="shrink-0 border-b border-[#DFE3E6] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-[72px] sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <img
              src="/images/brand/logo-forza.webp"
              alt="FORZA"
              className="h-9 sm:h-11 w-auto shrink-0 object-contain"
            />
            <span className="h-7 w-px bg-[#DFE3E6]" aria-hidden="true" />
            <div className="min-w-0">
              <span className="block whitespace-nowrap text-xs font-black tracking-[0.14em] text-[#2B313A] sm:text-sm">
                FORZA VISION
              </span>
              <p className="hidden whitespace-nowrap text-[11px] text-[#74757C] sm:block">
                سامانه بینایی ماشین و تطبیق قطعات صنعتی
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border border-[#DFE3E6] bg-[#F5F6F6] px-3 text-xs font-bold text-[#2B313A] transition-colors hover:border-[#E06518] hover:text-[#E06518] sm:px-4"
            aria-label="بازگشت از شناسایی تصویری"
          >
            <ArrowRight size={16} aria-hidden="true" />
            <span>بازگشت</span>
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-7 lg:py-8">
        {errorMessage && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-rose-700"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12 lg:gap-7"
        >
          <section
            data-testid="forza-vision-upload-panel"
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setIsDragOver(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragOver(false);
              const file = event.dataTransfer.files?.[0];
              if (file) onDropFile?.(file);
            }}
            className={
              'relative flex min-w-0 flex-col justify-between overflow-hidden rounded-3xl border p-5 transition-colors sm:p-8 lg:col-span-7 ' +
              (isDragOver ? 'border-[#E06518] bg-[#FFF4EC]' : 'border-[#DFE3E6] bg-[#F5F6F6]')
            }
          >
            <div
              className="pointer-events-none absolute inset-0 opacity-40"
              aria-hidden="true"
              style={{
                backgroundImage:
                  'linear-gradient(#dfe3e6 1px, transparent 1px), linear-gradient(90deg, #dfe3e6 1px, transparent 1px)',
                backgroundSize: '40px 40px',
                maskImage: 'linear-gradient(135deg, #000, transparent 58%)',
              }}
            />

            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-2 text-xs font-bold text-[#E06518]">
                <Focus size={17} aria-hidden="true" />
                <span>تشخیص ناحیه قطعه و کد فنی</span>
              </div>

              <h1 className="text-xl font-black leading-snug text-[#2B313A] sm:text-3xl lg:text-[34px]">
                قطعه را با یک عکس بشناسید و نمونه مشابه را پیدا کنید
              </h1>
              <p className="mt-2.5 text-xs leading-relaxed text-[#55565A] sm:text-sm">
                تصویر را اینجا رها کنید یا مستقیماً عکس بگیرید؛ ناحیه قطعه انتخاب می‌شود و با تصاویر واقعی کاتالوگ اطلس مقایسه خواهد شد.
              </p>

              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={onCamera}
                  disabled={isUploading}
                  className="inline-flex h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl bg-[#E06518] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#C95210] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <Camera className="h-5 w-5" aria-hidden="true" />
                  <span>شروع اسکن با دوربین</span>
                </button>
                <button
                  type="button"
                  onClick={onUpload}
                  disabled={isUploading}
                  className="inline-flex h-12 items-center justify-center gap-2.5 whitespace-nowrap rounded-2xl border border-[#DFE3E6] bg-white px-6 text-sm font-bold text-[#2B313A] transition-colors hover:border-[#2B313A] disabled:cursor-not-allowed disabled:opacity-55"
                >
                  <GalleryImage className="h-5 w-5 text-[#E06518]" aria-hidden="true" />
                  <span>انتخاب تصویر از دستگاه</span>
                </button>
              </div>

              <p className="mt-3 flex items-center gap-1.5 text-[11px] text-[#74757C] sm:text-xs">
                <UploadCloud className="h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                <span>JPG، PNG و WebP تا ۱۰ مگابایت · امکان کشیدن و رها کردن تصویر</span>
              </p>

              {isDragOver && (
                <div className="mt-4 rounded-2xl border border-[#E06518] bg-white/85 px-4 py-3 text-center text-xs font-bold text-[#C95210]">
                  تصویر را رها کنید تا برای شناسایی آماده شود
                </div>
              )}
            </div>

            <div className="relative mt-7 divide-y divide-[#DFE3E6] border-t border-[#DFE3E6] pt-2">
              <div className="flex items-start gap-2.5 py-2.5">
                <Focus className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                <span className="text-xs font-bold leading-relaxed text-[#2B313A]">
                  برای تسمه‌ها: از روبه‌رو و نزدیکِ برند و نوشته‌های واقعی روی بدنه عکس بگیرید
                </span>
              </div>
              <div className="flex items-start gap-2.5 py-2.5">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                <span className="text-xs leading-relaxed text-[#55565A]">
                  انتخاب ناحیه قطعه با لمس یا کشیدن کادر؛ بدون تغییر تصویر اصلی
                </span>
              </div>
              <div className="flex items-start gap-2.5 py-2.5">
                <Search className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                <span className="text-xs leading-relaxed text-[#55565A]">
                  نمایش گزینه‌های مشابه از کاتالوگ و بررسی کد و مشخصات پیش از سفارش
                </span>
              </div>
            </div>
          </section>

          <section className="relative flex min-h-[300px] min-w-0 flex-col justify-between gap-4 overflow-hidden rounded-3xl border border-[#DFE3E6] bg-[#2B313A] p-5 text-white sm:min-h-[390px] sm:p-7 lg:col-span-5">
            <img
              src="/images/company/ai-search-mobile.webp"
              alt="جستجوی تصویری قطعات صنعتی فورزا"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181C22]/95 via-[#181C22]/45 to-[#181C22]/20" aria-hidden="true" />

            <div className="relative z-10 flex items-center justify-between gap-3 text-[11px] font-mono text-white/85">
              <span className="rounded-full bg-[#181C22]/75 px-2.5 py-1.5 backdrop-blur-sm">
                LOCAL LENS · CATALOG MATCH
              </span>
              <span className="h-2 w-2 shrink-0 rounded-full bg-[#E06518]" aria-label="سامانه آماده است" />
            </div>

            <div className="relative z-10 mt-auto text-white">
              <h2 className="text-sm font-extrabold sm:text-base">
                شناسایی قطعه و تطبیق با کاتالوگ واقعی
              </h2>
              <p className="mt-1 text-xs leading-6 text-slate-200">
                تصویر مشتری، ناحیه انتخاب‌شده و شواهد کاتالوگ در یک جریان مشخص بررسی می‌شوند.
              </p>

              <div className="mt-5 grid grid-cols-4 gap-2 rounded-2xl border border-white/15 bg-[#18232D]/70 p-2.5 text-center backdrop-blur-sm">
                <div className="flex flex-col items-center gap-1 py-1">
                  <BeltIcon size={18} className="text-[#F3A46C]" />
                  <span className="text-[11px] font-bold">تسمه</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-1">
                  <PulleyIcon size={18} className="text-[#F3A46C]" />
                  <span className="text-[11px] font-bold">پولی</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-1">
                  <BearingIcon size={18} className="text-[#F3A46C]" />
                  <span className="text-[11px] font-bold">بلبرینگ</span>
                </div>
                <div className="flex flex-col items-center gap-1 py-1">
                  <ChainCouplingIcon size={18} className="text-[#F3A46C]" />
                  <span className="text-[11px] font-bold">کوپلینگ</span>
                </div>
              </div>
            </div>
          </section>
        </motion.div>

        <section className="mt-6 rounded-3xl border border-[#DFE3E6] bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <span className="text-[10px] font-extrabold tracking-[0.14em] text-[#E06518]">HOW IT WORKS</span>
              <h2 className="mt-1 text-base font-extrabold text-[#2B313A] sm:text-lg">
                فرآیند شناسایی در سه مرحله
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-[#74757C]">
              نتیجه نهایی پیش از سفارش قابل بازبینی است
            </span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-start gap-3 rounded-2xl bg-[#F5F6F6] p-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF0E6] text-sm font-black text-[#B45117]">۱</span>
              <div>
                <h3 className="text-xs font-extrabold text-[#35404A]">ثبت تصویر</h3>
                <p className="mt-1 text-[11px] leading-5 text-[#74757C]">با دوربین یا از طریق فایل تصویری دستگاه.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-[#F5F6F6] p-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF0E6] text-sm font-black text-[#B45117]">۲</span>
              <div>
                <h3 className="text-xs font-extrabold text-[#35404A]">بازبینی ناحیه</h3>
                <p className="mt-1 text-[11px] leading-5 text-[#74757C]">بخش موردنظر را تأیید یا اصلاح کنید.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 rounded-2xl bg-[#F5F6F6] p-3.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#FFF0E6] text-sm font-black text-[#B45117]">۳</span>
              <div>
                <h3 className="text-xs font-extrabold text-[#35404A]">تطبیق کاتالوگ</h3>
                <p className="mt-1 text-[11px] leading-5 text-[#74757C]">گزینه‌های معتبر برای بررسی فنی نمایش داده می‌شوند.</p>
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
