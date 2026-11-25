import React from 'react';
import {
  AlertCircle,
  Camera,
  LoaderCircle,
  Phone,
  RefreshCw,
  Target,
  Wrench,
  X,
  ChevronLeft,
} from 'lucide-react';
import { ImageRegionSelector } from './ImageRegionSelector';
import { CatalogResultImage } from './CatalogResultImage';
import type { ImageRegion } from '../../utils/imageRegion';
import type { AiPartAnalysisResult, MatchedPartItem } from '../../services/aiVisualSearchService';
import './image-region-review.css';

export type RegionPreparationState = 'uploading' | 'detecting' | 'ready' | 'fallback';

interface Props {
  image: string;
  status: RegionPreparationState;
  selectedRegion?: ImageRegion;
  candidateRegions: ImageRegion[];
  message?: string;
  analysisError?: string;
  analysisResult?: AiPartAnalysisResult | null;
  analysisBusy?: boolean;
  selectedCatalogCode?: string | null;
  busy?: boolean;
  onRegionChange: (region: ImageRegion | undefined) => void;
  onRetryPreparation: () => void;
  onRetryAnalysis: () => void;
  onSelectProduct: (code: string) => void;
  onOpenDetails: () => void;
  onChangeImage: () => void;
  onCamera: () => void;
  onClose: () => void;
  onManufacture: () => void;
}

function uniqueMatches(result?: AiPartAnalysisResult | null): MatchedPartItem[] {
  if (!result) return [];
  return [...(result.matchedProducts || []), ...(result.similarCandidates || [])]
    .filter((item, index, all) => Boolean(item.code) && index === all.findIndex(candidate => candidate.code === item.code));
}

export function ImageRegionReview({
  image,
  status,
  selectedRegion,
  candidateRegions,
  message,
  analysisError,
  analysisResult,
  analysisBusy = false,
  selectedCatalogCode,
  busy,
  onRegionChange,
  onRetryPreparation,
  onRetryAnalysis,
  onSelectProduct,
  onOpenDetails,
  onChangeImage,
  onCamera,
  onClose,
  onManufacture,
}: Props) {
  const preparing = status === 'uploading' || status === 'detecting';
  const selectorDisabled = preparing || Boolean(busy) || analysisBusy;
  const products = uniqueMatches(analysisResult);
  const statusText = preparing
    ? status === 'uploading' ? 'در حال آماده‌سازی امن تصویر' : 'در حال شناسایی خودکار قطعات داخل تصویر'
    : analysisBusy
      ? 'قطعه انتخاب‌شده در حال تطبیق با محصولات واقعی کاتالوگ است'
      : analysisResult
        ? products.length
          ? 'نتایج محصولات مشابه در کنار تصویر آماده است'
          : 'تطبیق کافی پیدا نشد؛ می‌توانید قطعه دیگری را انتخاب کنید'
        : status === 'fallback'
          ? 'ناحیه مستقل پیدا نشد؛ تصویر کامل به‌صورت خودکار بررسی می‌شود'
          : 'برای دیدن محصولات مشابه، یکی از قطعات مشخص‌شده روی تصویر را انتخاب کنید';

  return (
    <section
      className="kiki-vision-review-shell kiki-image-workspace"
      dir="ltr"
      aria-label="میزکار شناسایی تصویری FORZA"
      aria-busy={preparing || Boolean(busy) || analysisBusy}
      data-testid="image-region-review"
    >
      <section className="kiki-image-workspace__catalog" dir="rtl" aria-label="محصولات مشابه کاتالوگ">
        <header className="kiki-image-workspace__catalog-header">
          <div className="kiki-image-workspace__catalog-identity">
            <img src={image} alt="تصویر قطعه انتخاب‌شده" />
            <div>
              <h2>محصولات مشابه کاتالوگ</h2>
              <p>{statusText}</p>
            </div>
          </div>
          <span className="kiki-image-workspace__catalog-mark" aria-hidden="true">FORZA</span>
        </header>

        <div className="kiki-image-workspace__catalog-body">
          {analysisError && (
            <div className="kiki-image-workspace__error" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              <div>
                <strong>تحلیل تصویر کامل نشد.</strong>
                <span>{analysisError}</span>
              </div>
              <button type="button" onClick={onRetryAnalysis} disabled={selectorDisabled}>
                <RefreshCw size={14} aria-hidden="true" />
                تلاش مجدد
              </button>
            </div>
          )}

          <div className="kiki-image-workspace__status" role="status" aria-live="polite">
            {(preparing || analysisBusy)
              ? <LoaderCircle size={16} aria-hidden="true" />
              : <span className="kiki-image-workspace__status-dot" aria-hidden="true" />}
            <span>{statusText}</span>
            {selectedRegion && <small>ناحیه منتخب</small>}
          </div>

          {analysisBusy || preparing || (!analysisResult && !analysisError) ? (
            <div className="kiki-image-workspace__skeleton-grid" aria-label="در حال جست‌وجوی کاتالوگ">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="kiki-image-workspace__skeleton-card" key={index} aria-hidden="true">
                  <div className="kiki-image-workspace__skeleton-image" />
                  <div className="kiki-image-workspace__skeleton-line is-wide" />
                  <div className="kiki-image-workspace__skeleton-line" />
                  <div className="kiki-image-workspace__skeleton-line is-short" />
                </div>
              ))}
            </div>
          ) : products.length ? (
            <section className="kiki-image-workspace__results" aria-label="محصولات پیدا‌شده در کاتالوگ" data-testid="vision-inline-catalog-results">
              <div className="kiki-image-workspace__results-heading">
                <div>
                  <strong>{products.length} محصول مرتبط پیدا شد</strong>
                  <span>برای مشخص‌کردن نتیجه منتخب، محصول را انتخاب کنید.</span>
                </div>
                {analysisResult?.scanCoverage && (
                  <small>{analysisResult.scanCoverage.compared.toLocaleString('fa-IR')} تصویر بررسی شد</small>
                )}
              </div>
              <div className="kiki-image-workspace__result-grid">
                {products.slice(0, 12).map((item, index) => {
                  const catalogItem = (item.catalogProduct || item) as any;
                  const active = selectedCatalogCode === item.code;
                  return (
                    <article
                      className={'kiki-image-workspace__result-card' + (active ? ' is-selected' : '')}
                      key={item.code + '-' + index}
                      data-selected={active ? 'true' : 'false'}
                    >
                      <CatalogResultImage
                        sources={[item.image, ...(Array.isArray(catalogItem?.images) ? catalogItem.images : []), catalogItem?.image]}
                        alt={item.name}
                        className="kiki-image-workspace__result-image"
                        cleanSurface
                        hideZoomPill
                        eager={index < 3}
                      />
                      <div className="kiki-image-workspace__result-copy">
                        <strong>{item.name || item.code}</strong>
                        <span>کد کالا: <b dir="ltr">{item.code}</b></span>
                        <small>{item.visualVerdictFarsi || item.matchReason || 'گزینه مشابه در کاتالوگ'}</small>
                      </div>
                      <button
                        type="button"
                        className="kiki-image-workspace__select-result"
                        aria-pressed={active}
                        onClick={() => onSelectProduct(item.code)}
                      >
                        <Target size={14} aria-hidden="true" />
                        {active ? 'نتیجه منتخب' : 'انتخاب روی تصویر'}
                      </button>
                    </article>
                  );
                })}
              </div>
              <button type="button" className="kiki-image-workspace__details" onClick={onOpenDetails}>
                مشاهده تحلیل کامل و مشخصات فنی
                <ChevronLeft size={15} aria-hidden="true" />
              </button>
            </section>
          ) : analysisResult ? (
            <div className="kiki-image-workspace__empty" data-testid="vision-inline-no-match">
              <Target size={24} aria-hidden="true" />
              <strong>برای این ناحیه، محصول منطبق کافی پیدا نشد.</strong>
              <span>می‌توانید قطعه دیگری را روی تصویر انتخاب کنید یا درخواست بررسی و ساخت سفارشی ثبت کنید.</span>
              <button type="button" onClick={onOpenDetails}>مشاهده گزارش تحلیل</button>
            </div>
          ) : null}

          {message && <p className="kiki-image-workspace__privacy-note">{message}</p>}
          {status === 'fallback' && !analysisBusy && (
            <div className="kiki-image-workspace__manual-notice" role="status">
              <AlertCircle size={16} aria-hidden="true" />
              <span>تشخیص ناحیه مستقل کامل نشد؛ جست‌وجوی تصویر کامل به‌عنوان مسیر جایگزین انجام می‌شود.</span>
              <button type="button" onClick={onRetryPreparation} disabled={selectorDisabled}>تشخیص دوباره</button>
            </div>
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

      <aside className="kiki-image-workspace__viewer" dir="rtl" aria-label="تصویر و انتخاب خودکار قطعه">
        <header className="kiki-image-workspace__toolbar">
          <div className="kiki-image-workspace__toolbar-actions">
            <button type="button" onClick={onChangeImage} disabled={busy || analysisBusy}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>عکس جدید</span>
            </button>
            <button type="button" onClick={onCamera} disabled={busy || analysisBusy}>
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
            disabled={selectorDisabled}
            variant="viewer"
          />
        </div>
        <p className="kiki-image-workspace__viewer-hint">
          قطعات مشخص‌شده را روی تصویر لمس کنید؛ نتیجه همان قطعه بلافاصله در کنار تصویر نمایش داده می‌شود.
        </p>
      </aside>
    </section>
  );
}
