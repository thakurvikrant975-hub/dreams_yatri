/**
 * Runs the Google Ads structure sync (Step 3) once, against whatever database
 * DATABASE_URL names — printed first, so a production run is never a surprise.
 * Read-only towards Google. Safe to re-run: the second pass only refreshes
 * lastSeenAt. The scheduled route (Step 5) calls the same function.
 */
import { db, dbTarget } from "./_db";
import { syncGoogleAdsStructure } from "../app/lib/ads/google/sync-structure";

(async () => {
  console.log(`structure sync → ${dbTarget}`);
  const started = Date.now();
  const r = await syncGoogleAdsStructure(db);
  console.log(`done in ${((Date.now() - started) / 1000).toFixed(1)}s (run ${r.runId})`);
  console.table({
    accounts: r.accounts, budgets: r.budgets, "budget amount changes": r.budgetChanges,
    campaigns: r.campaigns, "ad groups": r.adGroups, ads: r.ads,
  });
  await db.$disconnect();
})().catch(async (e) => {
  console.error("✗ structure sync failed:", e instanceof Error ? e.message : e);
  await db.$disconnect();
  process.exit(1);
});
