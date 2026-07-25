import { db } from "@/app/lib/db";

export type PackageFollowUpSummary = { created: number; skipped: number };

/**
 * Auto-nudges the sales exec to check in with the client ~1h after a package
 * they built was verified & sent — most execs move on to the next lead the
 * moment they hand a package to costing, so this catches the "did they even
 * open it?" follow-up that'd otherwise only happen if they remembered.
 *
 * QueryFollowUp is upserted one-per-(query, exec) elsewhere in the app (see
 * addFollowUp in sales-query/actions.ts) — if the exec already has their own
 * follow-up on this query, this deliberately does NOT touch it (an auto nudge
 * overwriting a manually-set reminder would be worse than not sending one).
 * followUpAutoCreated on the package guards against ever re-checking it once
 * handled either way.
 *
 * Called from app/api/cron/package-followups/route.ts — needs to run at
 * least every ~15–30 min (via the hosting platform's cron schedule, not
 * configured in this repo) to catch packages within a reasonable window of
 * crossing the 1h mark.
 */
export async function runPackageFollowUps(opts?: { now?: Date }): Promise<PackageFollowUpSummary> {
    const now = opts?.now ?? new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const packages = await db.custom_packages.findMany({
        where: {
            sentAt: { not: null, lte: oneHourAgo },
            followUpAutoCreated: false,
            queryId: { not: null },
        },
        select: { id: true, title: true, queryId: true, builtBy: true, builtByName: true },
    });

    let created = 0;
    let skipped = 0;

    for (const pkg of packages) {
        if (!pkg.queryId) continue;
        try {
            const existing = await db.queryFollowUp.findFirst({
                where: { packageQueryId: pkg.queryId, createdById: pkg.builtBy },
                select: { id: true },
            });

            if (existing) {
                await db.custom_packages.update({ where: { id: pkg.id }, data: { followUpAutoCreated: true } });
                skipped++;
                continue;
            }

            await db.$transaction([
                db.queryFollowUp.create({
                    data: {
                        packageQueryId: pkg.queryId,
                        note: `Auto follow-up: check in with the client about "${pkg.title}" — sent 1 hour ago.`,
                        followUpAt: now,
                        createdById: pkg.builtBy,
                        createdByName: pkg.builtByName,
                    },
                }),
                db.custom_packages.update({ where: { id: pkg.id }, data: { followUpAutoCreated: true } }),
            ]);
            created++;
        } catch (e) {
            console.error("[runPackageFollowUps] failed for package", pkg.id, e);
        }
    }

    return { created, skipped };
}
