import "server-only";
import { Prisma } from "@/app/generated/prisma/client";
import { gaql } from "./client";
import { bulkUpsert, retryingOnConnectionLoss, type RawExecutor, type RawQuerier } from "../bulk-upsert";
import { startSyncRun, finishSyncRun, failSyncRun, type SyncRunDb } from "../sync-run";
import { assertDate, addDays, todayIn, windows } from "../dates";

/**
 * Step 4 — daily cost, clicks, impressions and Google's conversions for every
 * campaign, ad group and ad, plus hourly per campaign, over a date window.
 *
 * Google's answer for the window replaces ours. Recent days are never final —
 * late conversions land, invalid clicks are credited back — so the scheduled
 * run re-reads the last 30 days every time. A row Google no longer returns for
 * a day in the window (a day whose only click was refunded, say) is removed
 * rather than left standing at its old value. That removal runs only after
 * every write in the run has succeeded, so a failure part-way can lose nothing.
 *
 * Metrics for an entity the structure sync hasn't written yet — created in the
 * minutes since it ran — are set aside rather than allowed to fail the insert on
 * its foreign key. They're counted in the run log, and the next run, after the
 * next structure sync, picks them up: the window is re-read anyway.
 *
 * Windows longer than a month are fetched a month at a time, to keep each
 * response to Google's streaming endpoint a sensible size.
 */

export type StatsDb = RawExecutor & RawQuerier & SyncRunDb;

export type StatsSyncResult = {
  runId: string;
  from: string;
  to: string;
  campaignDays: number;
  adGroupDays: number;
  adDays: number;
  campaignHours: number;
  /** Rows for entities not yet in our structure tables — see above. */
  skippedUnknown: number;
  /** Rows in the window Google no longer reports. */
  removedStale: number;
};

/** The window the scheduled run re-reads: the last `days` days, today included, on the account's clock. */
export async function recentStatsWindow(db: RawQuerier, days = 30): Promise<{ from: string; to: string }> {
  const [account] = await db.$queryRaw<{ timeZone: string }[]>(Prisma.sql`
    SELECT "timeZone" FROM google_ads_accounts WHERE "isManager" = false AND status = 'ENABLED' LIMIT 1`);
  if (!account) throw new Error("no ad account in google_ads_accounts — run the structure sync first");
  const to = todayIn(account.timeZone);
  return { from: addDays(to, -(days - 1)), to };
}

/** The earliest date any campaign ran — where a full backfill starts. */
export async function accountStartDate(db: RawQuerier): Promise<string | null> {
  const [row] = await db.$queryRaw<{ d: string | null }[]>(Prisma.sql`SELECT MIN("startDate")::text AS d FROM google_ads_campaigns`);
  return row?.d ?? null;
}

type Metrics = {
  costMicros?: string; impressions?: string; clicks?: string; conversions?: number; conversionsValue?: number;
  searchImpressionShare?: number; searchBudgetLostImpressionShare?: number; searchRankLostImpressionShare?: number;
};
type CampaignDayRow = { campaign: { id: string }; segments: { date: string }; metrics: Metrics };
type AdGroupDayRow = { adGroup: { id: string }; segments: { date: string }; metrics: Metrics };
type AdDayRow = { adGroup: { id: string }; adGroupAd: { ad: { id: string } }; segments: { date: string }; metrics: Metrics };
type CampaignHourRow = { campaign: { id: string }; segments: { date: string; hour: number }; metrics: Metrics };

// int64s arrive as strings, doubles as numbers; an absent metric is zero —
// except the impression-share ratios, where absent means "not applicable".
const base = (m: Metrics) => ({
  costMicros: BigInt(m.costMicros ?? "0"),
  impressions: Number(m.impressions ?? 0),
  clicks: Number(m.clicks ?? 0),
  conversions: m.conversions ?? 0,
});

export async function syncGoogleAdsStats(
  db: StatsDb,
  opts: { from: string; to: string; onProgress?: (line: string) => void },
): Promise<StatsSyncResult> {
  const from = assertDate(opts.from, "from");
  const to = assertDate(opts.to, "to");
  const parts = windows(from, to, 31);

  const runId = await startSyncRun(db, { platform: "GOOGLE", kind: "STATS", windowFrom: from, windowTo: to });
  // Every row this run writes carries this syncedAt; a row in the window left
  // older than it is one Google no longer reports.
  const syncedAt = new Date();
  const r: StatsSyncResult = {
    runId, from, to, campaignDays: 0, adGroupDays: 0, adDays: 0, campaignHours: 0, skippedUnknown: 0, removedStale: 0,
  };

  try {
    const accounts = await retryingOnConnectionLoss(() => db.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id FROM google_ads_accounts WHERE "isManager" = false AND status = 'ENABLED'`));
    if (accounts.length === 0) throw new Error("no ad account in google_ads_accounts — run the structure sync first");

    const campaigns = new Set((await db.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM google_ads_campaigns`)).map((x) => x.id));
    const adGroups = new Set((await db.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT id FROM google_ads_ad_groups`)).map((x) => x.id));
    const ads = new Set((await db.$queryRaw<{ k: string }[]>(Prisma.sql`SELECT "adGroupId" || '~' || id AS k FROM google_ads_ads`)).map((x) => x.k));
    const known = <T>(rows: T[], has: (row: T) => boolean) => {
      const kept = rows.filter(has);
      r.skippedUnknown += rows.length - kept.length;
      return kept;
    };

    for (const [f, t] of parts) {
      const during = `segments.date BETWEEN '${f}' AND '${t}'`;
      for (const { id: account } of accounts) {
        const cDays = await gaql<CampaignDayRow>(account, `
          SELECT campaign.id, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks,
                 metrics.conversions, metrics.conversions_value, metrics.search_impression_share,
                 metrics.search_budget_lost_impression_share, metrics.search_rank_lost_impression_share
          FROM campaign WHERE ${during}`);
        r.campaignDays += await bulkUpsert(db, "google_ads_campaign_daily", {
          key: ["campaignId", "date"],
          rows: known(cDays, (x) => campaigns.has(x.campaign.id)).map(({ campaign, segments, metrics: m }) => ({
            campaignId: campaign.id,
            date: segments.date,
            ...base(m),
            conversionsValue: m.conversionsValue ?? 0,
            searchImpressionShare: m.searchImpressionShare ?? null,
            searchBudgetLostImpressionShare: m.searchBudgetLostImpressionShare ?? null,
            searchRankLostImpressionShare: m.searchRankLostImpressionShare ?? null,
            syncedAt,
          })),
        });

        const gDays = await gaql<AdGroupDayRow>(account, `
          SELECT ad_group.id, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks,
                 metrics.conversions, metrics.conversions_value
          FROM ad_group WHERE ${during}`);
        r.adGroupDays += await bulkUpsert(db, "google_ads_ad_group_daily", {
          key: ["adGroupId", "date"],
          rows: known(gDays, (x) => adGroups.has(x.adGroup.id)).map(({ adGroup, segments, metrics: m }) => ({
            adGroupId: adGroup.id, date: segments.date, ...base(m), conversionsValue: m.conversionsValue ?? 0, syncedAt,
          })),
        });

        const aDays = await gaql<AdDayRow>(account, `
          SELECT ad_group.id, ad_group_ad.ad.id, segments.date, metrics.cost_micros, metrics.impressions,
                 metrics.clicks, metrics.conversions, metrics.conversions_value
          FROM ad_group_ad WHERE ${during}`);
        r.adDays += await bulkUpsert(db, "google_ads_ad_daily", {
          key: ["adGroupId", "adId", "date"],
          rows: known(aDays, (x) => ads.has(`${x.adGroup.id}~${x.adGroupAd.ad.id}`)).map(({ adGroup, adGroupAd, segments, metrics: m }) => ({
            adGroupId: adGroup.id, adId: adGroupAd.ad.id, date: segments.date, ...base(m), conversionsValue: m.conversionsValue ?? 0, syncedAt,
          })),
        });

        const cHours = await gaql<CampaignHourRow>(account, `
          SELECT campaign.id, segments.date, segments.hour, metrics.cost_micros, metrics.impressions,
                 metrics.clicks, metrics.conversions
          FROM campaign WHERE ${during}`);
        r.campaignHours += await bulkUpsert(db, "google_ads_campaign_hourly", {
          key: ["campaignId", "date", "hour"],
          rows: known(cHours, (x) => campaigns.has(x.campaign.id)).map(({ campaign, segments, metrics: m }) => ({
            campaignId: campaign.id, date: segments.date, hour: segments.hour, ...base(m), syncedAt,
          })),
        });
      }
      opts.onProgress?.(`${f} → ${t}: ${r.campaignDays} campaign-days, ${r.adGroupDays} ad-group-days, ${r.adDays} ad-days, ${r.campaignHours} campaign-hours so far`);
    }

    // Only now that every write has landed: what's in the window and wasn't
    // just written is what Google no longer reports.
    for (const table of ["google_ads_campaign_daily", "google_ads_ad_group_daily", "google_ads_ad_daily", "google_ads_campaign_hourly"]) {
      r.removedStale += await retryingOnConnectionLoss(() => db.$executeRaw(Prisma.sql`
        DELETE FROM ${Prisma.raw(`"${table}"`)}
        WHERE "date" BETWEEN ${from}::date AND ${to}::date AND "syncedAt" < ${syncedAt}`));
    }

    await finishSyncRun(db, runId, r.campaignDays + r.adGroupDays + r.adDays + r.campaignHours, {
      campaignDays: r.campaignDays, adGroupDays: r.adGroupDays, adDays: r.adDays, campaignHours: r.campaignHours,
      skippedUnknown: r.skippedUnknown, removedStale: r.removedStale, windows: parts.length,
    });
    return r;
  } catch (e) {
    await failSyncRun(db, runId, e);
    throw e;
  }
}
