import React from 'react';
import {
  AlertCircle,
  Camera,
  LoaderCircle,
  Phone,
  RefreshCw,
  Wrench,
  X,
} from 'lucide-react';
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
  onFullImageSearch: () => void;
  onRetryPreparation: () => void;
  onRetryAnalysis: () => void;
  onChangeImage: () => void;
  onCamera: () => void;
  onClose: () => void;
  onManufacture: () => void;
}

/**
 * The KIKI review workspace mirrors the supplied two-panel reference:
 * catalogue/skeleton rail on the left and a direct manipulation image lens
 * on the right. All analysis and private-image operations stay in the parent.
 */
export function ImageRegionReview({
  image,
  status,
  selectedRegion,
  candidateRegions,
  message,
  analysisError,
  busy,
  onRegionChange,
  onConfirm,
  onFullImageSearch,
  onRetryPreparation,
  onRetryAnalysis,
  onChangeImage,
  onCamera,
  onClose,
  onManufacture,
}: Props) {
  const preparing = status === 'uploading' || status === 'detecting';
  const selectorDisabled = preparing || Boolean(busy);
  const statusText = status === 'uploading'
    ? 'در حال آماده‌سازی تصویر برای شناسایی'
    : status === 'detecting'
      ? 'در حال پیدا کردن مرز قطعه در تصویر'
      : status === 'fallback'
        ? 'انتخاب خودکار کامل نشد؛ محدوده را دستی مشخص کنید'
        : 'برش آماده است؛ پس از تأیید، محصولات مشابه نمایش داده می‌شوند';

  return (
    <section
      className="kiki-vision-review-shell kiki-image-workspace"
      dir="ltr"
      aria-label="میزکار شناسایی تصویری FORZA"
      aria-busy={preparing || Boolean(busy)}
      data-testid="image-region-review"
    >
      <section className="kiki-image-workspace__catalog" dir="rtl" aria-label="محصولات مشابه کاتالوگ">
        <header className="kiki-image-workspace__catalog-header">
          <div className="kiki-image-workspace__catalog-identity">
            <img src={image} alt="تصویر قطعه انتخاب‌شده" />
            <div>
              <h2>محصولات مشابه کاتالوگ</h2>
              <p>{status === 'ready' ? 'در انتظار تأیید برش تصویر' : statusText}</p>
            </div>
          </div>
          <span className="kiki-image-workspace__catalog-mark" aria-hidden="true">FORZA</span>
        </header>

        <div className="kiki-image-workspace__catalog-body">
          {analysisError && (
            <div className="kiki-image-workspace__error" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <div>
                <strong>آماده‌سازی یا تحلیل تصویر کامل نشد.</strong>
                <span>{analysisError}</span>
              </div>
              <button type="button" onClick={onRetryAnalysis} disabled={selectorDisabled}>
                <RefreshCw size={14} aria-hidden="true" />
                تلاش مجدد
              </button>
            </div>
          )}

          <div className="kiki-image-workspace__status" role="status" aria-live="polite">
            {preparing
              ? <LoaderCircle size={16} aria-hidden="true" />
              : <span className="kiki-image-workspace__status-dot" aria-hidden="true" />}
            <span>{statusText}</span>
            {selectedRegion && <small>ناحیه منتخب آماده بررسی است</small>}
          </div>

          <div className="kiki-image-workspace__skeleton-grid" aria-label="جایگاه نتایج کاتالوگ">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="kiki-image-workspace__skeleton-card" key={index} aria-hidden="true">
                <div className="kiki-image-workspace__skeleton-image" />
                <div className="kiki-image-workspace__skeleton-line is-wide" />
                <div className="kiki-image-workspace__skeleton-line" />
                <div className="kiki-image-workspace__skeleton-line is-short" />
              </div>
            ))}
          </div>

          {status === 'fallback' && (
            <div className="kiki-image-workspace__manual-notice" role="status">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{message || 'قطعه را در تصویر لمس کنید یا با کشیدن کادر، محدوده آن را مشخص کنید.'}</span>
              <button type="button" onClick={onRetryPreparation} disabled={selectorDisabled}>تلاش مجدد</button>
            </div>
          )}
          {status === 'ready' && message && (
            <p className="kiki-image-workspace__privacy-note">{message}</p>
          )}
        </div>

        <footer className="kiki-image-workspace__manufacture-rail" dir="rtl">
          <div className="kiki-image-workspace__manufacture-copy">
            <strong>قطعه موردنظر در نتایج نبود؟ ما آن را برای شما تولید می‌کنیم</strong>
            <span>بررسی فنی، مهندسی معکوس و ثبت درخواست ساخت سفارشی</span>
          </div>
          <div className="kiki-image-workspace__manufacture-actions">
            <a href="tel:03535254703" aria-label="تماس با صنعت پیش">
              <Phone size={15} aria-hidden="true" />
              <span>تماس</span>
            </a>
            <button type="button" onClick={onManufacture} disabled={selectorDisabled}>
              <Wrench size={15} aria-hidden="true" />
              <span>ثبت سفارش ساخت</span>
            </button>
          </div>
        </footer>
      </section>

      <aside className="kiki-image-workspace__viewer" dir="rtl" aria-label="تصویر و ابزار انتخاب قطعه">
        <header className="kiki-image-workspace__toolbar">
          <div className="kiki-image-workspace__toolbar-actions">
            <button type="button" onClick={onChangeImage} disabled={busy}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>عکس جدید</span>
            </button>
            <button type="button" onClick={onCamera} disabled={busy}>
              <Camera size={15} aria-hidden="true" />
              <span>دوربین</span>
            </button>
          </div>
          <button type="button" className="kiki-image-workspace__close" onClick={onClose} aria-label="بستن شناسایی تصویر">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <div className="kiki-image-workspace__stage">
          <ImageRegionSelector
            src={image}
            value={selectedRegion}
            candidateRegions={candidateRegions}
            onChange={onRegionChange}
            onSearch={onConfirm}
            onFullImageSearch={onFullImageSearch}
            disabled={selectorDisabled}
            variant="viewer"
          />
        </div>
        <p className="kiki-image-workspace__viewer-hint">
          برای اصلاح برش، کادر را جابه‌جا کنید یا گوشه‌های سفید را بکشید؛ جست‌وجو فقط پس از تأیید شما آغاز می‌شود.
        </p>
      </aside>
    </section>
  );
}
