import { useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Camera,
  CheckCircle2,
  LoaderCircle,
  Phone,
  RefreshCw,
  Wrench,
  X,
} from 'lucide-react';
import { AutomaticImageCrop } from './AutomaticImageCrop';
import type { ImageRegion } from '../../utils/imageRegion';
import './image-region-review.css';

export type RegionPreparationState = 'uploading' | 'detecting' | 'ready' | 'fallback';

export interface VisionWorkspaceResult {
  id: string;
  code?: string;
  familyCode?: string;
  name: string;
  brand?: string;
  image?: string;
  imageScope?: 'family' | 'variant' | 'none';
  matchBasis?: 'visual' | 'read_code' | 'family' | 'explore';
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
  candidateRegions?: ImageRegion[];
  onSelectRegion?: (region: ImageRegion) => void;
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
  onSelectProduct: (id: string) => void;
  onOpenProduct: (id: string) => void;
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
  candidateRegions = [],
  onSelectRegion,
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
  onSelectProduct,
  onOpenProduct,
  onRetryAnalysis,
  onChangeImage,
  onCamera,
  onClose,
  onManufacture,
}: Props) {
  type MobileSheetLevel = 'peek' | 'half' | 'full';
  const [mobileSheetLevel, setMobileSheetLevel] = useState<MobileSheetLevel>('peek');
  const sheetPointerStart = useRef<{ pointerId: number; y: number } | null>(null);
  const sheetWasDragged = useRef(false);

  useEffect(() => {
    setMobileSheetLevel('peek');
  }, [image]);

  const onSheetPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target?.closest('.kiki-image-workspace__sheet-handle')) return;
    if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
    sheetWasDragged.current = false;
    sheetPointerStart.current = { pointerId: event.pointerId, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onSheetPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    const start = sheetPointerStart.current;
    sheetPointerStart.current = null;
    if (!start || start.pointerId !== event.pointerId) return;
    const deltaY = event.clientY - start.y;
    if (Math.abs(deltaY) < 18) return;
    sheetWasDragged.current = true;
    setMobileSheetLevel(level => {
      if (deltaY < 0) return level === 'peek' ? 'half' : 'full';
      return level === 'full' ? 'half' : 'peek';
    });
  };

  const toggleMobileSheet = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (sheetWasDragged.current && event.detail > 0) {
      sheetWasDragged.current = false;
      return;
    }
    sheetWasDragged.current = false;
    setMobileSheetLevel(level => level === 'peek' ? 'half' : level === 'half' ? 'full' : 'peek');
  };

  const preparing = status === 'uploading' || status === 'detecting';
  const working = preparing || Boolean(analysisBusy);
  const controlsDisabled = working || Boolean(busy);
  const statusText = status === 'uploading'
    ? 'در حال آماده‌سازی تصویر'
    : status === 'detecting'
      ? 'هوش مصنوعی در حال پیدا کردن قطعه در تصویر'
      : analysisBusy
        ? selectedRegion
          ? 'در حال تطبیق برش خودکار با کاتالوگ صنعت پیش'
          : 'در حال بررسی تصویر کامل با کاتالوگ صنعت پیش'
        : results.length
          ? 'برای مشاهده مشخصات، روی کارت محصول بزنید'
          : analysisComplete && !results.length
            ? 'جست‌وجو کامل شد؛ نتیجه قابل اتکایی پیدا نشد'
            : selectedRegion
              ? 'قطعه پیدا شد و برش خودکار برای جست‌وجو فعال است'
              : 'برش دقیق تأیید نشد؛ جست‌وجوی تصویر کامل انجام می‌شود';

  return (
    <section
      className="kiki-vision-review-shell kiki-image-workspace"
      dir="ltr"
      aria-label="میزکار شناسایی تصویری FORZA"
      aria-busy={working || Boolean(busy)}
      data-testid="image-region-review"
      data-mobile-sheet-level={mobileSheetLevel}
      data-selected-region={selectedRegion ? [selectedRegion.x, selectedRegion.y, selectedRegion.width, selectedRegion.height].join(',') : ''}
      data-region-mode="automatic"
    >
      <section
        className="kiki-image-workspace__catalog"
        dir="rtl"
        aria-label="محصولات مشابه کاتالوگ"
        data-sheet-level={mobileSheetLevel}
        onPointerDown={onSheetPointerDown}
        onPointerUp={onSheetPointerUp}
        onPointerCancel={() => { sheetPointerStart.current = null; }}
        onLostPointerCapture={() => { sheetPointerStart.current = null; }}
      >
        <button
          type="button"
          className="kiki-image-workspace__sheet-handle"
          aria-controls="kiki-image-workspace-catalog-body"
          aria-expanded={mobileSheetLevel !== 'peek'}
          aria-label={mobileSheetLevel === 'full' ? 'پایین کشیدن پنل پیشنهادها' : 'بالا کشیدن پنل پیشنهادها برای دیدن محصولات'}
          onClick={toggleMobileSheet}
        >
          <span className="kiki-image-workspace__sheet-grabber" aria-hidden="true" />
          <span>{mobileSheetLevel === 'peek' ? 'برای دیدن محصولات، بکشید بالا' : mobileSheetLevel === 'half' ? 'برای دیدن همه پیشنهادها، بیشتر بکشید بالا' : 'برای بازگشت به تصویر، پایین بکشید'}</span>
          {mobileSheetLevel === 'full' ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
        </button>
        <header className="kiki-image-workspace__catalog-header">
          <div className="kiki-image-workspace__catalog-identity">
            <img src={image} alt="تصویر قطعه انتخاب‌شده" />
            <div>
              <h2>{results.length>0 && results.every(item=>item.matchBasis==='explore')?'نزدیک‌ترین گزینه‌ها؛ تأیید نشده':'محصولات مشابه کاتالوگ'}</h2>
              <p>{results.length ? results.length.toLocaleString('fa-IR') + ' گزینه برای بررسی' : analysisBusy ? 'نتایج به‌محض آماده‌شدن نمایش داده می‌شوند' : 'برای دیدن کد، مشخصات و مدل‌ها، کارت محصول را باز کنید'}</p>
            </div>
          </div>
          <span className="kiki-image-workspace__catalog-mark" aria-hidden="true">FORZA</span>
        </header>

        <div id="kiki-image-workspace-catalog-body" className="kiki-image-workspace__catalog-body">
          <div className="kiki-image-workspace__status" role="status" aria-live="polite">
            {working
              ? <LoaderCircle size={16} aria-hidden="true" />
              : <span className="kiki-image-workspace__status-dot" aria-hidden="true" />}
            <span>{statusText}</span>
            {selectedRegion && <small>برش خودکار روی تصویر مشخص است</small>}
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
              <button type="button" onClick={onRetryAnalysis} disabled={controlsDisabled}>
                <RefreshCw size={14} aria-hidden="true" />
                تلاش مجدد
              </button>
            </div>
          )}

          {results.length > 0 ? (
            <div className="kiki-image-workspace__result-grid" data-testid="kiki-inline-catalog-results">
              {results.map((item, index) => {
                const selected = selectedProductId === item.id;
                const score = typeof item.similarityScore === 'number'
                  ? Math.round(item.similarityScore <= 1 ? item.similarityScore * 100 : item.similarityScore)
                  : undefined;
                return (
                  <article className={'kiki-image-workspace__result-card' + (selected ? ' is-selected' : '')}
                    key={item.id} data-selected={selected || undefined}>
                    <button type="button" className="kiki-image-workspace__result-select"
                      onClick={() => { onSelectProduct(item.id); onOpenProduct(item.id); }}
                      disabled={controlsDisabled}
                      aria-pressed={selected}
                      aria-label={'مشاهده صفحه محصول ' + item.name}>
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
                        {!item.code && item.familyCode && (
                          <span className="kiki-image-workspace__result-code" dir="ltr">کد خانواده: {item.familyCode}</span>
                        )}
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
                        {item.imageScope === 'family' && (
                          <span className="kiki-image-workspace__family-image-note">
                            تصویر نمونه خانواده است؛ نه عکس اختصاصی این مدل.
                          </span>
                        )}
                        {item.matchLabel && <span className="kiki-image-workspace__result-match">{item.matchLabel}</span>}
                        {typeof score === 'number' && (
                          <span className="kiki-image-workspace__result-score">امتیاز رتبه‌بندی تصویر: {score.toLocaleString('fa-IR')} از ۱۰۰</span>
                        )}
                        <span className="kiki-image-workspace__result-action">مشاهده صفحه محصول و مشخصات</span>
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
              <span>تصویر کامل بررسی شده است؛ اگر نتیجه‌ای پیدا نشد، می‌توانید درخواست بررسی و ساخت سفارشی ثبت کنید.</span>
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
          <AutomaticImageCrop src={image} region={selectedRegion} candidateRegions={candidateRegions} onSelectRegion={onSelectRegion} status={status} />
        </div>
      </aside>
    </section>
  );
}
