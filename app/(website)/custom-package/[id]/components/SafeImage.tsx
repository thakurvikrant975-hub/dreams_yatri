"use client";

import { useState } from "react";

/** Plain `<img>` (not next/image) that swaps to a fallback if the URL is
 * empty, on an unconfigured domain, or otherwise fails to load — needed for
 * AI-sourced photos (the AI Itinerary Builder can return images from any
 * domain, not just the ones whitelisted in next.config.ts's remotePatterns,
 * which next/image would otherwise refuse to load). */
export function SafeImage({
  src, alt, className, fallback,
}: {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  // Reset the failed flag when the src changes, without an effect — setting
  // state during render (guarded by the src-changed check) is the React-
  // recommended pattern for "adjust state in response to a prop change".
  const [lastSrc, setLastSrc] = useState(src);
  if (src !== lastSrc) {
    setLastSrc(src);
    setFailed(false);
  }
  if (!src || failed) return <>{fallback ?? null}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- AI/catalog-sourced URL, arbitrary domain, not a static app asset
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
