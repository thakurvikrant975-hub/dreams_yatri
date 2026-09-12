import { NextResponse } from "next/server";
import { isAuthorizedCron } from "../auth";
import { db } from "@/app/lib/db";
import { syncGoogleAdsStructure } from "@/app/lib/ads/google/sync-structure";
import { syncGoogleAdsStats, recentStatsWindow } from "@/app/lib/ads/google/sync-stats";

/**
 * Nightly: copy Google Ads into our tables (Steps 3–4), so reports can put
 * spend next to leads and bookings. Structure first — budgets, campaigns, ad
 * groups, ads — then the stats window, which needs those rows to exist.
 *
 * Scheduled for 20:30 UTC, which is 02:00 IST: the ad account reports in
 * Asia/Calcutta, so by then its previous day is closed. Re-reading the last 30
 * days each night is the point, not waste — Google restates recent days.
 *
 * The same work runs from `npm run ads:sync-structure` / `ads:sync-stats`;
 * this route only supplies the app's database client and the schedule.
 *
 * Query parameters, for a backfill or a re-read (the cron passes none):
 *   ?from=YYYY-MM-DD&to=YYYY-MM-DD   an explicit window
 *   ?days=N                          the last N days instead of 30
 *   ?structure=0                     stats only, when the structure is current
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A 30-day run is seconds; a long backfill window is minutes.
export const maxDuration = 300;

export async function GET(req: Request) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const days = Number(params.get("days") ?? 30);
  if (!Number.isInteger(days) || days < 1 || days > 400) {
    return NextResponse.json({ ok: false, error: "days must be 1-400" }, { status: 400 });
  }

  const started = Date.now();
  try {
    const structure = params.get("structure") === "0" ? null : await syncGoogleAdsStructure(db);

    const recent = await recentStatsWindow(db, days);
    const from = params.get("from") ?? recent.from;
    const to = params.get("to") ?? recent.to;
    const stats = await syncGoogleAdsStats(db, { from, to });

    return NextResponse.json({ ok: true, seconds: Math.round((Date.now() - started) / 100) / 10, structure, stats });
  } catch (e) {
    // The run is already recorded as FAILED with its reason in ads_sync_runs
    // (sync-run.ts); this is for whoever is watching the logs or the response.
    const error = e instanceof Error ? e.message : String(e);
    console.error("[cron/sync-google-ads] failed:", error);
    return NextResponse.json({ ok: false, error, seconds: Math.round((Date.now() - started) / 100) / 10 }, { status: 500 });
  }
}
