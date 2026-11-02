import React from "react";
import { ArrowRight, Check, CircleDot, ScanLine, ShieldCheck, Sparkles, X } from "lucide-react";
import { toPersianDigits } from "../../utils/formatters";
import "./vision-analysis-progress.css";

type Phase = { title: string; tag: string; detail: string };
type ProgressCounts = { compared: number; total: number; stage: string } | null;

interface Props {
  image: string | null;
  progress: number;
  phaseIndex: number;
  phases: Phase[];
  counts: ProgressCounts;
  quickMode: boolean;
  onClose: () => void;
}

export function VisionAnalysisProgress({
  image, progress, phaseIndex, phases, counts, quickMode, onClose,
}: Props) {
  const activeIndex = Math.max(0, Math.min(phaseIndex, phases.length - 1));
  const phase = phases[activeIndex];
  const hasVerifiedCounts = Boolean(
    counts && Number.isFinite(counts.total) && counts.total > 0 &&
    Number.isFinite(counts.compared) && counts.compared >= 0
  );
  const value = hasVerifiedCounts ? Math.max(0, Math.min(100, Math.round(progress))) : null;

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
              <img src={image} alt="عکس واقعی قطعه در حال شناسایی" className="sp-vision-analysis__image" />
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
            <span>{quickMode ? "بررسی اولیه تصویر" : "بررسی تصویر و مشخصات فنی"}</span>
          </div>
          <h2>در حال بررسی قطعه شما</h2>
          <p>شکل، کدهای قابل مشاهده و ویژگی‌های فنی قطعه با اطلاعات کاتالوگ مقایسه می‌شوند.</p>

          <div className="sp-vision-analysis__active-phase" aria-live="polite" aria-atomic="true">
            <span>مرحله {toPersianDigits(activeIndex + 1)} از {toPersianDigits(phases.length)}</span>
            <strong>{phase.title}</strong>
            <small>{phase.detail}</small>
          </div>

          <div className="sp-vision-analysis__progress-section">
            <div className="sp-vision-analysis__progress-top">
              <span>پیشرفت تطبیق تصاویر</span>
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
