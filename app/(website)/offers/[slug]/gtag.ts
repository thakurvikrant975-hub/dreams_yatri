"use client";

// Minimal Google Ads conversion tracking for /offers pages — there is no
// global GTM/gtag loader anywhere else in this app (checked), so each
// published landing page loads its own gtag.js only if at least one of its
// three send_to fields is configured; a page with none configured never
// loads any tracking script at all.

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/** The "AW-123456789" prefix gtag's base config call needs — taken from
 * whichever send_to value ("AW-123456789/AbCdEfGh") is set first. */
export function getAdsAccountId(sendTos: (string | null | undefined)[]): string | null {
  for (const s of sendTos) {
    if (s && s.includes("/")) return s.split("/")[0];
  }
  return null;
}

/** Fires a single Google Ads conversion event. No-op if sendTo is unset or
 * gtag hasn't loaded (e.g. the account id above was null). */
export function fireConversion(sendTo: string | null | undefined) {
  if (!sendTo || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "conversion", { send_to: sendTo });
}
