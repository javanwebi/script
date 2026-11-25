import { validImageRegion, type ImageRegion } from '../../utils/imageRegion';

function sameRegion(a?: ImageRegion, b?: ImageRegion) {
  return Boolean(a && b) &&
    Math.abs(a!.x - b!.x) < 0.002 &&
    Math.abs(a!.y - b!.y) < 0.002 &&
    Math.abs(a!.width - b!.width) < 0.002 &&
    Math.abs(a!.height - b!.height) < 0.002;
}

function toPersianNumber(value: number) {
  return String(value).replace(/[0-9]/g, digit => '۰۱۲۳۴۵۶۷۸۹'[Number(digit)]);
}

interface Props {
  src: string;
  value?: ImageRegion;
  candidateRegions?: ImageRegion[];
  onChange: (region: ImageRegion | undefined) => void;
  disabled?: boolean;
  variant?: 'default' | 'viewer';
}

/**
 * Automatic-only part picker.
 * The vision model supplies candidate boxes; the customer selects a detected
 * part by tapping its overlay. No manual drawing, resizing or confirm/search
 * controls are exposed here. Selection immediately flows to catalog analysis.
 */
export function ImageRegionSelector({
  src,
  value,
  candidateRegions = [],
  onChange,
  disabled = false,
  variant = 'viewer',
}: Props) {
  const candidates = candidateRegions.filter(validImageRegion);
  const visibleRegions = candidates.length
    ? candidates
    : value && validImageRegion(value)
      ? [value]
      : [];
  const viewer = variant === 'viewer';

  return (
    <section
      className={'sanat-region-picker' + (viewer ? ' sanat-region-picker--viewer' : '')}
      aria-label="انتخاب خودکار قطعه در تصویر"
      aria-disabled={disabled || undefined}
      aria-busy={disabled || undefined}
      data-testid="image-region-selector"
      dir="rtl"
    >
      {!viewer && (
        <header className="sanat-region-picker__header">
          <div className="sanat-region-picker__heading">
            <span className="sanat-region-picker__icon" aria-hidden="true">⌖</span>
            <div>
              <strong>قطعات شناسایی‌شده در تصویر</strong>
              <p>برای مشاهده محصولات مشابه، روی کادر قطعه موردنظر بزنید.</p>
            </div>
          </div>
          <span className="sanat-region-picker__status">
            {visibleRegions.length ? toPersianNumber(visibleRegions.length) + ' قطعه' : 'در حال بررسی'}
          </span>
        </header>
      )}

      <div className="sanat-region-picker__layout">
        <div className="sanat-region-picker__canvas">
          <div
            className="sanat-region-picker__frame sanat-region-picker__frame--automatic"
            dir="ltr"
            data-testid="vision-automatic-image-frame"
            onClick={(event) => {
              if (disabled) return;
              const bounds = event.currentTarget.getBoundingClientRect();
              if (!bounds.width || !bounds.height) return;
              const x = (event.clientX - bounds.left) / bounds.width;
              const y = (event.clientY - bounds.top) / bounds.height;
              const hit = visibleRegions
                .filter(region => x >= region.x && x <= region.x + region.width && y >= region.y && y <= region.y + region.height)
                .sort((a, b) => a.width * a.height - b.width * b.height)[0];
              if (hit) onChange(hit);
            }}
          >
            <img
              src={src}
              alt="تصویر قطعه با نواحی شناسایی‌شده خودکار"
              draggable={false}
            />
            {visibleRegions.map((region, index) => {
              const selected = sameRegion(value, region);
              return (
                <button
                  key={index}
                  type="button"
                  className={'sanat-region-picker__candidate' + (selected ? ' is-selected' : '')}
                  style={{
                    left: region.x * 100 + '%',
                    top: region.y * 100 + '%',
                    width: region.width * 100 + '%',
                    height: region.height * 100 + '%',
                  }}
                  aria-label={'انتخاب قطعه ' + toPersianNumber(index + 1)}
                  aria-pressed={selected}
                  disabled={disabled}
                  onClick={(event) => { event.stopPropagation(); onChange(region); }}
                >
                  <span>{toPersianNumber(index + 1)}</span>
                  <i className="fv-lens-corner fv-lens-corner--tl" aria-hidden="true" />
                  <i className="fv-lens-corner fv-lens-corner--tr" aria-hidden="true" />
                  <i className="fv-lens-corner fv-lens-corner--bl" aria-hidden="true" />
                  <i className="fv-lens-corner fv-lens-corner--br" aria-hidden="true" />
                  {selected && <span className="sanat-region-picker__selected-mark">انتخاب‌شده</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {visibleRegions.length > 1 && (
        <div
          className="fv-region-candidates"
          role="group"
          aria-label="انتخاب یکی از قطعات شناسایی‌شده"
          data-testid="vision-region-candidates"
        >
          <span className="fv-region-candidates__heading">قطعات پیدا‌شده:</span>
          {visibleRegions.map((region, index) => (
            <button
              key={index}
              type="button"
              aria-pressed={sameRegion(value, region)}
              disabled={disabled}
              className={'fv-region-candidates__item' + (sameRegion(value, region) ? ' is-active' : '')}
              onClick={() => onChange(region)}
            >
              قطعه {toPersianNumber(index + 1)}
            </button>
          ))}
        </div>
      )}

      {!visibleRegions.length && (
        <p className="sanat-region-picker__auto-fallback" role="status">
          ناحیه مستقل قابل‌اعتماد پیدا نشد؛ جست‌وجوی خودکار روی کل تصویر انجام می‌شود.
        </p>
      )}
    </section>
  );
}
