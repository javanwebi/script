import React from 'react';
import { AlertCircle, ImagePlus, LoaderCircle, RefreshCw, Target } from 'lucide-react';
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
}

/**
 * KIKI-aligned image review. The production selector and analysis callbacks
 * remain authoritative; this component changes presentation only.
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
}: Props) {
  const preparing = status === 'uploading' || status === 'detecting';
  const detected = Boolean(selectedRegion);

  return (
    <section
      className={'kiki-region-review' + (preparing ? ' is-preparing' : '') + (busy ? ' is-busy' : '')}
      dir="rtl"
      aria-label="انتخاب قطعه از تصویر"
      aria-busy={preparing || Boolean(busy)}
      data-testid="image-region-review"
    >
      <div className="kiki-region-review__intro">
        <div className="kiki-region-review__intro-copy">
          <span className="kiki-region-review__eyebrow">FORZA VISION · IMAGE REVIEW</span>
          <h2>قطعه موردنظر را انتخاب کنید</h2>
          <p>
            روی قطعه موردنظر بزنید یا کادر نارنجی را تنظیم کنید؛ فقط همان ناحیه برای جست‌وجو استفاده می‌شود.
          </p>
        </div>
        <button
          type="button"
          className="kiki-region-review__change-top"
          onClick={onChangeImage}
          disabled={preparing}
        >
          <ImagePlus size={16} aria-hidden="true" />
          <span>تصویر جدید</span>
        </button>
      </div>

      {preparing && (
        <div className="kiki-region-review__progress" role="status" aria-live="polite">
          <LoaderCircle size={15} aria-hidden="true" />
          <span>
            {status === 'uploading'
              ? 'تصویر در حال بارگذاری است'
              : 'بررسی تصویر برای انتخاب قطعه'}
          </span>
        </div>
      )}

      <div className="kiki-region-review__selector">
        <ImageRegionSelector
          src={image}
          value={selectedRegion}
          candidateRegions={candidateRegions}
          onChange={onRegionChange}
          onSearch={onConfirm}
          onFullImageSearch={onFullImageSearch}
        />
      </div>

      {status === 'fallback' && (
        <div className="kiki-region-review__notice" role="status">
          <AlertCircle size={17} aria-hidden="true" />
          <div>
            <strong>{busy ? 'ذخیره تصویر کامل نشد.' : 'تشخیص خودکار کامل نشد؛ انتخاب دستی فعال است.'}</strong>
            <span>
              {message || 'ناحیه قطعه را روی تصویر مشخص کنید؛ تصویر اصلی شما محفوظ می‌ماند.'}
            </span>
          </div>
          <button type="button" onClick={onRetryPreparation} disabled={preparing}>
            تلاش مجدد
          </button>
        </div>
      )}

      {status === 'ready' && !detected && (
        <div className="kiki-region-review__notice is-neutral" role="status">
          <Target size={17} aria-hidden="true" />
          <div>
            <strong>ناحیه مشخصی به‌صورت خودکار انتخاب نشد.</strong>
            <span>قطعه را لمس کنید یا با کشیدن کادر، محدوده موردنظر را مشخص کنید.</span>
          </div>
        </div>
      )}

      {analysisError && (
        <div className="kiki-region-review__error" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <div>
            <strong>تحلیل تصویر انجام نشد.</strong>
            <span>{analysisError}</span>
          </div>
          <button type="button" onClick={onRetryAnalysis}>
            <RefreshCw size={14} aria-hidden="true" />
            تلاش مجدد
          </button>
        </div>
      )}
    </section>
  );
}
