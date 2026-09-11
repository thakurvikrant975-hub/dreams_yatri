/**
 * Runs the Google Ads stats sync (Step 4) once, against whatever database
 * DATABASE_URL names — printed first. Read-only towards Google; re-running a
 * window rewrites it with Google's current numbers.
 *
 *   npm run ads:sync-stats                          last 30 days — what the scheduled run does
 *   npm run ads:sync-stats -- --days 90
 *   npm run ads:sync-stats -- --from 2026-01-01 [--to 2026-03-31]
 *   npm run ads:sync-stats -- --since-start         back to the first campaign's start (full backfill)
 */
import { db, dbTarget } from "./_db";
import { syncGoogleAdsStats, recentStatsWindow, accountStartDate } from "../app/lib/ads/google/sync-stats";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};

(async () => {
  const recent = await recentStatsWindow(db, Number(arg("days") ?? 30));
  let from = arg("from") ?? recent.from;
  const to = arg("to") ?? recent.to;
  if (process.argv.includes("--since-start")) {
    const start = await accountStartDate(db);
    if (!start) throw new Error("no campaign start dates — run the structure sync first");
    from = start;
  }

  console.log(`stats sync ${from} → ${to} → ${dbTarget}`);
  const started = Date.now();
  const r = await syncGoogleAdsStats(db, { from, to, onProgress: (l) => console.log(`  ${l}`) });
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s (run ${r.runId})`);
  console.table({
    "campaign-days": r.campaignDays, "ad-group-days": r.adGroupDays, "ad-days": r.adDays,
    "campaign-hours": r.campaignHours, "skipped (entity not synced yet)": r.skippedUnknown,
    "removed (Google no longer reports)": r.removedStale,
  });
  await db.$disconnect();
})().catch(async (e) => {
  console.error("✗ stats sync failed:", e instanceof Error ? e.message : e);
  await db.$disconnect();
  process.exit(1);
});
