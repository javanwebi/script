import { useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Phone,
  RefreshCw,
  Wrench,
  X,
} from 'lucide-react';
import { ImageRegionSelector } from './ImageRegionSelector';
import type { ImageRegion } from '../../utils/imageRegion';
import type { BeltRecognitionAnalysis } from '../../services/aiVisualSearchService';
import './image-region-review.css';

export type RegionPreparationState = 'uploading' | 'detecting' | 'ready' | 'fallback';

type SheetPointerState = { pointerId: number; startY: number; startExpanded: boolean };

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
  candidateRegions: ImageRegion[];
  message?: string;
  analysisError?: string;
  busy?: boolean;
  analysisBusy?: boolean;
  progress?: number;
  compared?: number;
  total?: number;
  analysisComplete?: boolean;
  beltAnalysis?: BeltRecognitionAnalysis;
  results: VisionWorkspaceResult[];
  selectedProductId?: string;
  onRegionChange: (region: ImageRegion | undefined) => void;
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
  candidateRegions,
  message,
  analysisError,
  busy,
  analysisBusy,
  progress = 0,
  compared,
  total,
  analysisComplete,
  beltAnalysis,
  results,
  selectedProductId,
  onRegionChange,
  onSelectProduct,
  onOpenProduct,
  onRetryAnalysis,
  onChangeImage,
  onCamera,
  onClose,
  onManufacture,
}: Props) {
  const preparing = status === 'uploading' || status === 'detecting';
  const working = preparing || Boolean(analysisBusy);
  const selectorDisabled = preparing || Boolean(busy) || Boolean(analysisBusy);
  const [sheetExpanded, setSheetExpanded] = useState(false);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetPointerRef = useRef<SheetPointerState | null>(null);

  const handleSheetPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    sheetPointerRef.current = { pointerId: event.pointerId, startY: event.clientY, startExpanded: sheetExpanded };
    setSheetDragging(true);
    event.currentTarget.closest('.kiki-image-workspace')?.style.setProperty('--kiki-sheet-drag-offset', '0px');
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const handleSheetPointerMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = sheetPointerRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const delta = event.clientY - state.startY;
    const sheetHeight = event.currentTarget.closest('.kiki-image-workspace__catalog')?.getBoundingClientRect().height || 420;
    const maxTravel = Math.max(120, sheetHeight - 104);
    const offset = state.startExpanded
      ? Math.max(0, Math.min(maxTravel, delta))
      : Math.max(-maxTravel, Math.min(0, delta));
    // Update the compositor-driven transform directly; do not re-render the
    // entire catalogue grid for every touchmove on slower phones.
    event.currentTarget.closest('.kiki-image-workspace')?.style.setProperty('--kiki-sheet-drag-offset', offset + 'px');
  };
  const finishSheetPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = sheetPointerRef.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const delta = event.clientY - state.startY;
    if (Math.abs(delta) <= 8) setSheetExpanded(value => !value);
    else if (Math.abs(delta) >= 44) setSheetExpanded(delta < 0);
    sheetPointerRef.current = null;
    event.currentTarget.closest('.kiki-image-workspace')?.style.setProperty('--kiki-sheet-drag-offset', '0px');
    setSheetDragging(false);
  };
  const cancelSheetPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    sheetPointerRef.current = null;
    event.currentTarget.closest('.kiki-image-workspace')?.style.setProperty('--kiki-sheet-drag-offset', '0px');
    setSheetDragging(false);
  };
  const handleSheetClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    // Pointer gestures are handled on pointerup; detail=0 is keyboard activation.
    if (event.detail === 0) setSheetExpanded(value => !value);
  };
  const statusText = status === 'uploading'
    ? 'در حال آماده‌سازی تصویر'
    : status === 'detecting'
      ? 'در حال تشخیص خودکار قطعات تصویر'
      : analysisBusy
        ? 'در حال تطبیق قطعه با کاتالوگ صنعت پیش'
        : results.length && results.every(item => item.matchBasis === 'explore')
          ? 'نزدیک‌ترین گزینه‌ها برای بررسی پیدا شدند؛ تطبیق قطعی نیست'
          : results.length
            ? 'برای مشاهده مشخصات، روی کارت محصول بزنید'
          : analysisComplete && !results.length
            ? 'جست‌وجو کامل شد؛ نتیجه قابل اتکایی پیدا نشد'
            : status === 'fallback'
              ? 'تشخیص خودکار کامل نشد؛ با کشیدن کادر، قطعه را دستی مشخص کنید'
              : 'تصویر آماده بررسی خودکار است';

  return (
    <section
      className="kiki-vision-review-shell kiki-image-workspace"
      dir="ltr"
      aria-label="میزکار شناسایی تصویری FORZA"
      aria-busy={working || Boolean(busy)}
      data-testid="image-region-review"
      data-sheet-expanded={sheetExpanded}
      data-sheet-dragging={sheetDragging}
    >
      <section className="kiki-image-workspace__catalog" dir="rtl" aria-label="محصولات مشابه کاتالوگ" data-testid="kiki-mobile-results-sheet">
        <button
          type="button"
          className="kiki-image-workspace__sheet-handle"
          aria-label={sheetExpanded ? 'جمع کردن پنل محصولات و نمایش تصویر' : 'باز کردن پنل محصولات'}
          aria-expanded={sheetExpanded}
          aria-controls="kiki-image-workspace-catalog-body"
          data-testid="kiki-mobile-results-sheet-handle"
          onPointerDown={handleSheetPointerDown}
          onPointerMove={handleSheetPointerMove}
          onPointerUp={finishSheetPointer}
          onPointerCancel={cancelSheetPointer}
          onLostPointerCapture={cancelSheetPointer}
          onClick={handleSheetClick}
        >
          <span className="kiki-image-workspace__sheet-grip" aria-hidden="true" />
          <span>{sheetExpanded ? 'برای بازگشت به تصویر، پنل را پایین بکشید' : 'برای دیدن محصولات، پنل را بالا بکشید'}</span>
          {sheetExpanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronUp size={15} aria-hidden="true" />}
        </button>
        <header className="kiki-image-workspace__catalog-header">
          <div className="kiki-image-workspace__catalog-identity">
            <img src={image} alt="تصویر قطعه انتخاب‌شده" />
            <div>
              <h2>محصولات مشابه کاتالوگ</h2>
              <p>{analysisBusy ? 'نتایج به‌محض آماده‌شدن نمایش داده می‌شوند' : results.length && results.every(item => item.matchBasis === 'explore') ? 'گزینه‌های نزدیک کاتالوگ؛ نوع و سازگاری هنوز تأیید نشده‌اند' : 'برای دیدن کد، مشخصات و مدل‌ها، کارت محصول را باز کنید'}</p>
            </div>
          </div>
          <span className="kiki-image-workspace__catalog-mark" aria-hidden="true">FORZA</span>
        </header>

        <div className="kiki-image-workspace__catalog-body" id="kiki-image-workspace-catalog-body">
          <div className="kiki-image-workspace__status" role="status" aria-live="polite">
            {working
              ? <LoaderCircle size={16} aria-hidden="true" />
              : <span className="kiki-image-workspace__status-dot" aria-hidden="true" />}
            <span>{statusText}</span>
            {selectedRegion && <small>قطعه انتخاب‌شده روی تصویر مشخص است</small>}
          </div>

          {beltAnalysis && (
            <section
              className="kiki-image-workspace__belt-analysis"
              dir="rtl"
              aria-label="تحلیل تخصصی تسمه"
              data-testid="kiki-inline-belt-analysis"
              data-visual-confirmed={beltAnalysis.visualBeltConfirmed}
            >
              <header className="kiki-image-workspace__belt-header">
                <strong>بررسی تخصصی تسمه</strong>
                <span>{beltAnalysis.visualBeltConfirmed ? 'تطبیق تصویری خانواده تسمه' : 'تطبیق تصویری تأیید نشد'}</span>
              </header>
              <div className="kiki-image-workspace__belt-metrics">
                <div><span>نوع / وضعیت</span><strong>{beltAnalysis.beltTypeLabel}</strong></div>
                <div><span>پروفیل خوانده‌شده</span><strong dir="ltr">{beltAnalysis.profile || 'خوانده نشد'}</strong></div>
                <div><span>گام اسمی پروفیل</span><strong>{beltAnalysis.nominalPitchMm ? String(beltAnalysis.nominalPitchMm) + ' mm' : 'مشخص نشد'}</strong></div>
                <div><span>مارکینگ طول</span><strong dir="ltr">{beltAnalysis.lengthMarking || 'خوانده نشد'}</strong></div>
              </div>
              {beltAnalysis.brandMarking && (
                <p className="kiki-image-workspace__belt-detail">نشان خوانده‌شده: <strong dir="ltr">{beltAnalysis.brandMarking}</strong></p>
              )}
              {!!beltAnalysis.codeMatches.length && (
                <p className="kiki-image-workspace__belt-detail">کدهای دقیق منطبق در کاتالوگ: <strong dir="ltr">{beltAnalysis.codeMatches.join('، ')}</strong></p>
              )}
              {!!beltAnalysis.candidateFamilies.length && (
                <p className="kiki-image-workspace__belt-detail">
                  خانواده‌های قابل بررسی: {beltAnalysis.candidateFamilies.map(item => [item.familyName, item.profile && 'پروفیل ' + item.profile, item.sizesSummary && 'اندازه‌ها: ' + item.sizesSummary].filter(Boolean).join(' · ')).join('، ')}
                </p>
              )}
              <p className="kiki-image-workspace__belt-note">{beltAnalysis.note}</p>
            </section>
          )}

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
                const score = typeof item.similarityScore === 'number'
                  ? Math.round(item.similarityScore <= 1 ? item.similarityScore * 100 : item.similarityScore)
                  : undefined;
                return (
                  <article className={'kiki-image-workspace__result-card' + (selected ? ' is-selected' : '')}
                    key={item.id} data-selected={selected || undefined} data-match-basis={item.matchBasis || 'visual'}>
                    <button type="button" className="kiki-image-workspace__result-select"
                      onClick={() => { onSelectProduct(item.id); onOpenProduct(item.id); }}
                      disabled={selectorDisabled}
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
        <p className="kiki-image-workspace__viewer-hint" data-testid="kiki-manual-crop-hint">
          کادر پیشنهادی را لمس کنید؛ اگر قطعه پیدا نشد، انگشت را روی تصویر بکشید و دور قطعه کادر برش دستی بسازید. تحلیل دوباره خودکار اجرا می‌شود.
        </p>
      </aside>
    </section>
  );
}
