import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getProductImageUrl } from "../../assets/imagesproducts";
/** Product pictures come from the mounted volume; never retry from GitHub/CDN. */
export const ProductImage: React.FC<
  React.ImgHTMLAttributes<HTMLImageElement> & { thumbnail?: boolean }
> = ({ src, alt, className, onError, thumbnail = false, ...props }) => {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [src]);
  const normalized = getProductImageUrl(src);
  const candidates = normalized ? [normalized] : [];
  // Listing cards get a compact derivative, while detail images keep their original resolution.
  // The original image is tried automatically if a thumbnail is not available yet.
  const original = normalized.match(/^\/storage\/products\/catalog\/e\(([1-9]\d{0,3})\)\.png$/);
  if (thumbnail && original) {
    candidates.unshift('/storage/products/thumbs/e(' + original[1] + ').webp');
  }
  const current = candidates[attempt];
  if (!current)
    return (
      <span
        role="img"
        aria-label={
          src
            ? `تصویر ${alt || "محصول"} بارگذاری نشد`
            : `تصویر ${alt || "محصول"} هنوز ثبت نشده`
        }
        className={`${className || ""} flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400`}
      >
        <ImageOff className="w-7 h-7 shrink-0" aria-hidden="true" />
        <span className="text-[10px] font-normal text-center">
          {src ? "تصویر بارگذاری نشد" : "تصویر هنوز ثبت نشده"}
        </span>
      </span>
    );
  return (
    <img
      {...props}
      src={current}
      alt={alt}
      className={className}
      onError={(event) => {
        if (attempt + 1 >= candidates.length) onError?.(event);
        setAttempt((n) => n + 1);
      }}
    />
  );
};
