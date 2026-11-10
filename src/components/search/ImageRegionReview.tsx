import React from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, LoaderCircle, RefreshCw, ScanSearch, Sparkles, Target } from 'lucide-react';
import { ImageRegionSelector } from './ImageRegionSelector';
import type { ImageRegion } from '../../utils/imageRegion';
import './image-region-review.css';

export type RegionPreparationState = 'uploading' | 'detecting' | 'ready' | 'fallback';

interface Props {
  image: string;
  status: RegionPreparationState;
  selectedRegion?: ImageRegion;
  candidateRegions: ImageRegion[];
  message?: string;
  analysisError?: string;
  busy?: boolean;
  onRegionChange: (region: ImageRegion | undefined) => void;
  onConfirm: () => void;
  onRetryPreparation: () => void;
  onRetryAnalysis: () => void;
  onChangeImage: () => void;
}

export function ImageRegionReview({
  image, status, selectedRegion, candidateRegions, message, analysisError, busy,
  onRegionChange, onConfirm, onRetryPreparation, onRetryAnalysis, onChangeImage,
}: Props) {
  const preparing = status === 'uploading' || status === 'detecting';
  const detected = Boolean(selectedRegion);
  return (
    <section className="sp-region-review" dir="rtl" aria-label="تأیید برش قطعه پیش از تحلیل" data-testid="image-region-review">
      <header className="sp-region-review__header">
        <div className="sp-region-review__brand">
          <span className="sp-region-review__brand-icon"><ScanSearch size={22} aria-hidden="true" /></span>
          <div>
            <span className="sp-region-review__eyebrow">FORZA VISION · AUTO CROP</span>
            <h2>{preparing ? 'در حال پیدا کردن قطعه در تصویر' : detected ? (status === 'fallback' ? 'ناحیه قطعه انتخاب شد' : 'قطعه برای شما پیدا شد') : 'ناحیه قطعه را مشخص کنید'}</h2>
            <p>{preparing ? 'تصویر را بررسی می‌کنیم تا برش مناسبی برای جست‌وجو آماده شود.' : 'کادر نارنجی محدوده‌ای است که پس از تأیید برای تحلیل ارسال می‌شود.'}</p>
          </div>
        </div>
        <span className={`sp-region-review__status ${preparing ? 'is-busy' : status === 'fallback' ? 'is-manual' : 'is-ready'}`}>
          {preparing ? <LoaderCircle size={14} className="sp-region-review__spin" /> : status === 'fallback' ? <Target size={14} /> : <CheckCircle2 size={14} />}
          {status === 'uploading' ? 'دریافت تصویر' : status === 'detecting' ? 'تشخیص خودکار' : status === 'fallback' ? 'انتخاب دستی' : detected ? 'ناحیه انتخاب شد' : 'آماده انتخاب'}
        </span>
      </header>

      {preparing ? (
        <div className="sp-region-review__scanner" role="status" aria-live="polite">
          <div className="sp-region-review__scanner-stage">
            <img src={image} alt="تصویر قطعه در حال بررسی" />
            <span className="sp-region-review__scanner-grid" aria-hidden="true" />
            <span className="sp-region-review__scanner-line" aria-hidden="true" />
            <span className="sp-region-review__scanner-corner corner-tr" aria-hidden="true" />
            <span className="sp-region-review__scanner-corner corner-tl" aria-hidden="true" />
            <span className="sp-region-review__scanner-corner corner-br" aria-hidden="true" />
            <span className="sp-region-review__scanner-corner corner-bl" aria-hidden="true" />
            <span className="sp-region-review__scanner-caption"><Sparkles size={15} /> {status === 'uploading' ? 'در حال ذخیره تصویر امن' : 'در حال شناسایی شکل و محدوده قطعه'}</span>
          </div>
          <div className="sp-region-review__scanner-steps">
            <span className={status === 'detecting' ? 'is-done' : 'is-active'}><CheckCircle2 size={15} /> دریافت تصویر</span>
            <span className={status === 'detecting' ? 'is-active' : ''}><ScanSearch size={15} /> یافتن قطعه</span>
            <span><Target size={15} /> آماده‌سازی برش</span>
          </div>
        </div>
      ) : (
        <>
          <div className="sp-region-review__instruction">
            <div className="sp-region-review__instruction-icon"><Target size={18} /></div>
            <div>
              <strong>{detected ? 'بهترین ناحیه به‌صورت پیش‌فرض انتخاب شده است' : 'قطعه را لمس کنید یا دور آن کادر بکشید'}</strong>
              <span>{candidateRegions.length > 1 ? 'برای انتخاب قطعه دیگر، روی همان قطعه یا کادر پیشنهادی آن بزنید؛ برش جدید پیش‌نمایش می‌شود.' : 'روی قطعه بزنید تا برش اولیه ساخته شود؛ برای تنظیم دقیق‌تر کادر بکشید.'}</span>
            </div>
          </div>

          <ImageRegionSelector
            src={image}
            value={selectedRegion}
            candidateRegions={candidateRegions}
            onChange={onRegionChange}
          />

          {status === 'fallback' && (
            <div className="sp-region-review__notice" role="status">
              <AlertCircle size={17} aria-hidden="true" />
              <div><strong>{busy ? 'ذخیره تصویر کامل نشد؛ دوباره تلاش کنید.' : 'تشخیص خودکار کامل نشد؛ کار متوقف نشده است.'}</strong><span>{message || (busy ? 'تصویر را دوباره بارگذاری کنید؛ تا ذخیره موفق، تحلیل شروع نمی‌شود.' : 'می‌توانید ناحیه را دستی انتخاب کنید یا تصویر کامل را برای تحلیل بفرستید.')}</span></div>
              <button type="button" onClick={onRetryPreparation}>تلاش مجدد</button>
            </div>
          )}
          {status === 'ready' && !detected && (
            <div className="sp-region-review__notice is-neutral" role="status">
              <Target size={17} aria-hidden="true" />
              <div><strong>کادر خودکار قابل‌اعتماد پیدا نشد.</strong><span>برای جلوگیری از برش اشتباه، ناحیه قطعه را خودتان مشخص کنید.</span></div>
            </div>
          )}
          {analysisError && (
            <div className="sp-region-review__error" role="alert">
              <AlertCircle size={18} aria-hidden="true" />
              <div><strong>تحلیل تصویر انجام نشد</strong><span>{analysisError}</span></div>
              <button type="button" onClick={onRetryAnalysis}><RefreshCw size={14} /> تلاش مجدد</button>
            </div>
          )}
        </>
      )}

      <footer className="sp-region-review__actions">
        <button type="button" className="sp-region-review__change" onClick={onChangeImage} disabled={preparing}>
          <ImagePlus size={17} /> تغییر تصویر
        </button>
        <button type="button" className="sp-region-review__confirm" onClick={onConfirm} disabled={preparing || busy}>
          <CheckCircle2 size={18} />
          <span>{selectedRegion ? 'تأیید برش و شروع تحلیل' : 'تأیید تصویر و شروع تحلیل'}</span>
        </button>
      </footer>
    </section>
  );
}
