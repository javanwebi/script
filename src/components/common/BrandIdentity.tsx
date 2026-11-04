import React, { useState } from "react";
import { STORE_ASSETS } from "../../assets/images";

/** Official Sanat Pish visual identity. Different from the FORZA workspace mark. */
export function SanatPishLogo({ className = "", alt = "لوگوی صنعت پیش", priority = false }: {
  className?: string;
  alt?: string;
  priority?: boolean;
}) {
  return <img src={STORE_ASSETS.sanatPishLogo} alt={alt} className={className}
    decoding="async" loading={priority ? "eager" : "lazy"} />;
}

/** Footer-specific identity. logo2.png is expected in the public asset directory.
 * Until the owner-supplied second asset exists, show the confirmed logo.png
 * instead of a broken image. No generated or invented company logo is used.
 */
export function SanatPishFooterLogo({ className = "" }: { className?: string }) {
  const [fallback, setFallback] = useState(false);
  return <img src={fallback ? STORE_ASSETS.sanatPishLogo : "/logo2.png"}
    alt="لوگوی صنعت پیش" className={className} decoding="async" loading="lazy"
    onError={() => setFallback(true)} />;
}
