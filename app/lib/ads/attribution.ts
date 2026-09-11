/**
 * Which ad produced a lead — read off the landing URL, carried to the lead row.
 *
 * Google appends the click id itself (auto-tagging), and the campaign / ad
 * group / creative ids through the account's final URL suffix. Both exist only
 * on the landing hit: one client-side navigation later the URL is clean and
 * the evidence is gone — which is why the website captures it on arrival and
 * the forms read the stored copy at submit (see first-touch.ts).
 *
 * Deliberately no imports and no "server-only". The browser reads a landing
 * URL with this, and intake reads a lead's pageUrl with the same function; two
 * parsers would disagree about what counts as evidence. The .com site's
 * dy_capture.php is the one other reader and follows the same precedence.
 *
 * Field names are the package_queries column names, so the object travels from
 * the browser to the row without a mapping step to drift.
 */

export const CLICK_ID_TYPES = ["GCLID", "GBRAID", "WBRAID"] as const;
export type ClickIdType = (typeof CLICK_ID_TYPES)[number];

/** The ad itself. */
export type AdClick = {
  adsClickId?: string;
  adsClickIdType?: ClickIdType;
  adsCampaignId?: string;
  adsAdGroupId?: string;
  adsCreativeId?: string;
  adsKeyword?: string;
  adsMatchType?: string;
  adsNetwork?: string;
  adsDevice?: string;
  adsTargetId?: string;
  /** ISO instant of the click that earned the visit — first touch, not submit. */
  adsClickAt?: string;
};

/** Everything a landing URL can say about how the visitor arrived. */
export type AdAttribution = AdClick & {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

const AD_CLICK_KEYS = [
  "adsClickId", "adsClickIdType", "adsCampaignId", "adsAdGroupId", "adsCreativeId",
  "adsKeyword", "adsMatchType", "adsNetwork", "adsDevice", "adsTargetId", "adsClickAt",
] as const satisfies ReadonlyArray<keyof AdClick>;

/**
 * Google's three click ids, in dy_capture.php's order. gbraid and wbraid are
 * what iOS traffic carries instead of a gclid; they are told apart because the
 * offline conversion upload takes each in its own field.
 */
const CLICK_IDS: ReadonlyArray<readonly [string, ClickIdType]> = [
  ["gclid", "GCLID"], ["gbraid", "GBRAID"], ["wbraid", "WBRAID"],
];

/** URL parameter → column. The first eight are the ValueTrack names the final
 * URL suffix uses (docs/ads-analytics/ads-analytics-plan.md, Step 1d). */
const PARAMS: ReadonlyArray<readonly [string, keyof AdAttribution]> = [
  ["campaignid", "adsCampaignId"],
  ["adgroupid", "adsAdGroupId"],
  ["creative", "adsCreativeId"],
  ["keyword", "adsKeyword"],
  ["matchtype", "adsMatchType"],
  ["network", "adsNetwork"],
  ["device", "adsDevice"],
  ["targetid", "adsTargetId"],
  ["utm_source", "utmSource"],
  ["utm_medium", "utmMedium"],
  ["utm_campaign", "utmCampaign"],
];

/**
 * A parameter's value, or nothing. An unfilled ValueTrack placeholder counts
 * as nothing: Google leaves `{keyword}` literally in place on a Performance Max
 * click, and anyone testing the suffix by hand sends every one of them —
 * recording it would put "{keyword}" on the report as if it were a search term.
 */
function param(q: URLSearchParams, name: string): string | undefined {
  const v = q.get(name)?.trim();
  return v && !/^\{.*\}$/.test(v) ? v : undefined;
}

/** Whether there is an ad behind this at all, as opposed to utm tags alone. */
export function isAdClick(a: AdClick | null | undefined): boolean {
  return !!(a?.adsClickId || a?.adsCampaignId || a?.adsAdGroupId);
}

/**
 * What a query string says about the arrival, or null when it says nothing.
 *
 * `clickedAt` is stamped on only when there is an actual ad click, and only by
 * a caller that saw the landing hit happen. Intake reading a pageUrl after the
 * fact leaves it off rather than passing submit time off as click time.
 */
export function readAdAttribution(search: string, clickedAt?: Date): AdAttribution | null {
  const q = new URLSearchParams(search);
  const out: AdAttribution = {};
  for (const [name, type] of CLICK_IDS) {
    const id = param(q, name);
    if (id) { out.adsClickId = id; out.adsClickIdType = type; break; }
  }
  for (const [name, field] of PARAMS) {
    const v = param(q, name);
    if (v) (out as Record<string, string | undefined>)[field] = v;
  }
  if (Object.keys(out).length === 0) return null;
  if (clickedAt && isAdClick(out)) out.adsClickAt = clickedAt.toISOString();
  return out;
}

/** The query string of a full URL, or "" for anything that isn't one. */
export function searchOf(url: string | null | undefined): string {
  if (!url) return "";
  try { return new URL(url).search; } catch { return ""; }
}

/** Just the ad fields of something that carries other things too. */
export function pickAdClick(from: AdClick): AdClick {
  const out: AdClick = {};
  for (const k of AD_CLICK_KEYS) {
    if (from[k] !== undefined) (out as Record<string, unknown>)[k] = from[k];
  }
  return out;
}

/**
 * The attribution a lead is written with: what the caller sent, or — when that
 * names no ad — what the lead's pageUrl still carries.
 *
 * The fallback covers a browser still running a bundle from before these
 * fields existed, and the .com bridge before its hook forwards them: in both
 * the landing URL, click id and all, very often *is* the pageUrl. Whatever the
 * caller did send still wins field by field, so the bridge's own utm mapping
 * is never overwritten by the URL's.
 */
export function attributionFor(sent: AdAttribution, pageUrl?: string | null): AdAttribution {
  if (isAdClick(sent)) return sent;
  const fromUrl = readAdAttribution(searchOf(pageUrl));
  if (!fromUrl) return sent;
  const merged: AdAttribution = { ...fromUrl };
  for (const [k, v] of Object.entries(sent)) {
    if (v !== undefined && v !== "") (merged as Record<string, unknown>)[k] = v;
  }
  return merged;
}

/** A client clock may run a little fast; a click further ahead than this was
 * never a click, it's a hand-made request or a broken clock. */
const FUTURE_TOLERANCE_MS = 60 * 60 * 1000;

/**
 * The package_queries columns for a lead.
 *
 * `adsPlatform` is derived here rather than accepted from the caller, so a
 * public form can't write an arbitrary platform onto a lead. A Google click id
 * only exists on a Google click; a campaign id without one still means Google
 * today, because the final URL suffix is the only thing that puts `campaignid`
 * on our URLs. Meta (Step 10) will need evidence of its own here.
 *
 * `gclid` is the older column the lead report reads as proof of Google. It is
 * filled from the click id when the caller sent no gclid of its own, so a lead
 * from the website's own forms counts as Google on that report as well.
 */
export function leadAdColumns(a: AdClick & { gclid?: string }, now: Date) {
  const clickAt = a.adsClickAt ? new Date(a.adsClickAt) : null;
  const clickAtOk = clickAt !== null && !Number.isNaN(clickAt.getTime())
    && clickAt.getTime() <= now.getTime() + FUTURE_TOLERANCE_MS;
  return {
    adsPlatform: isAdClick(a) ? "GOOGLE" : null,
    adsCampaignId: a.adsCampaignId ?? null,
    adsAdGroupId: a.adsAdGroupId ?? null,
    adsCreativeId: a.adsCreativeId ?? null,
    adsKeyword: a.adsKeyword ?? null,
    adsMatchType: a.adsMatchType ?? null,
    adsNetwork: a.adsNetwork ?? null,
    adsDevice: a.adsDevice ?? null,
    adsTargetId: a.adsTargetId ?? null,
    adsClickId: a.adsClickId ?? null,
    // A type with no id to describe is noise.
    adsClickIdType: a.adsClickId ? (a.adsClickIdType ?? null) : null,
    adsClickAt: clickAtOk ? clickAt : null,
    gclid: a.gclid || a.adsClickId || null,
  };
}
