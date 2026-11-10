import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageOff, ZoomIn, X } from 'lucide-react';
import { getProductImageUrl } from '../../assets/imagesproducts';

/**
 * Only render URLs already registered in the real catalogue volume.
 * If the API returns a generated thumbnail, use its full-resolution original
 * first and retain the thumbnail as a fallback. Never fabricate a SKU photo.
 */
export function getCatalogDisplayImageCandidates(inputs: Array<string | null | undefined>): string[] {
  const urls: string[] = [];
  for (const raw of inputs) {
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (!value) continue;
    const thumbnail = /^\/storage\/products\/thumbs\/e\(([1-9]\d{0,3})\)\.webp$/i.exec(value);
    if (thumbnail) {
      const original = getProductImageUrl('e(' + thumbnail[1] + ').png');
      if (original && !urls.includes(original)) urls.push(original);
    }
    const resolved = getProductImageUrl(value);
    if (resolved && !urls.includes(resolved)) urls.push(resolved);
  }
  return urls;
}

interface Props {
  sources: Array<string | null | undefined>;
  alt: string;
  familyReference?: boolean;
  className?: string;
  eager?: boolean;
}

export function CatalogResultImage({ sources, alt, familyReference = false, className = '', eager = false }: Props) {
  const candidates = getCatalogDisplayImageCandidates(sources);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [zoomOpen, setZoomOpen] = useState(false);
  const zoomButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const image = candidates[sourceIndex] || '';
  useEffect(() => {
    if (!zoomOpen) return;
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // The outer scan modal also listens for Escape on window. Close only
      // the image lightbox, without accidentally discarding the scan session.
      event.preventDefault();
      event.stopPropagation();
      setZoomOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      zoomButtonRef.current?.focus();
    };
  }, [zoomOpen]);

  const photo = image ? (
    <img
      src={image}
      alt={alt}
      width={560}
      height={560}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setSourceIndex(index => index + 1)}
    />
  ) : (
    <span className="sp-catalog-photo__missing">
      <ImageOff size={27} strokeWidth={1.5} aria-hidden="true" />
      <span>تصویر معتبر در کاتالوگ ثبت نشده</span>
    </span>
  );

  return (
    <div className={['sp-catalog-photo', className].filter(Boolean).join(' ')}>
      {image ? (
        <button
          type="button"
          ref={zoomButtonRef}
          className="sp-catalog-photo__open"
          onClick={() => setZoomOpen(true)}
          aria-label={'بزرگ‌نمایی تصویر ' + alt}
          aria-haspopup="dialog"
        >
          {photo}
          <span className="sp-catalog-photo__zoom"><ZoomIn size={16} aria-hidden="true" /> بزرگ‌نمایی</span>
        </button>
      ) : (
        <div className="sp-catalog-photo__empty" role="img" aria-label={'بدون تصویر: ' + alt}>{photo}</div>
      )}
      {familyReference && image && (
        <span className="sp-catalog-photo__family">تصویر مرجع خانواده؛ نه تأیید مدل</span>
      )}
      {zoomOpen && image && typeof document !== 'undefined' && createPortal(
        <div
          className="sp-catalog-lightbox"
          role="presentation"
          onClick={() => setZoomOpen(false)}
        >
          <div className="sp-catalog-lightbox__dialog" role="dialog" aria-modal="true" aria-label={'تصویر بزرگ ' + alt} onClick={event => event.stopPropagation()}>
            <div className="sp-catalog-lightbox__toolbar">
              <span>{alt}</span>
              <button type="button" ref={closeButtonRef} aria-label="بستن تصویر بزرگ" onClick={() => setZoomOpen(false)}>
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <img src={image} alt={alt} onError={() => setSourceIndex(index => index + 1)} />
            <p>{familyReference ? 'این تصویر برای خانواده محصول ثبت شده و تأییدکننده همان مدل نیست.' : 'تصویر واقعی ثبت‌شده در کاتالوگ؛ مشخصات فنی را جداگانه بررسی کنید.'}</p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
