import { useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, Scan } from 'lucide-react';
import type { ImageRegion } from '../../utils/imageRegion';
import './automatic-image-crop.css';

type CropStatus = 'uploading' | 'detecting' | 'ready' | 'fallback';

interface Props {
  src: string;
  region?: ImageRegion;
  candidateRegions?: ImageRegion[];
  onSelectRegion?: (region: ImageRegion) => void;
  status: CropStatus;
  compact?: boolean;
}

function sameRegion(left: ImageRegion | undefined, right: ImageRegion | undefined): boolean {
  return Boolean(left && right &&
    Math.abs(left.x - right.x) < 0.002 &&
    Math.abs(left.y - right.y) < 0.002 &&
    Math.abs(left.width - right.width) < 0.002 &&
    Math.abs(left.height - right.height) < 0.002);
}

export function AutomaticImageCrop({
  src,
  region,
  candidateRegions = [],
  onSelectRegion,
  status,
  compact = false,
}: Props) {
  const [imageAspect, setImageAspect] = useState(1);
  const uploading = status === 'uploading';
  const detecting = status === 'detecting';
  const preparing = uploading || detecting;
  const cropReady = Boolean(region);
  const selectableRegions = [...candidateRegions];
  if (region && !selectableRegions.some(candidate => sameRegion(candidate, region))) {
    selectableRegions.unshift(region);
  }
  const canSelectRegion = status === 'ready' && Boolean(onSelectRegion) && selectableRegions.length > 0;
  const selectedCandidateIndex = region
    ? selectableRegions.findIndex(candidate => sameRegion(candidate, region))
    : -1;
  const previewAspect = region ? imageAspect * region.width / region.height : 1;
  let previewWidth = Math.min(136, Math.max(76, 96 * previewAspect));
  let previewHeight = previewWidth / Math.max(0.15, previewAspect);
  if (previewHeight > 86) {
    previewHeight = 86;
    previewWidth = previewHeight * previewAspect;
  }
  const cropPreviewStyle = region ? {
    width: previewWidth + 'px',
    height: previewHeight + 'px',
    flexBasis: previewWidth + 'px',
    aspectRatio: String(previewAspect),
    backgroundImage: 'url(' + JSON.stringify(src) + ')',
    backgroundSize: (100 / region.width) + '% ' + (100 / region.height) + '%',
    backgroundPosition:
      (region.width < 1 ? 100 * region.x / (1 - region.width) : 0) + '% ' +
      (region.height < 1 ? 100 * region.y / (1 - region.height) : 0) + '%',
  } : undefined;
  const regionValue = region
    ? [region.x, region.y, region.width, region.height].map(value => value.toFixed(5)).join(',')
    : '';

  return (
    <section
      className={'forza-auto-crop' + (compact ? ' is-compact' : '')}
      data-testid="forza-automatic-crop"
      data-crop-ready={cropReady ? 'true' : 'false'}
      data-region={regionValue}
      data-region-count={selectableRegions.length}
      aria-label="تشخیص و برش خودکار قطعه"
    >
      <div className="forza-auto-crop__image-stage">
        <div className="forza-auto-crop__frame" data-testid="forza-automatic-crop-frame">
          <img
            src={src}
            alt="تصویر کامل ارسالی مشتری؛ کادرهای شماره‌دار محدوده قطعات شناسایی‌شده را نشان می‌دهند"
            draggable={false}
            onLoad={event => {
              const image = event.currentTarget;
              setImageAspect((image.naturalWidth || 1) / (image.naturalHeight || 1));
            }}
          />
          {canSelectRegion ? selectableRegions.map((candidate, index) => {
            const selected = index === selectedCandidateIndex;
            return (
              <button
                type="button"
                key={[candidate.x, candidate.y, candidate.width, candidate.height].join(':')}
                className={'forza-auto-crop__candidate' + (selected ? ' is-selected' : '')}
                data-testid={'forza-region-candidate-' + (index + 1)}
                data-selected={selected ? 'true' : 'false'}
                aria-label={'انتخاب قطعه ' + (index + 1) + ' از ' + selectableRegions.length}
                aria-pressed={selected}
                onClick={() => onSelectRegion?.(candidate)}
                style={{
                  left: candidate.x * 100 + '%',
                  top: candidate.y * 100 + '%',
                  width: candidate.width * 100 + '%',
                  height: candidate.height * 100 + '%',
                }}
              >
                <span aria-hidden="true">{index + 1}</span>
              </button>
            );
          }) : region && (
            <div
              className="forza-auto-crop__bounds"
              aria-label="محدوده‌ای که هوش مصنوعی برای برش قطعه تشخیص داده است"
              style={{
                left: region.x * 100 + '%',
                top: region.y * 100 + '%',
                width: region.width * 100 + '%',
                height: region.height * 100 + '%',
              }}
            >
              <span className="forza-auto-crop__bounds-label">برش خودکار</span>
              <i className="is-tl" />
              <i className="is-tr" />
              <i className="is-bl" />
              <i className="is-br" />
            </div>
          )}
        </div>
      </div>

      <div className={'forza-auto-crop__proof' + (cropReady ? ' is-ready' : preparing ? ' is-detecting' : ' is-fallback')}
        data-testid="forza-automatic-crop-proof" role="status" aria-live="polite">
        {cropReady && cropPreviewStyle && (
          <div className="forza-auto-crop__thumbnail" data-testid="forza-automatic-crop-thumbnail" style={cropPreviewStyle} aria-label="پیش‌نمایش دقیق برش ارسالی به کاتالوگ" />
        )}
        <div className="forza-auto-crop__copy">
          <strong>
            {cropReady
              ? <><CheckCircle2 size={16} aria-hidden="true" /> قطعه پیدا شد؛ برش خودکار انجام شد</>
              : uploading
                ? <><LoaderCircle size={16} aria-hidden="true" /> در حال آماده‌سازی تصویر</>
                : detecting
                  ? <><LoaderCircle size={16} aria-hidden="true" /> در حال پیدا کردن قطعه در تصویر</>
                  : selectableRegions.length
                    ? <><Scan size={16} aria-hidden="true" /> ناحیه‌های پیشنهادی پیدا شدند</>
                    : <><AlertCircle size={16} aria-hidden="true" /> برش دقیق قطعه تأیید نشد</>}
          </strong>
          <span>
            {cropReady
              ? selectableRegions.length > 1
                ? 'کادر نارنجی و پیش‌نمایش، قطعه انتخاب‌شده را نشان می‌دهند. برای انتخاب قطعه دیگر، روی کادر شماره‌دار آن ضربه بزنید.'
                : 'کادر نارنجی و پیش‌نمایش، دقیقاً محدوده‌ای را نشان می‌دهند که برای جست‌وجوی کاتالوگ استفاده شده است.'
              : uploading
                ? 'تصویر در حافظه خصوصی دستگاه آماده می‌شود.'
                : detecting
                  ? 'موتور تشخیص، ناحیه قطعه را با تصاویر کاتالوگ مقایسه می‌کند.'
                  : selectableRegions.length
                    ? 'برای انتخاب قطعه موردنظر، روی کادر شماره‌دار آن ضربه بزنید؛ برش و جست‌وجوی کاتالوگ خودکار انجام می‌شود.'
                    : 'برای جلوگیری از برش اشتباه، جست‌وجو به‌صورت خودکار روی تصویر کامل انجام می‌شود.'}
          </span>
        </div>
        <span className="forza-auto-crop__badge">
          {cropReady
            ? selectableRegions.length > 1
              ? 'قطعه ' + (selectedCandidateIndex + 1) + ' از ' + selectableRegions.length
              : <><CheckCircle2 size={13} aria-hidden="true" /> برش فعال</>
            : uploading
              ? 'آماده‌سازی'
              : detecting
                ? <><Scan size={13} aria-hidden="true" /> در حال تشخیص</>
                : selectableRegions.length
                  ? selectableRegions.length.toLocaleString('fa-IR') + ' ناحیه'
                  : 'تصویر کامل'}
        </span>
      </div>
    </section>
  );
}
