import React from 'react';
import { AlertCircle, CheckCircle2, ImagePlus, LoaderCircle, RefreshCw, ScanSearch, Sparkles, Target } from 'lucide-react';
import { ImageRegionSelector } from './ImageRegionSelector';
import type { ImagePoint } from '../../utils/imageRegionInteraction';
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
  selectionError?: string;
  busy?: boolean;
  selectionBusy?: boolean;
  onSelectPoint: (point:ImagePoint) => void;
  onConfirm: () => void;
  onRetryPreparation: () => void;
  onRetryAnalysis: () => void;
  onChangeImage: () => void;
}

export function ImageRegionReview({
  image, status, selectedRegion, candidateRegions, message, analysisError, selectionError, busy, selectionBusy,
  onSelectPoint, onConfirm, onRetryPreparation, onRetryAnalysis, onChangeImage,
}: Props) {
  const preparing = status === 'uploading' || status === 'detecting';
  const detected = Boolean(selectedRegion);
  return (
    <section className="sp-region-review" dir="rtl" aria-label="تأیید قطعه پیش از تحلیل" data-testid="image-region-review">
      <header className="sp-region-review__header">
        <div className="sp-region-review__brand">
          <span className="sp-region-review__brand-icon"><ScanSearch size={22} aria-hidden="true" /></span>
          <div>
            <span className="sp-region-review__eyebrow">FORZA VISION · TAP TO SELECT</span>
            <h2>{preparing ? 'در حال پیدا کردن قطعه در تصویر' : detected ? 'قطعه برای تحلیل آماده است' : 'قطعه موردنظر را لمس کنید'}</h2>
            <p>{preparing ? 'تصویر را بررسی می‌کنیم و برش اولیه را آماده می‌کنیم.' : 'روی خود قطعه ضربه بزنید؛ سیستم مرز همان قطعه را جدا می‌کند.'}</p>
          </div>
        </div>
        <span className={`sp-region-review__status ${preparing || selectionBusy ? 'is-busy' : status === 'fallback' ? 'is-manual' : 'is-ready'}`}>
          {preparing || selectionBusy ? <LoaderCircle size={14} className="sp-region-review__spin" /> : status === 'fallback' ? <Target size={14} /> : <CheckCircle2 size={14} />}
          {status === 'uploading' ? 'دریافت تصویر' : status === 'detecting' ? 'تشخیص اولیه' : selectionBusy ? 'استخراج قطعه' : status === 'fallback' ? 'انتخاب با لمس' : detected ? 'برش آماده' : 'آماده انتخاب'}
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
            <span className="sp-region-review__scanner-caption"><Sparkles size={15} /> {status === 'uploading' ? 'در حال آماده‌سازی امن تصویر' : 'در حال مقایسه نمای تصویر و کاتالوگ'}</span>
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
              <strong>{detected ? 'برش پیش‌فرض آماده است؛ در صورت نیاز قطعه دیگری را لمس کنید' : 'روی بخش داخلی قطعه موردنظر ضربه بزنید'}</strong>
              <span>{candidateRegions.length > 1 ? 'کادرهای شماره‌دار پیشنهادهای اولیه‌اند؛ لمس هر نقطه، همان شیء را دوباره استخراج می‌کند.' : 'نیازی به کشیدن کادر نیست؛ فقط خود قطعه را لمس کنید.'}</span>
            </div>
          </div>

          <ImageRegionSelector
            src={image}
            value={selectedRegion}
            candidateRegions={candidateRegions}
            onChange={() => {}}
            onSelectPoint={onSelectPoint}
            selectionBusy={selectionBusy}
            selectionError={selectionError}
          />

          {status === 'fallback' && (
            <div className="sp-region-review__notice" role="status">
              <AlertCircle size={17} aria-hidden="true" />
              <div><strong>{busy ? 'تصویر هنوز آماده ارسال نیست.' : 'برش خودکار اولیه کامل نشد؛ انتخاب با لمس همچنان فعال است.'}</strong><span>{message || 'روی خود قطعه ضربه بزنید؛ اگر مرز آن پیدا نشود، انتخاب قبلی حفظ می‌شود.'}</span></div>
              <button type="button" onClick={onRetryPreparation}>تلاش مجدد</button>
            </div>
          )}
          {status === 'ready' && !detected && (
            <div className="sp-region-review__notice is-neutral" role="status">
              <Target size={17} aria-hidden="true" />
              <div><strong>برش اولیه قابل‌اعتماد پیدا نشد.</strong><span>روی خود قطعه ضربه بزنید تا موتور، ناحیه همان نقطه را استخراج کند.</span></div>
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
        <button type="button" className="sp-region-review__change" onClick={onChangeImage} disabled={preparing || selectionBusy}>
          <ImagePlus size={17} /> تغییر تصویر
        </button>
        <button type="button" className="sp-region-review__confirm" onClick={onConfirm} disabled={preparing || busy || selectionBusy}>
          <CheckCircle2 size={18} />
          <span>{selectionBusy ? 'در حال استخراج قطعه…' : selectedRegion ? 'تأیید برش و شروع تحلیل' : 'تأیید تصویر و شروع تحلیل'}</span>
        </button>
      </footer>
    </section>
  );
}
