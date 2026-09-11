import { db } from "@/app/lib/db";

export type MissedFollowUpSummary = { missed: number };

/**
 * Sweeps PENDING follow-ups whose followUpAt has passed by more than the
 * grace period and flips them to MISSED. This is the piece that actually
 * makes exec discipline trackable — without it, a follow-up an exec never
 * touched looks identical (still PENDING) to one that just isn't due yet.
 *
 * The reminder UI (Followupreminderprovider.tsx) nags the exec every 10 min
 * once a follow-up is overdue, so the grace period here is deliberately
 * generous — long enough that "still PENDING past this point" means the
 * exec saw the reminders and didn't act, not that they were on another call.
 *
 * Called from app/api/cron/followup-discipline/route.ts.
 */
const MISS_GRACE_MS = 4 * 60 * 60 * 1000; // 4h past due

export async function markMissedFollowUps(opts?: { now?: Date }): Promise<MissedFollowUpSummary> {
    const now = opts?.now ?? new Date();
    const cutoff = new Date(now.getTime() - MISS_GRACE_MS);

    const overdue = await db.queryFollowUp.findMany({
        where: {
            status: "PENDING",
            followUpAt: { not: null, lte: cutoff },
        },
        select: { id: true, packageQueryId: true },
    });

    let missed = 0;
    for (const fu of overdue) {
        try {
            await db.$transaction([
                db.queryFollowUp.update({
                    where: { id: fu.id },
                    data:  { status: "MISSED", resolvedAt: now },
                }),
                db.queryTimeline.create({
                    data: {
                        queryId: fu.packageQueryId,
                        event:   "⏰ Follow-up missed",
                    },
                }),
            ]);
            missed++;
        } catch (e) {
            console.error("[markMissedFollowUps] failed for follow-up", fu.id, e);
        }
    }

    return { missed };
}
