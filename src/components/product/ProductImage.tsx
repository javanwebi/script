import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getProductImageUrl, normalizeImageFileName } from "../../assets/imagesproducts";
import { catalogImageAssets } from "../../generated/catalogImageAssets";

const RAW = "https://raw.githubusercontent.com/javanweb/imagesatlas/main/";
const CDN = "https://cdn.jsdelivr.net/gh/javanweb/imagesatlas@main/";
/** Responsive official product photos from the build; never substitute another SKU. */
export const ProductImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> =
  ({ src, alt, className, onError, loading, sizes, fetchPriority, ...props }) => {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [src]);
  const local = src ? getProductImageUrl(src) : "";
  const official = local.startsWith("/products/catalog/") ?
    normalizeImageFileName(local.split("/").at(-1)) : "";
  const uploaded = /^\/products\/uploads\/optimized\/([a-f0-9-]{36}\.[a-f0-9]{12})\.w960\.webp$/.exec(local);
  const variants = official ? catalogImageAssets[official] :
    uploaded ? {thumb:'/products/uploads/optimized/'+uploaded[1]+'.w320.webp',medium:local} : undefined;
  const candidates = variants ?
    [variants.medium, local] :
    src?.startsWith(RAW) ? [CDN + src.slice(RAW.length), src] :
    src?.startsWith(CDN) ? [src, RAW + src.slice(CDN.length)] :
    local ? [local] : [];
  const current = candidates[attempt];
  if (!current) return (
    <span role="img" aria-label={src ? `تصویر ${alt || "محصول"} بارگذاری نشد` :
      `تصویر ${alt || "محصول"} هنوز ثبت نشده`}
      className={`${className || ""} flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400`}>
      <ImageOff className="w-7 h-7 shrink-0" aria-hidden="true" />
      <span className="text-[10px] font-normal text-center">
        {src ? "تصویر بارگذاری نشد" : "تصویر هنوز ثبت نشده"}
      </span>
    </span>
  );
  return (
    <img {...props} src={current} alt={alt} className={className}
      loading={loading ?? "lazy"} decoding="async" fetchPriority={fetchPriority}
      sizes={sizes ?? "(max-width: 640px) 48vw, (max-width: 1024px) 33vw, 280px"}
      srcSet={attempt === 0 && variants ?
        `${variants.thumb} 320w, ${variants.medium} 960w` : undefined}
      onError={(event) => {
        if (attempt + 1 >= candidates.length) onError?.(event);
        setAttempt(n => Math.min(n + 1, candidates.length));
      }}
    />
  );
};
