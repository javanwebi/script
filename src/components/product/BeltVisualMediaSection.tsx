import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Ruler,
  ZoomIn,
} from "lucide-react";
import type { BeltFamilyMedia, BeltSkuMedia } from "../../utils/beltCatalogMedia";

export interface BeltDocModalPayload {
  title: string;
  webpUrl: string;
  svgUrl: string;
  subtitle: string;
}

interface BeltVisualMediaSectionProps {
  productName: string;
  brand?: string;
  selectedSkuSize?: string;
  selectedSkuName?: string;
  beltFamilyMedia: BeltFamilyMedia;
  beltSkuMedia: BeltSkuMedia | null;
  onOpenDocModal: (payload: BeltDocModalPayload) => void;
  onJumpToFamilyGallery?: () => void;
}

export const BeltVisualMediaSection: React.FC<BeltVisualMediaSectionProps> = ({
  productName,
  selectedSkuSize,
  selectedSkuName,
  beltFamilyMedia,
  beltSkuMedia,
  onOpenDocModal,
  onJumpToFamilyGallery,
}) => {
  const familyPhotoTitles = ["نمای اصلی خانواده", "نمای زاویه‌ای", "جزئیات ساختار", "نمای نزدیک"];
  const familyPhotoCards = beltFamilyMedia.familyPhotos.map((url, index) => ({
    id: `family-photo-${index + 1}`,
    url,
    svgUrl: url,
    title: familyPhotoTitles[index] || `تصویر مرجع خانواده ${index + 1}`,
    subtitle: "تصویر اختصاصی خانواده از مرجع POPD",
  }));
  if (beltFamilyMedia.hasVerifiedSpecSheet && beltFamilyMedia.specSheetWebp) {
    familyPhotoCards.push({
      id: "spec-sheet",
      url: beltFamilyMedia.specSheetWebp,
      svgUrl: beltFamilyMedia.specSheetSvg,
      title: "جدول مشخصات فنی خانواده",
      subtitle: "ابعاد و استانداردهای خانواده",
    });
  }

  return (
    <section
      aria-label="تصاویر خانواده تسمه و تصاویر اختصاصی هر کد کالا"
      className="space-y-6"
    >
      {/* ۱. فقط تصاویر مرجع واقعاً موجود خانواده */}
      {familyPhotoCards.length > 0 && (
      <div className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 space-y-4 shadow-xs">
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h2 className="text-sm sm:text-base font-black text-[#37383b]">
                ۱. تصاویر خانواده تسمه
              </h2>
              <p className="text-xs text-slate-500">
                تصاویر مرجع تأییدشده خانواده ({beltFamilyMedia.familyCode})
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
            {familyPhotoCards.length} تصویر موجود
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {familyPhotoCards.map((card) => (
            <article
              key={card.id}
              className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden flex flex-col hover:border-slate-300 transition-colors"
            >
              <button
                type="button"
                onClick={() =>
                  onOpenDocModal({
                    title: `${card.title} — ${productName}`,
                    webpUrl: card.url,
                    svgUrl: card.svgUrl,
                    subtitle: `${card.subtitle} (${beltFamilyMedia.familyCode})`,
                  })
                }
                aria-label={`بزرگ‌نمایی ${card.title}`}
                className="relative group block w-full aspect-[16/10] bg-white p-3 cursor-zoom-in overflow-hidden border-b border-slate-100"
              >
                <img
                  src={card.url}
                  alt={`${card.title} — ${productName}`}
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                  loading="lazy"
                />
                <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-lg bg-slate-900/75 text-white px-2.5 py-1 text-[10.5px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>بزرگ‌نمایی</span>
                </span>
              </button>
              <div className="px-4 py-3 flex items-center justify-between gap-2 bg-slate-50/40">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-[#37383b] truncate">
                    {card.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 truncate">
                    {card.subtitle}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenDocModal({
                      title: `${card.title} — ${productName}`,
                      webpUrl: card.url,
                      svgUrl: card.svgUrl,
                      subtitle: `${card.subtitle} (${beltFamilyMedia.familyCode})`,
                    })
                  }
                  className="shrink-0 w-8 h-8 rounded-lg border border-slate-200 bg-white hover:border-[#E06518] hover:text-[#E06518] text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
                  aria-label={`نمایش تمام‌صفحه ${card.title}`}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
      )}

      {/* ۲. تصاویر SKU فقط وقتی عکس واقعی همان کد موجود است */}
      {beltSkuMedia?.realProductImage && beltSkuMedia.realImageStatus === "EXACT_SKU_IMAGE_FOUND" && (
        <div
          id="belt-sku-media-section"
          className="bg-white rounded-3xl border border-slate-200/90 p-4 sm:p-6 space-y-4 shadow-xs"
        >
          <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-xl bg-orange-50 border border-orange-200 text-[#E06518] flex items-center justify-center shrink-0">
                <Ruler className="w-4 h-4" />
              </span>
              <div>
                <h2 className="text-sm sm:text-base font-black text-[#37383b]">
                  ۲. تصاویر هر کد کالا
                </h2>
                <p className="text-xs text-slate-500">
                  با انتخاب هر کد کالا از جدول، هر دو تصویر اختصاصی زیر (تصویر واقعی خود تسمه + نقشه فنی ابعادی) به‌صورت آنی بروزرسانی می‌شوند.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-[11px] font-mono font-bold px-3 py-1 rounded-lg bg-slate-100 text-[#37383b]"
                dir="ltr"
              >
                SKU: {beltSkuMedia.skuCode}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold">
                ۲ تصویر برای هر SKU
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* تصویر ۱ از ۲: نقشه فنی پروفیل و مشخصات ابعادی اختصاصی SKU */}
            <article className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-[#FBF8F3] border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-[#37383b] leading-snug">
                    تصویر اول SKU: نقشه فنی پروفیل و ابعاد (کد {beltSkuMedia.skuCode})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate" dir="auto">
                    {selectedSkuSize || selectedSkuName || productName}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenDocModal({
                      title: `نقشه فنی کامل ۴نمایی کد ${beltSkuMedia.skuCode}`,
                      webpUrl: beltSkuMedia.technicalDrawingWebp,
                      svgUrl: beltSkuMedia.technicalDrawingSvg,
                      subtitle: selectedSkuName || productName,
                    })
                  }
                  className="self-start sm:self-auto shrink-0 min-h-[34px] px-3 py-1 rounded-lg bg-[#E56B1E] hover:bg-[#C95210] text-white text-[11px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>نقشه ۴نمایی و ابعاد کامل</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() =>
                  onOpenDocModal({
                    title: `نقشه فنی پروفیل کد ${beltSkuMedia.skuCode}`,
                    webpUrl: beltSkuMedia.profileDrawingWebp,
                    svgUrl: beltSkuMedia.technicalDrawingSvg,
                    subtitle: selectedSkuName || productName,
                  })
                }
                aria-label={`بزرگ‌نمایی نقشه فنی پروفیل کد ${beltSkuMedia.skuCode}`}
                className="group relative flex-1 flex items-center justify-center bg-white p-3 aspect-[16/10] cursor-zoom-in"
              >
                <img
                  src={beltSkuMedia.profileDrawingWebp}
                  alt={`نقشه فنی پروفیل و مشخصات ابعادی تسمه کد ${beltSkuMedia.skuCode}`}
                  className="w-full h-full object-contain group-hover:scale-[1.02] transition-transform duration-300"
                />
              </button>
            </article>

            {/* تصویر ۲ از ۲: تصویر واقعی خود تسمه با اطلاعات چاپی منطبق با SKU */}
            <article className="rounded-2xl border border-slate-200/90 bg-white overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-[#FBF8F3] border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-[#37383b] leading-snug">
                    تصویر دوم SKU: عکس واقعی خود تسمه (کد {beltSkuMedia.skuCode})
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    تطبیق مستقیم برند و کد فنی درج‌شده روی بدنه تسمه
                  </p>
                </div>
                {beltSkuMedia.realImageStatus === "EXACT_SKU_IMAGE_FOUND" ? (
                  <span className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10.5px] font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تطبیق واقعی تأییدشده</span>
                  </span>
                ) : (
                  <span className="self-start sm:self-auto shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 text-[10.5px] font-bold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>در انتظار تصویر واقعی</span>
                  </span>
                )}
              </div>

              {beltSkuMedia.realImageStatus === "EXACT_SKU_IMAGE_FOUND" &&
              beltSkuMedia.realProductImage ? (
                <button
                  type="button"
                  onClick={() =>
                    onOpenDocModal({
                      title: `تصویر واقعی خود تسمه — کد ${beltSkuMedia.skuCode}`,
                      webpUrl: beltSkuMedia.realProductImage!,
                      svgUrl: beltSkuMedia.realProductImage!,
                      subtitle: `${selectedSkuName || productName} — چاپ روی بدنه مطابق کد کالا`,
                    })
                  }
                  aria-label={`بزرگ‌نمایی تصویر واقعی کد ${beltSkuMedia.skuCode}`}
                  className="group relative flex-1 flex items-center justify-center bg-[#f8fafc] p-3 aspect-[16/10] cursor-zoom-in"
                >
                  <img
                    src={beltSkuMedia.realProductImage}
                    alt={`تصویر واقعی تسمه کد ${beltSkuMedia.skuCode}`}
                    className="w-full h-full object-contain rounded-xl group-hover:scale-[1.02] transition-transform duration-300"
                  />
                  <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-lg bg-slate-900/75 text-white px-2.5 py-1 text-[10.5px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>بزرگ‌نمایی</span>
                  </span>
                </button>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-slate-50/70 aspect-[16/10] space-y-2.5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div className="space-y-1 max-w-md">
                    <p className="text-xs sm:text-sm font-black text-slate-800">
                      {beltSkuMedia.realImageStatusLabelFa} (کد {beltSkuMedia.skuCode})
                    </p>
                    <p className="text-[11px] text-slate-500 leading-5">
                      تصویر واقعی اختصاصی با چاپ دقیق مشخصات این کد روی بدنه هنوز ثبت نشده است. برای جلوگیری از نمایش کد چاپی نامنطبق، عکس تسمه دیگر جایگزین نمی‌شود.
                    </p>
                  </div>
                  {onJumpToFamilyGallery && (
                    <button
                      type="button"
                      onClick={onJumpToFamilyGallery}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:border-[#E06518] hover:text-[#E06518] px-3 py-1.5 text-[11px] font-bold text-slate-700 cursor-pointer transition-colors"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>مقایسه با تصاویر واقعی خانواده</span>
                    </button>
                  )}
                </div>
              )}
            </article>
          </div>
        </div>
      )}
    </section>
  );
};
