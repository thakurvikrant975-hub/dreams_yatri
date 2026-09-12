/**
 * Prints the ads performance report from the shared definitions in
 * app/lib/ads/reporting.ts — the same numbers the dashboard will show.
 *
 *   npm run ads:report                          last 30 days, by campaign
 *   npm run ads:report -- --days 7
 *   npm run ads:report -- --from 2026-09-01 --to 2026-09-12
 *   npm run ads:report -- --level adgroup
 */
import { db, dbTarget } from "./_db";
import { adsPerformance, adsTotals, offAdsLeads } from "../app/lib/ads/reporting";
import { recentStatsWindow } from "../app/lib/ads/google/sync-stats";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
};
const inr = (n: number | null) => (n === null ? "—" : "₹" + Math.round(n).toLocaleString("en-IN"));
const pct = (n: number | null) => (n === null ? "—" : (n * 100).toFixed(1) + "%");

(async () => {
  const recent = await recentStatsWindow(db, Number(arg("days") ?? 30));
  const from = arg("from") ?? recent.from;
  const to = arg("to") ?? recent.to;
  const level = arg("level") === "adgroup" ? "adGroup" : "campaign";

  const [rows, offAds] = await Promise.all([adsPerformance(db, { from, to, level }), offAdsLeads(db, { from, to })]);
  console.log(`\nads performance by ${level === "adGroup" ? "ad group" : "campaign"} — ${from} → ${to}  (${dbTarget})\n`);
  console.table(rows.map((r) => ({
    [level === "adGroup" ? "ad group" : "campaign"]: (level === "adGroup" && r.parentName ? `${r.parentName} · ` : "") + r.name,
    status: r.status, spend: inr(r.spend), clicks: r.clicks, leads: r.leads,
    "click→lead": pct(r.clickToLead), "cost/lead": inr(r.costPerLead),
    quoted: r.quoted, "cost/quote": inr(r.costPerQuoted),
    won: r.won, "cost/win": inr(r.costPerWin), "win rate": pct(r.winRate),
    "no answer": pct(r.junkRate), "deal value": inr(r.dealValue), "value/₹": r.valuePerRupee?.toFixed(1) ?? "—",
  })));

  const t = adsTotals(rows);
  console.log(`total  ${inr(t.spend)} spend · ${t.clicks} clicks · ${t.leads} leads (${inr(t.costPerLead)} each, ${pct(t.clickToLead)} of clicks)`);
  console.log(`       ${t.quoted} quoted (${inr(t.costPerQuoted)} each) · ${t.won} won (${inr(t.costPerWin)} each, ${pct(t.winRate)}) · ${pct(t.junkRate)} never answered`);
  console.log(`       ${inr(t.dealValue)} of quoted deal value — value quoted and accepted, not cash collected`);
  const withCalls = t.leads + offAds.phone;
  console.log(`       + ${offAds.phone} phone leads (${offAds.phoneNamingAdvertisedDestination} about an advertised destination) → ${inr(withCalls > 0 ? t.spend / withCalls : null)} per lead counting calls` +
    (offAds.whatsappFromGoogle ? `; ${offAds.whatsappFromGoogle} WhatsApp-from-Google leads carry no click id and are counted nowhere` : "") + "\n");
  await db.$disconnect();
})().catch(async (e) => {
  console.error("✗ report failed:", e instanceof Error ? e.message : e);
  await db.$disconnect();
  process.exit(1);
});
