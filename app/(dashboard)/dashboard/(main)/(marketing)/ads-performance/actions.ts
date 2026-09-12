import "server-only";
import { db } from "@/app/lib/db";
import { adsPerformance, adsTotals, lastAdsSync, type AdsPerformanceRow } from "@/app/lib/ads/reporting";
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
  campaigns: AdsPerformanceRow[];
  adGroups: AdsPerformanceRow[];
  totals: ReturnType<typeof adsTotals>;
  lastSync: { kind: string; status: string; finishedAt: Date | null } | null;
};

/** Last 30 days, ending today on the ad account's clock. */
export function defaultAdsRange(): { from: string; to: string } {
  const to = todayIn(ACCOUNT_TZ);
  return { from: addDays(to, -29), to };
}

export async function getAdsDashboard(from: string, to: string): Promise<AdsDashboardData> {
  const [campaigns, adGroups, lastSync] = await Promise.all([
    adsPerformance(db, { from, to, level: "campaign" }),
    adsPerformance(db, { from, to, level: "adGroup" }),
    lastAdsSync(db),
  ]);
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000) + 1;
  return { from, to, days, campaigns, adGroups, totals: adsTotals(campaigns), lastSync };
}
