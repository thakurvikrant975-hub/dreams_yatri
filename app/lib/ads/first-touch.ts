import { readAdAttribution, type AdAttribution } from "./attribution";

/**
 * First-touch ad attribution for the website's own forms.
 *
 * The click id and the ValueTrack ids exist only on the landing hit. So the
 * arrival is captured once, on whichever page the visitor lands on
 * (AdAttributionCapture, mounted in the website layout), and each form reads
 * the stored copy when it submits.
 *
 * First touch wins, for 30 days: the ad that earned the visit keeps the credit
 * even if the visitor comes back later on their own. That is what the .com
 * site's dy_capture.php does with its cookie, and the two sites feed one report
 * — they must not disagree about which ad a lead belongs to. Unlike that
 * cookie, a visit carrying no evidence stores nothing, so someone who first
 * arrived directly is still attributed when they later click an ad.
 *
 * Browser-only. Every storage call is guarded: private windows and blocked site
 * data throw, and a lead must never fail over attribution.
 */

const STORAGE_KEY = "dy.adAttribution";
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // DY_ATTRIB_TTL in dy_capture.php

type Stored = { at: number; data: AdAttribution };

function readStored(now: number): AdAttribution | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Partial<Stored>;
    if (typeof s.at !== "number" || now - s.at > TTL_MS) return null;
    if (!s.data || typeof s.data !== "object") return null;
    return s.data;
  } catch {
    return null;
  }
}

/** The arrival this visitor is credited to — recording it if this is it. */
export function captureAdAttribution(): AdAttribution | undefined {
  if (typeof window === "undefined") return undefined;
  const now = Date.now();
  const stored = readStored(now);
  if (stored) return stored;

  const fresh = readAdAttribution(window.location.search, new Date(now));
  if (!fresh) return undefined;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ at: now, data: fresh } satisfies Stored));
  } catch {
    // Still attributed for this page view, just not remembered past it.
  }
  return fresh;
}
