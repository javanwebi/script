import {
  AlertCircle,
  Camera,
  CheckCircle2,
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

export interface VisionWorkspaceResult {
  id: string;
  code?: string;
  name: string;
  brand?: string;
  image?: string;
  imageScope?: 'family' | 'variant' | 'none';
  familyName?: string;
  model?: string;
  size?: string;
  specs?: { key: string; value: string }[];
  similarityScore?: number;
  matchLabel?: string;
  reason?: string;
}

interface Props {
  image: string;
  status: RegionPreparationState;
  selectedRegion?: ImageRegion;
  candidateRegions: ImageRegion[];
  message?: string;
  analysisError?: string;
  busy?: boolean;
  analysisBusy?: boolean;
  progress?: number;
  compared?: number;
  total?: number;
  analysisComplete?: boolean;
  results: VisionWorkspaceResult[];
  selectedProductId?: string;
  onRegionChange: (region: ImageRegion | undefined) => void;
  onSelectProduct: (id: string) => void;
  onRetryAnalysis: () => void;
  onChangeImage: () => void;
  onCamera: () => void;
  onClose: () => void;
  onManufacture: () => void;
}

export function ImageRegionReview({
  image,
  status,
  selectedRegion,
  candidateRegions,
  message,
  analysisError,
  busy,
  analysisBusy,
  progress = 0,
  compared,
  total,
  analysisComplete,
  results,
  selectedProductId,
  onRegionChange,
  onSelectProduct,
  onRetryAnalysis,
  onChangeImage,
  onCamera,
  onClose,
  onManufacture,
}: Props) {
  const preparing = status === 'uploading' || status === 'detecting';
  const working = preparing || Boolean(analysisBusy);
  const selectorDisabled = preparing || Boolean(busy) || Boolean(analysisBusy);
  const statusText = status === 'uploading'
    ? 'در حال آماده‌سازی تصویر'
    : status === 'detecting'
      ? 'در حال تشخیص خودکار قطعات تصویر'
      : analysisBusy
        ? 'در حال تطبیق قطعه با کاتالوگ صنعت پیش'
        : results.length
          ? 'محصولات مشابه پیدا شدند؛ برای انتخاب، روی کارت محصول بزنید'
          : analysisComplete && !results.length
          ? 'جست‌وجو کامل شد؛ نتیجه قابل اتکایی پیدا نشد'
          : status === 'fallback'
            ? 'در حال بررسی تصویر کامل؛ نیازی به برش دستی نیست'
            : 'تصویر آماده بررسی خودکار است';

  return (
    <section
      className="kiki-vision-review-shell kiki-image-workspace"
      dir="ltr"
      aria-label="میزکار شناسایی تصویری FORZA"
      aria-busy={working || Boolean(busy)}
      data-testid="image-region-review"
    >
      <section className="kiki-image-workspace__catalog" dir="rtl" aria-label="محصولات مشابه کاتالوگ">
        <header className="kiki-image-workspace__catalog-header">
          <div className="kiki-image-workspace__catalog-identity">
            <img src={image} alt="تصویر قطعه انتخاب‌شده" />
            <div>
              <h2>محصولات مشابه کاتالوگ</h2>
              <p>{analysisBusy ? 'نتایج به‌محض آماده‌شدن نمایش داده می‌شوند' : 'انتخاب قطعه و مشاهده نتیجه در همین میزکار'}</p>
            </div>
          </div>
          <span className="kiki-image-workspace__catalog-mark" aria-hidden="true">FORZA</span>
        </header>

        <div className="kiki-image-workspace__catalog-body">
          <div className="kiki-image-workspace__status" role="status" aria-live="polite">
            {working
              ? <LoaderCircle size={16} aria-hidden="true" />
              : <span className="kiki-image-workspace__status-dot" aria-hidden="true" />}
            <span>{statusText}</span>
            {selectedRegion && <small>قطعه انتخاب‌شده روی تصویر مشخص است</small>}
          </div>

          {analysisBusy && typeof total === 'number' && total > 0 && (
            <div className="kiki-image-workspace__progress" role="progressbar"
              aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, progress))}
              aria-label="پیشرفت تطبیق با کاتالوگ">
              <span style={{ width: Math.max(0, Math.min(100, progress)) + '%' }} />
              <small>{typeof compared === 'number' ? compared.toLocaleString('fa-IR') : '۰'} از {total.toLocaleString('fa-IR')} تصویر بررسی‌شده</small>
            </div>
          )}

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

          {results.length > 0 ? (
            <div className="kiki-image-workspace__result-grid" data-testid="kiki-inline-catalog-results">
              {results.map((item, index) => {
                const selected = selectedProductId === item.id;
                return (
                  <article className={'kiki-image-workspace__result-card' + (selected ? ' is-selected' : '')}
                    key={item.id} data-selected={selected || undefined}>
                    <button type="button" className="kiki-image-workspace__result-select"
                      onClick={() => onSelectProduct(item.id)} disabled={selectorDisabled}
                      aria-pressed={selected}>
                      <span className="kiki-image-workspace__result-image">
                        {item.image
                          ? <img src={item.image} alt={item.name} loading={index < 3 ? 'eager' : 'lazy'} />
                          : <span aria-hidden="true">FORZA</span>}
                      </span>
                      <span className="kiki-image-workspace__result-copy">
                        <span className="kiki-image-workspace__result-title">
                          <strong>{item.name}</strong>
                          {selected && <CheckCircle2 size={17} aria-label="محصول انتخاب‌شده" />}
                        </span>
                        {item.code && <span className="kiki-image-workspace__result-code" dir="ltr">{item.code}</span>}
                        {(item.brand || item.familyName || item.model || item.size) && (
                          <span className="kiki-image-workspace__result-meta">
                            {[item.brand, item.familyName, item.model, item.size].filter(Boolean).join(' · ')}
                          </span>
                        )}
                        {item.specs?.length ? (
                          <span className="kiki-image-workspace__result-specs">
                            {item.specs.slice(0, 3).map(spec => spec.key + ': ' + spec.value).join('  |  ')}
                          </span>
                        ) : null}
                        {item.matchLabel && <span className="kiki-image-workspace__result-match">{item.matchLabel}</span>}
                        {typeof item.similarityScore === 'number' && (
                          <span className="kiki-image-workspace__result-score">شباهت تصویری: {Math.round(item.similarityScore).toLocaleString('fa-IR')}٪</span>
                        )}
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>
          ) : analysisBusy || preparing || busy || (!analysisComplete && !analysisError) ? (
            <div className="kiki-image-workspace__skeleton-grid" aria-label="در حال جستجوی کاتالوگ" data-testid="kiki-inline-results-loading">
              {Array.from({ length: 6 }, (_, index) => (
                <div className="kiki-image-workspace__skeleton-card" key={index} aria-hidden="true">
                  <div className="kiki-image-workspace__skeleton-image" />
                  <div className="kiki-image-workspace__skeleton-line is-wide" />
                  <div className="kiki-image-workspace__skeleton-line" />
                  <div className="kiki-image-workspace__skeleton-line is-short" />
                </div>
              ))}
            </div>
          ) : analysisError ? null : (
            <div className="kiki-image-workspace__empty-results" data-testid="kiki-inline-results-empty">
              <strong>تطابق قابل اتکایی در کاتالوگ پیدا نشد</strong>
              <span>می‌توانید قطعه دیگری از همین تصویر را انتخاب کنید یا درخواست بررسی و ساخت سفارشی ثبت کنید.</span>
            </div>
          )}

          {message && <p className="kiki-image-workspace__privacy-note">{message}</p>}
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
            <button type="button" onClick={onManufacture} disabled={Boolean(busy) || preparing}>
              <Wrench size={15} aria-hidden="true" />
              <span>ثبت سفارش ساخت</span>
            </button>
          </div>
        </footer>
      </section>

      <aside className="kiki-image-workspace__viewer" dir="rtl" aria-label="تصویر و قطعات شناسایی‌شده">
        <header className="kiki-image-workspace__toolbar">
          <div className="kiki-image-workspace__toolbar-actions">
            <button type="button" onClick={onChangeImage} disabled={Boolean(busy)}>
              <RefreshCw size={15} aria-hidden="true" />
              <span>عکس جدید</span>
            </button>
            <button type="button" onClick={onCamera} disabled={Boolean(busy)}>
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
            autoSelect
            variant="viewer"
          />
        </div>
        <p className="kiki-image-workspace__viewer-hint">
          قطعات شناسایی‌شده روی تصویر مشخص‌اند؛ برای بررسی قطعه دیگر، روی کادر آن بزنید. نتایج کنار تصویر به‌روزرسانی می‌شوند.
        </p>
      </aside>
    </section>
  );
}
