"use client";

import { useEffect } from "react";
import { captureAdAttribution } from "@/app/lib/ads/first-touch";

/**
 * Records how the visitor arrived, on the page they arrived on.
 *
 * Lives in the website layout rather than in the forms because an ad can land
 * on a page with no form, and the visitor can navigate client-side before they
 * enquire — by which point the click id is no longer in the URL. The layout
 * survives client-side navigation, so this runs once per landing.
 */
export function AdAttributionCapture() {
  useEffect(() => {
    captureAdAttribution();
  }, []);
  return null;
}
