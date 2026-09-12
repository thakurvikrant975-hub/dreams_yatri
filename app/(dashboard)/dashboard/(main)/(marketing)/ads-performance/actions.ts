import "server-only";
import { db } from "@/app/lib/db";
import { adsPerformance, adsTotals, lastAdsSync, offAdsLeads, adsDataStart, type AdsPerformanceRow } from "@/app/lib/ads/reporting";
import { addDays, todayIn } from "@/app/lib/ads/dates";

/**
 * Everything the ads page shows, from the shared definitions in
 * app/lib/ads/reporting.ts — so this page and `npm run ads:report` can never
 * disagree about what a lead, a quote or a win is.
 */

/** The ad account reports its days in this zone; so does this page. */
export const ACCOUNT_TZ = "Asia/Calcutta";

export type AdsDashboardData = {
  from: string;
  to: string;
  days: number;
  /** Today on the ad account's clock — what the range presets mean by "today". */
  today: string;
  /** First day we hold spend for, so "All time" knows where to start. */
  earliest: string | null;
  campaigns: AdsPerformanceRow[];
  adGroups: AdsPerformanceRow[];
  totals: ReturnType<typeof adsTotals>;
  /** Leads the ads produced that no click id can prove — phone and WhatsApp. */
  offAds: { phone: number; phoneNamingAdvertisedDestination: number; whatsappFromGoogle: number };
  /** Spend ÷ (website leads + phone leads). Calls come off the number on the
   * landing pages the same ads pay for, so leaving them out overstates the cost
   * of a lead; they stay out of the per-campaign table, which needs a campaign. */
  costPerLeadWithCalls: number | null;
  lastSync: { kind: string; status: string; finishedAt: Date | null } | null;
};

/**
 * Last 30 days ending **yesterday**, on the ad account's clock — the same
 * window Google Ads means by "Last 30 days". Today is deliberately excluded:
 * it is still accumulating, and a partial day drags every average down. The
 * range picker has Today and "N days up to today" for the live view.
 */
export function defaultAdsRange(): { from: string; to: string } {
  const today = todayIn(ACCOUNT_TZ);
  return { from: addDays(today, -30), to: addDays(today, -1) };
}

export async function getAdsDashboard(from: string, to: string): Promise<AdsDashboardData> {
  const [campaigns, adGroups, lastSync, offAds, earliest] = await Promise.all([
    adsPerformance(db, { from, to, level: "campaign" }),
    adsPerformance(db, { from, to, level: "adGroup" }),
    lastAdsSync(db),
    offAdsLeads(db, { from, to }),
    adsDataStart(db),
  ]);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  const totals = adsTotals(campaigns);
  const withCalls = totals.leads + offAds.phone;
  return {
    from, to, days, today: todayIn(ACCOUNT_TZ), earliest, campaigns, adGroups, totals, offAds, lastSync,
    costPerLeadWithCalls: withCalls > 0 ? Math.round(totals.spend / withCalls) : null,
  };
}
