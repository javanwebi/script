import React, { useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, ArrowRight, Camera, Image as GalleryImage, UploadCloud, Focus, Search, Sparkles, History, ChevronLeft } from 'lucide-react';
import { VisualScannerIcon, BeltIcon, PulleyIcon, BearingIcon, ChainCouplingIcon } from '../forza/ForzaWorkspaceIcons';
import { toPersianDigits } from '../../utils/formatters';
import { formatVisionRecentTime, type VisionRecentSearchItem } from './visionRecentHistory';

interface VisionEntryPageProps {
  onCamera: () => void;
  onUpload: () => void;
  onClose: () => void;
  onDropFile?: (file: File) => void;
  errorMessage?: string;
  isUploading?: boolean;
  recentSearches?: VisionRecentSearchItem[];
  onRecentClick?: (item: VisionRecentSearchItem) => void;
}

/** Exact KIKI entrance JSX, adapted only at interaction boundaries for the production VISION service. */
export const VisionEntryPage: React.FC<VisionEntryPageProps> = ({
  onCamera, onUpload, onClose, onDropFile, errorMessage = '',
  isUploading = false, recentSearches = [], onRecentClick,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const displayedRecentSearches = showAllHistory ? recentSearches : recentSearches.slice(0, 6);
  return (
        <div dir="rtl" data-testid="forza-vision-entry" className="flex min-h-[100dvh] flex-col bg-[#FFFFFF] text-[#2B313A]">
          {/* Clean Branded Header */}
          <header className="border-b border-[#DFE3E6] bg-[#FFFFFF] shrink-0">
            <div className="mx-auto flex h-16 sm:h-18 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
              <div className="flex items-center gap-3">
                <img
                  src="/images/brand/logo-forza.webp"
                  alt="FORZA"
                  className="h-9 sm:h-11 w-auto object-contain"
                />
                <span className="h-6 w-px bg-[#DFE3E6]" aria-hidden="true" />
                <div>
                  <span className="block text-xs sm:text-sm font-extrabold tracking-tight text-[#2B313A] whitespace-nowrap">
                    FORZA VISION
                  </span>
                  <p className="hidden sm:block text-[11px] text-[#74757C] whitespace-nowrap">
                    سامانه بینایی ماشین و تطبیق قطعات صنعتی
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#DFE3E6] bg-[#F5F6F6] px-4 text-xs font-bold text-[#2B313A] transition-colors hover:border-[#E06518] hover:text-[#E06518] whitespace-nowrap cursor-pointer"
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                <span>بازگشت</span>
              </button>
            </div>
          </header>

          <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-5 sm:px-6 lg:py-8">
            {errorMessage && (
              <div className="mb-5 flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-3.5 text-xs font-bold text-rose-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Top-to-Bottom Smooth Studio Reveal */}
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-12 lg:gap-7"
            >
              {/* Primary Action & Upload Zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const f = e.dataTransfer.files?.[0];
                  if (f) onDropFile?.(f);
                }}
                data-testid="forza-vision-upload-panel"
                className={`relative overflow-hidden flex flex-col justify-between rounded-3xl border p-5 sm:p-8 lg:col-span-7 transition-colors ${
                  isDragOver
                    ? 'border-[#E06518] bg-[#FFF4EC]'
                    : 'border-[#DFE3E6] bg-[#F5F6F6]'
                }`}
              >
                {/* Architectural Drafting Grid Corner */}
                <div
                  className="pointer-events-none absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'linear-gradient(#dfe3e6 1px, transparent 1px), linear-gradient(90deg, #dfe3e6 1px, transparent 1px)',
                    backgroundSize: '40px 40px',
                    maskImage: 'linear-gradient(135deg, #000, transparent 58%)',
                  }}
                />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 text-xs font-bold text-[#E06518] mb-3">
                    <VisualScannerIcon size={17} />
                    <span>تشخیص خودکار کانتور و کد فنی</span>
                  </div>

                  <h1 className="text-xl font-black leading-snug text-[#2B313A] sm:text-3xl lg:text-[34px]">
                    قطعه را با یک عکس بشناسید و نمونه مشابه را پیدا کنید
                  </h1>
                  <p className="mt-2.5 text-xs sm:text-sm leading-relaxed text-[#55565A]">
                    تصویر را اینجا رها کنید یا مستقیماً عکس بگیرید؛ قطعات بلافاصله دورگیری و با کاتالوگ اطلس تطبیق داده می‌شوند.
                  </p>

                  {/* Two Primary Actions */}
                  <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={onCamera}
                      disabled={isUploading}
                      aria-label="شروع اسکن با دوربین"
                      className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl bg-[#E06518] px-6 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#C95210] whitespace-nowrap cursor-pointer"
                    >
                      <Camera className="h-5 w-5" aria-hidden="true" />
                      <span>گرفتن عکس با دوربین</span>
                    </button>
                    <button
                      type="button"
                      onClick={onUpload}
                      disabled={isUploading}
                      aria-label="انتخاب تصویر از دستگاه"
                      className="inline-flex h-12 items-center justify-center gap-2.5 rounded-2xl border border-[#DFE3E6] bg-[#FFFFFF] px-6 text-sm font-bold text-[#2B313A] transition-colors hover:border-[#2B313A] whitespace-nowrap cursor-pointer"
                    >
                      <GalleryImage className="h-5 w-5 text-[#E06518]" aria-hidden="true" />
                      <span>انتخاب تصویر از گالری</span>
                    </button>
                  </div>

                  <p className="mt-3 flex items-center gap-1.5 text-[11px] sm:text-xs text-[#74757C]">
                    <UploadCloud className="h-4 w-4 text-[#E06518] shrink-0" aria-hidden="true" />
                    <span>پشتیبانی از JPG، PNG و WebP تا ۱۰ مگابایت · امکان کشیدن و رها کردن تصویر</span>
                  </p>
                </div>

                {/* Hairline-Separated Guidance Points */}
                <div className="relative mt-7 divide-y divide-[#DFE3E6] border-t border-[#DFE3E6] pt-2">
                  <div className="flex items-start gap-2.5 py-2.5">
                    <Focus className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                    <span className="text-xs font-bold leading-relaxed text-[#2B313A]">
                      برای تسمه‌ها: مستقیم روبه‌روی برند و اطلاعات درج‌شده روی تسمه عکس بگیرید و بفرستید
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 py-2.5">
                    <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                    <span className="text-xs leading-relaxed text-[#55565A]">
                      تشخیص خودکار قطعه در لحظه ثبت عکس با جداسازی دقیق لبه‌ها از پس‌زمینه
                    </span>
                  </div>
                  <div className="flex items-start gap-2.5 py-2.5">
                    <Search className="mt-0.5 h-4 w-4 shrink-0 text-[#E06518]" aria-hidden="true" />
                    <span className="text-xs leading-relaxed text-[#55565A]">
                      کلیک روی هر بخش از تصویر برای تغییر قطعه هدف و مشاهده محصولات مشابه
                    </span>
                  </div>
                </div>
              </div>

              {/* Photographic Optical Showcase & Supported Industrial Families */}
              <div className="flex flex-col justify-between gap-4 lg:col-span-5">
                <div className="relative flex-1 overflow-hidden rounded-3xl border border-[#DFE3E6] bg-[#2B313A] min-h-[210px]">
                  <img
                    src="/images/company/ai-search-mobile.webp"
                    alt="جستجوی تصویری قطعات صنعتی فورزا"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#181C22]/90 via-[#181C22]/25 to-transparent" />
                  {/* Optical Reticle Accent Preview */}
                  <div className="pointer-events-none absolute top-4 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-white/85">
                    <span className="rounded-full bg-[#181C22]/70 px-2.5 py-1 backdrop-blur-xs">
                      AUTO CONTOUR · U2NET
                    </span>
                    <span className="h-2 w-2 rounded-full bg-[#E06518]" />
                  </div>
                  <div className="absolute bottom-5 right-5 left-5 text-white">
                    <p className="text-sm font-extrabold sm:text-base">
                      تشخیص دقیق تسمه، بلبرینگ، پولی و قطعات صنعتی
                    </p>
                    <p className="mt-1 text-xs text-slate-200">
                      تطبیق فوری با کدهای فنی و موجودی انبار صنعت‌پیش
                    </p>
                  </div>
                </div>

                {/* Supported Families Quick Visual Strip */}
                <div className="grid grid-cols-4 gap-2 rounded-2xl border border-[#DFE3E6] bg-[#FFFFFF] p-2.5 text-center">
                  <div className="flex flex-col items-center gap-1 py-1">
                    <BeltIcon size={18} className="text-[#E06518]" />
                    <span className="text-[11px] font-bold text-[#2B313A]">تسمه</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 py-1">
                    <PulleyIcon size={18} className="text-[#55565A]" />
                    <span className="text-[11px] font-bold text-[#2B313A]">پولی</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 py-1">
                    <BearingIcon size={18} className="text-[#55565A]" />
                    <span className="text-[11px] font-bold text-[#2B313A]">بلبرینگ</span>
                  </div>
                  <div className="flex flex-col items-center gap-1 py-1">
                    <ChainCouplingIcon size={18} className="text-[#55565A]" />
                    <span className="text-[11px] font-bold text-[#2B313A]">کوپلینگ</span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* User Recent Scans History */}
            {recentSearches.length > 0 && (
              <section className="mt-7" data-testid="forza-vision-recent-history">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 text-sm font-bold text-[#2B313A]">
                    <History className="h-4 w-4 text-[#E06518]" aria-hidden="true" />
                    <span>جستجوهای تصویری اخیر شما</span>
                  </h3>
                  {recentSearches.length > 6 && (
                    <button
                      type="button"
                      onClick={() => setShowAllHistory((v) => !v)}
                      className="text-xs font-bold text-[#E06518] hover:underline cursor-pointer"
                    >
                      {showAllHistory ? 'نمایش کمتر' : `همه (${toPersianDigits(recentSearches.length)})`}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
                  {displayedRecentSearches.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onRecentClick?.(item)}
                      disabled={!onRecentClick}
                      className="flex items-center gap-3 rounded-2xl border border-[#DFE3E6] bg-[#FFFFFF] p-2.5 text-right transition-colors hover:border-[#E06518]/65 hover:bg-[#FAFBFB] cursor-pointer"
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-[#E7E8EC] bg-[#F5F6F6] p-1">
                        <img
                          src={item.imageUrl || "/images/brand/logo-forza.webp"}
                          alt={item.title}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-contain"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[#2B313A]">{item.title}</p>
                        <p className="mt-0.5 truncate text-[11px] text-[#74757C]">
                          {item.subtitle || item.partHint || formatVisionRecentTime(item.createdAt)}
                        </p>
                      </div>
                      <ChevronLeft className="h-4 w-4 shrink-0 text-[#74757C]" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </section>
            )}
          </main>
        </div>
  );
};
