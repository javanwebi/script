import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
const RAW = "https://raw.githubusercontent.com/javanweb/imagesatlas/main/";
const CDN = "https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@main/";
/** Retry the same official image on an alternate host; never substitute another SKU's photo. */
export const ProductImage: React.FC<
  React.ImgHTMLAttributes<HTMLImageElement>
> = ({ src, alt, className, onError, ...props }) => {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [src]);
  const candidates = src?.startsWith(RAW)
    ? [CDN + src.slice(RAW.length), src]
    : src?.startsWith(CDN)
      ? [src, RAW + src.slice(CDN.length)]
      : src
        ? [src]
        : [];
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
