import React, { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getProductImageUrl } from "../../assets/imagesproducts";

/**
 * Product photos always preserve their PostgreSQL family/SKU binding.
 * Browsers receive a fast WebP thumbnail from the Railway persistent volume,
 * with the original local file as a safe fallback.
 */
export const ProductImage: React.FC<React.ImgHTMLAttributes<HTMLImageElement>> = ({
 src, alt, className, onError, loading, decoding, sizes, srcSet, ...props
}) => {
 const [fallback, setFallback] = useState(false);
 useEffect(() => setFallback(false), [src]);
 const image=src?(getProductImageUrl(src)||src):'';
 const local = /^\/storage\/products\/(?:catalog\/e\([1-9]\d{0,3}\)\.(?:png|jpg)|[a-f0-9-]{36}\.webp)$/.test(image);
 if (!image) return (
  <span role="img" aria-label={`تصویر ${alt || "محصول"} هنوز ثبت نشده`}
   className={`${className || ""} flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400`}>
   <ImageOff className="w-7 h-7 shrink-0" aria-hidden="true" />
   <span className="text-[10px] font-normal text-center">تصویر هنوز ثبت نشده</span>
  </span>
 );
 const responsive=local&&!fallback;
 return (
  <img {...props}
   src={responsive?image+"?w=420":image}
   srcSet={responsive?`${image}?w=420 420w, ${image}?w=840 840w`:srcSet}
   sizes={responsive?(sizes||"(max-width: 640px) 48vw, (max-width: 1024px) 28vw, 280px"):sizes}
   loading={loading||"lazy"} decoding={decoding||"async"}
   alt={alt} className={className}
   onError={event=>{
    if(responsive)setFallback(true);
    else onError?.(event);
   }}
  />
 );
};
