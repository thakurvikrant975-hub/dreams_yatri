import "server-only";
import { Prisma } from "@/app/generated/prisma/client";
import type { RawQuerier } from "./bulk-upsert";
import { assertDate } from "./dates";

/**
 * Step 6 — spend, leads and outcomes in one place.
 *
 * Every ads report and the dashboard read from here, so a definition lives
 * once rather than in each report's SQL. The definitions, decided against what
 * production actually records (2026-09-12):
 *
 *   lead    a package_queries row carrying this campaign / ad group, not deleted
 *   quoted  that lead has a custom package marked SENT — the team's real
 *           mid-funnel signal (896 in 90 days), unlike `verified`, which is set
 *           on 2 leads in 2,575 and means nothing
 *   won     the lead's own status is CONVERTED — what sales actually set. Not a
 *           booking row: only 9 leads became bookings in 180 days
 *   value   the quoted price of that lead's latest custom package. A price
 *           quoted and accepted, NOT cash collected — payments are unused, and
 *           bookings carry marginAmount 0, so margin ROAS is not computable and
 *           is deliberately absent rather than faked
 *   junk    closed as UNRESPONSIVE — the lead that never answered
 *
 * Two rules the numbers depend on:
 *
 * • **Google owns cost, we own outcomes.** Spend, clicks and impressions come
 *   from the synced Google tables; leads, wins and value from ours. Google's own
 *   conversion count is never mixed in — different attribution, modelled
 *   conversions, click-date reporting.
 * • **Aggregate each side before joining.** Spend per campaign and leads per
 *   campaign are separate aggregations joined one-to-one. Joining per-day spend
 *   rows to lead rows counts a campaign's spend once per lead — which read Goa
 *   at ₹30,60,413 instead of ₹23,724 the first time it was written by hand.
 *
 * Dates are calendar days in the ad account's timezone (Asia/Calcutta). Lead
 * timestamps are UTC, so they are converted before being matched to a spend
 * date — otherwise every lead after 18:30 UTC lands on the wrong day.
 */

const ACCOUNT_TZ = "Asia/Calcutta";

export type AdsPerformanceRow = {
  id: string;
  name: string;
  /** For ad groups: the campaign they belong to. */
  parentName: string | null;
  status: string;
  spend: number;
  clicks: number;
  impressions: number;
  leads: number;
  quoted: number;
  won: number;
  junk: number;
  dealValue: number;
  costPerLead: number | null;
  costPerQuoted: number | null;
  costPerWin: number | null;
  /** Won ÷ leads. */
  winRate: number | null;
  /** Closed-unresponsive ÷ leads. */
  junkRate: number | null;
  /** Leads ÷ clicks — how well the landing page turns a visit into an enquiry. */
  clickToLead: number | null;
  /** Deal value per rupee spent. Quoted value, so it is not profit. */
  valuePerRupee: number | null;
};

type Raw = Record<keyof AdsPerformanceRow, string | number | null>;

const num = (v: string | number | null) => (v === null ? 0 : Number(v));
const ratio = (top: number, bottom: number) => (bottom > 0 ? top / bottom : null);
const per = (spend: number, n: number) => (n > 0 ? Math.round(spend / n) : null);

/**
 * One row per campaign (or ad group) that had spend or leads in the window.
 * A campaign with spend and no leads matters as much as the reverse, so the
 * two sides are joined with FULL OUTER JOIN.
 */
export async function adsPerformance(
  db: RawQuerier,
  opts: { from: string; to: string; level?: "campaign" | "adGroup" },
): Promise<AdsPerformanceRow[]> {
  const from = assertDate(opts.from, "from");
  const to = assertDate(opts.to, "to");
  const byAdGroup = opts.level === "adGroup";

  // The lead-side aggregation is identical at both levels apart from which
  // column identifies the entity.
  const leadColumn = Prisma.raw(byAdGroup ? `q."adsAdGroupId"` : `q."adsCampaignId"`);
  const spendTable = Prisma.raw(byAdGroup ? "google_ads_ad_group_daily" : "google_ads_campaign_daily");
  const spendColumn = Prisma.raw(byAdGroup ? `"adGroupId"` : `"campaignId"`);
  const entity = byAdGroup
    ? Prisma.sql`google_ads_ad_groups e LEFT JOIN google_ads_campaigns parent ON parent.id = e."campaignId"`
    : Prisma.sql`google_ads_campaigns e LEFT JOIN google_ads_campaigns parent ON false`;

  const rows = await db.$queryRaw<Raw[]>(Prisma.sql`
    WITH spend AS (
      SELECT ${spendColumn} AS id, SUM("costMicros")::numeric / 1e6 AS spend,
             SUM(clicks)::int AS clicks, SUM(impressions)::int AS impressions
      FROM ${spendTable}
      WHERE "date" BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1
    ),
    leads AS (
      SELECT ${leadColumn} AS id,
             COUNT(*)::int AS leads,
             COUNT(*) FILTER (WHERE EXISTS (
               SELECT 1 FROM custom_packages p WHERE p."queryId" = q.id AND p.status = 'SENT'))::int AS quoted,
             COUNT(*) FILTER (WHERE q.status = 'CONVERTED')::int AS won,
             COUNT(*) FILTER (WHERE q."closeReasonId" = 'UNRESPONSIVE')::int AS junk,
             COALESCE(SUM(v.value) FILTER (WHERE q.status = 'CONVERTED'), 0)::numeric AS "dealValue"
      FROM package_queries q
      LEFT JOIN LATERAL (
        SELECT p."totalPrice" AS value FROM custom_packages p
        WHERE p."queryId" = q.id ORDER BY p."createdAt" DESC LIMIT 1
      ) v ON true
      WHERE q."deletedAt" IS NULL AND ${leadColumn} IS NOT NULL
        AND ((q."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${ACCOUNT_TZ})::date BETWEEN ${from}::date AND ${to}::date
      GROUP BY 1
    )
    SELECT COALESCE(s.id, l.id) AS id,
           COALESCE(e.name, '(not synced yet)') AS name,
           parent.name AS "parentName",
           COALESCE(e.status, 'UNKNOWN') AS status,
           COALESCE(s.spend, 0) AS spend, COALESCE(s.clicks, 0) AS clicks, COALESCE(s.impressions, 0) AS impressions,
           COALESCE(l.leads, 0) AS leads, COALESCE(l.quoted, 0) AS quoted, COALESCE(l.won, 0) AS won,
           COALESCE(l.junk, 0) AS junk, COALESCE(l."dealValue", 0) AS "dealValue"
    FROM spend s
    FULL OUTER JOIN leads l ON l.id = s.id
    LEFT JOIN ${entity} ON e.id = COALESCE(s.id, l.id)
    ORDER BY COALESCE(s.spend, 0) DESC, COALESCE(l.leads, 0) DESC`);

  return rows.map((r) => {
    const spend = num(r.spend), leads = num(r.leads), quoted = num(r.quoted), won = num(r.won);
    const junk = num(r.junk), clicks = num(r.clicks), dealValue = num(r.dealValue);
    return {
      id: String(r.id), name: String(r.name), parentName: r.parentName === null ? null : String(r.parentName),
      status: String(r.status), spend, clicks, impressions: num(r.impressions),
      leads, quoted, won, junk, dealValue,
      costPerLead: per(spend, leads), costPerQuoted: per(spend, quoted), costPerWin: per(spend, won),
      winRate: ratio(won, leads), junkRate: ratio(junk, leads), clickToLead: ratio(leads, clicks),
      valuePerRupee: spend > 0 ? dealValue / spend : null,
    };
  });
}

/** The same numbers summed — totals are recomputed from the parts, never averaged. */
export function adsTotals(rows: AdsPerformanceRow[]) {
  const sum = (f: (r: AdsPerformanceRow) => number) => rows.reduce((n, r) => n + f(r), 0);
  const spend = sum((r) => r.spend), leads = sum((r) => r.leads), quoted = sum((r) => r.quoted);
  const won = sum((r) => r.won), junk = sum((r) => r.junk), clicks = sum((r) => r.clicks);
  const dealValue = sum((r) => r.dealValue);
  return {
    spend, clicks, impressions: sum((r) => r.impressions), leads, quoted, won, junk, dealValue,
    costPerLead: per(spend, leads), costPerQuoted: per(spend, quoted), costPerWin: per(spend, won),
    winRate: ratio(won, leads), junkRate: ratio(junk, leads), clickToLead: ratio(leads, clicks),
    valuePerRupee: spend > 0 ? dealValue / spend : null,
  };
}
