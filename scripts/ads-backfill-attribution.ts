/**
 * Fills the ads* columns on leads that arrived before the capture could read
 * them — from the landing URL each lead already stores in `pageUrl`.
 *
 * Google's auto-tagging has always put the click id, and lately
 * gad_campaignid, on the URL a visitor lands on, and the .com bridge has been
 * storing that URL since it went live. So the campaign behind a past lead is
 * already in our database; it was simply never parsed. No Google API, no
 * 90-day click_view limit.
 *
 * Uses readAdAttribution — the same parser live intake uses — so a backfilled
 * lead is tagged exactly as a new one would be. It never overwrites a value
 * that is already there (COALESCE), and never invents a click time: the
 * landing hit wasn't witnessed, and submit time is not click time.
 *
 *   npm run ads:backfill-leads            dry run — counts and samples, writes nothing
 *   npm run ads:backfill-leads -- --apply writes
 */
import { Prisma } from "../app/generated/prisma/client";
import { db, dbTarget } from "./_db";
import { readAdAttribution, searchOf, leadAdColumns } from "../app/lib/ads/attribution";
import { retryingOnConnectionLoss } from "../app/lib/ads/bulk-upsert";

const FILLABLE = [
  "adsPlatform", "adsCampaignId", "adsAdGroupId", "adsCreativeId", "adsKeyword",
  "adsMatchType", "adsNetwork", "adsDevice", "adsTargetId", "adsClickId", "adsClickIdType", "gclid",
] as const;
type Fillable = (typeof FILLABLE)[number];
type Lead = { id: string; pageUrl: string | null; createdAt: Date } & Record<Fillable, string | null>;

(async () => {
  const apply = process.argv.includes("--apply");
  console.log(`lead attribution backfill — ${apply ? "APPLYING" : "dry run"} → ${dbTarget}\n`);

  const leads = await retryingOnConnectionLoss(() => db.$queryRaw<Lead[]>(Prisma.sql`
    SELECT id, "pageUrl", "createdAt", ${Prisma.raw(FILLABLE.map((c) => `"${c}"`).join(", "))}
    FROM package_queries
    WHERE "pageUrl" ~ '[?&](gclid|gbraid|wbraid|gad_campaignid|campaignid)='
      AND ("adsCampaignId" IS NULL OR "adsClickId" IS NULL)
    ORDER BY "createdAt"`));

  const updates: { id: string; values: Partial<Record<Fillable, string | null>> }[] = [];
  const filled: Record<string, number> = {};
  let unparseable = 0;

  for (const lead of leads) {
    const attribution = readAdAttribution(searchOf(lead.pageUrl));
    if (!attribution) { unparseable++; continue; }
    const columns = leadAdColumns({ ...attribution, gclid: lead.gclid ?? undefined }, new Date());
    const values: Partial<Record<Fillable, string | null>> = {};
    for (const c of FILLABLE) {
      const next = columns[c as keyof typeof columns] as string | null;
      // Only ever fills a hole; an existing value always wins.
      if (lead[c] === null && next !== null) { values[c] = next; filled[c] = (filled[c] ?? 0) + 1; }
    }
    if (Object.keys(values).length) updates.push({ id: lead.id, values });
  }

  console.log(`${leads.length} lead(s) carry ad parameters in their landing URL and are missing tags`);
  console.log(`${updates.length} would be updated, ${leads.length - updates.length - unparseable} already complete, ${unparseable} unparseable\n`);
  console.log("columns that would be filled:");
  console.table(Object.fromEntries(FILLABLE.filter((c) => filled[c]).map((c) => [c, filled[c]])));

  const campaignIds = [...new Set(updates.map((u) => u.values.adsCampaignId).filter(Boolean) as string[])];
  if (campaignIds.length) {
    const named = await db.$queryRaw<{ id: string; name: string }[]>(Prisma.sql`
      SELECT id, name FROM google_ads_campaigns WHERE id IN (${Prisma.join(campaignIds)})`);
    const names = new Map(named.map((c) => [c.id, c.name]));
    const perCampaign = new Map<string, number>();
    for (const u of updates) {
      const id = u.values.adsCampaignId;
      if (!id) continue;
      const label = names.get(id) ?? `(campaign ${id} — not in our tables)`;
      perCampaign.set(label, (perCampaign.get(label) ?? 0) + 1);
    }
    console.log("leads by campaign, once filled:");
    console.table(Object.fromEntries([...perCampaign.entries()].sort((a, b) => b[1] - a[1])));
    console.log(`${campaignIds.length} distinct campaign(s), ${campaignIds.length - names.size} not found in google_ads_campaigns`);
  }

  console.log("\nsample of what would change:");
  for (const u of updates.slice(0, 3)) {
    const lead = leads.find((l) => l.id === u.id)!;
    console.log(`  ${lead.createdAt.toISOString().slice(0, 16)}  ${lead.id}`);
    console.log(`    from: ${(lead.pageUrl ?? "").slice(0, 120)}`);
    console.log(`    set:  ${JSON.stringify(u.values)}`);
  }

  if (!apply) {
    console.log("\ndry run — nothing written. Re-run with -- --apply to write.");
    await db.$disconnect();
    return;
  }

  // One statement per chunk: UPDATE … FROM (VALUES …), COALESCE so a value
  // that arrived since this script read the rows is never clobbered.
  let written = 0;
  for (let i = 0; i < updates.length; i += 200) {
    const chunk = updates.slice(i, i + 200);
    const rows = Prisma.join(chunk.map((u) =>
      Prisma.sql`(${Prisma.join([u.id, ...FILLABLE.map((c) => u.values[c] ?? null)])})`));
    written += await retryingOnConnectionLoss(() => db.$executeRaw(Prisma.sql`
      UPDATE package_queries q SET ${Prisma.raw(FILLABLE.map((c) => `"${c}" = COALESCE(q."${c}", v."${c}")`).join(", "))}
      FROM (VALUES ${rows}) AS v(id, ${Prisma.raw(FILLABLE.map((c) => `"${c}"`).join(", "))})
      WHERE q.id = v.id`));
  }
  console.log(`\n✓ ${written} lead(s) updated`);
  await db.$disconnect();
})().catch(async (e) => {
  console.error("✗ backfill failed:", e instanceof Error ? e.message : e);
  await db.$disconnect();
  process.exit(1);
});
