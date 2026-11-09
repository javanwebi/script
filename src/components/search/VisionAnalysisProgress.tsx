import React from "react";
import { ArrowRight, Check, CircleDot, ScanLine, ShieldCheck, Sparkles, X } from "lucide-react";
import { toPersianDigits } from "../../utils/formatters";
import type { ImageRegion } from "../../utils/imageRegion";
import "./vision-analysis-progress.css";

type Phase = { title: string; tag: string; detail: string };
type ProgressCounts = { compared: number; total: number; stage: string } | null;

interface Props {
  image: string | null;
  region?: ImageRegion;
  progress: number;
  phaseIndex: number;
  phases: Phase[];
  counts: ProgressCounts;
  quickMode: boolean;
  onClose: () => void;
}

export function VisionAnalysisProgress({
  image, region, progress, phaseIndex, phases, counts, quickMode, onClose,
}: Props) {
  const activeIndex = Math.max(0, Math.min(phaseIndex, phases.length - 1));
  const phase = phases[activeIndex];
  const hasVerifiedCounts = Boolean(
    counts && Number.isFinite(counts.total) && counts.total > 0 &&
    Number.isFinite(counts.compared) && counts.compared >= 0
  );
  const value = hasVerifiedCounts ? Math.max(0, Math.min(100, Math.round(progress))) : null;
  const cropStyle = image && region ? {
    backgroundImage: `url(${JSON.stringify(image)})`,
    backgroundSize: `${100 / region.width}% ${100 / region.height}%`,
    backgroundPosition: `${region.width < 1 ? 100 * region.x / (1 - region.width) : 0}% ${region.height < 1 ? 100 * region.y / (1 - region.height) : 0}%`,
  } : undefined;

  return (
    <section className="sp-vision-analysis" dir="rtl" aria-label="پردازش تصویر قطعه">
      <header className="sp-vision-analysis__header">
        <div className="sp-vision-analysis__brand">
          <span className="sp-vision-analysis__brand-icon" aria-hidden="true"><ScanLine size={23} /></span>
          <div>
            <span className="sp-vision-analysis__eyebrow">FORZA VISION / INDUSTRIAL SCAN</span>
            <h1>شناسایی هوشمند قطعه</h1>
          </div>
        </div>
        <button type="button" onClick={onClose} className="sp-vision-analysis__close" aria-label="بستن شناسایی تصویر">
          <X size={20} />
          <span>بستن</span>
        </button>
      </header>

      <main className="sp-vision-analysis__content">
        <div className="sp-vision-analysis__viewer">
          <div className="sp-vision-analysis__photo" aria-label="تصویر قطعه در حال بررسی">
            <span className="sp-vision-analysis__photo-label"><CircleDot size={13}/> تصویر مشتری</span>
            {image ? (
              region ? (
                <div className="sp-vision-analysis__image-crop" data-testid="analysis-approved-crop" style={cropStyle} role="img" aria-label="برش تأییدشده قطعه در حال تحلیل" />
              ) : (
                <img src={image} alt="عکس واقعی قطعه در حال شناسایی" className="sp-vision-analysis__image" />
              )
            ) : (
              <div className="sp-vision-analysis__placeholder">
                <ScanLine size={50} aria-hidden="true" />
                <span>تطبیق با اطلاعات فنی قطعه</span>
              </div>
            )}
            <span className="sp-vision-analysis__scan-grid" aria-hidden="true" />
            <span className="sp-vision-analysis__scan-line" aria-hidden="true" />
            <span className="sp-vision-analysis__corner sp-vision-analysis__corner--tr" aria-hidden="true" />
            <span className="sp-vision-analysis__corner sp-vision-analysis__corner--tl" aria-hidden="true" />
            <span className="sp-vision-analysis__corner sp-vision-analysis__corner--br" aria-hidden="true" />
            <span className="sp-vision-analysis__corner sp-vision-analysis__corner--bl" aria-hidden="true" />
          </div>
          <div className="sp-vision-analysis__image-caption">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>مقایسه براساس تصویر واقعی و ویژگی‌های قابل مشاهده</span>
          </div>
        </div>

        <div className="sp-vision-analysis__details">
          <div className="sp-vision-analysis__status">
            <span className="sp-vision-analysis__status-dot" aria-hidden="true" />
            <span>{quickMode ? "تحلیل برش تأییدشده" : "تحلیل تصویر و مشخصات فنی"}</span>
          </div>
          <h2>در حال تطبیق قطعه با کاتالوگ صنعت پیش</h2>
          <p>{region ? "برش تأییدشده شما مبنای استخراج ویژگی‌ها و مقایسه با تصاویر واقعی کاتالوگ است." : "تصویر کامل شما برای استخراج ویژگی‌های ظاهری و مقایسه با تصاویر واقعی کاتالوگ بررسی می‌شود."}</p>

          <div className="sp-vision-analysis__active-phase" aria-live="polite" aria-atomic="true">
            <span>مرحله {toPersianDigits(activeIndex + 1)} از {toPersianDigits(phases.length)}</span>
            <strong>{phase.title}</strong>
            <small>{phase.detail}</small>
          </div>

          <div className="sp-vision-analysis__progress-section">
            <div className="sp-vision-analysis__progress-top">
              <span>پیشرفت مقایسه تصاویر کاتالوگ</span>
              <strong>{hasVerifiedCounts && counts
                ? `${toPersianDigits(counts.compared)} از ${toPersianDigits(counts.total)} تصویر`
                : "در انتظار گزارش سرور"}</strong>
            </div>
            <div className={`sp-vision-analysis__track ${value === null ? "is-indeterminate" : ""}`}
              role={value === null ? "status" : "progressbar"}
              aria-label="پیشرفت مقایسه تصاویر"
              aria-valuemin={value === null ? undefined : 0}
              aria-valuemax={value === null ? undefined : 100}
              aria-valuenow={value === null ? undefined : value}
            >
              <span style={value === null ? undefined : { width: `${value}%` }} />
            </div>
          </div>

          <ol className="sp-vision-analysis__phases">
            {phases.map((item, index) => {
              const completed = index < activeIndex;
              const active = index === activeIndex;
              return (
                <li key={item.tag} className={`sp-vision-analysis__phase ${active ? "is-active" : ""} ${completed ? "is-complete" : ""}`}
                  aria-current={active ? "step" : undefined}>
                  <span className="sp-vision-analysis__phase-icon" aria-hidden="true">
                    {completed ? <Check size={16} /> : active ? <Sparkles size={16} /> : toPersianDigits(index + 1)}
                  </span>
                  <span>{item.tag}</span>
                </li>
              );
            })}
          </ol>
          <div className="sp-vision-analysis__note">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>فقط نتایج قابل بررسی از کاتالوگ نمایش داده می‌شوند؛ ابعاد نامشخص حدس زده نمی‌شوند.</span>
          </div>
        </div>
      </main>
      <footer className="sp-vision-analysis__footer">
        <span>صنعت پیش • جستجوی تصویری قطعات صنعتی</span>
        <button type="button" onClick={onClose}><ArrowRight size={17} /> بازگشت به سایت</button>
      </footer>
    </section>
  );
}
