import "server-only";
import { db } from "@/app/lib/db";

/**
 * Resolve (and lazily seed) a "System" TeamMember used as the actor for
 * automated BookingTimeline entries (payment received, etc.). Idempotent by email.
 */
const SYSTEM_EMAIL = "system@dreamsyatri.internal";

export async function getSystemActorId(): Promise<string> {
    const existing = await db.teamMember.findUnique({ where: { email: SYSTEM_EMAIL }, select: { id: true } });
    if (existing) return existing.id;
    try {
        const created = await db.teamMember.create({
            data: { name: "System", email: SYSTEM_EMAIL, employeeId: "SYSTEM", isActive: true },
            select: { id: true },
        });
        return created.id;
    } catch {
        // raced — re-read.
        const row = await db.teamMember.findUnique({ where: { email: SYSTEM_EMAIL }, select: { id: true } });
        if (!row) throw new Error("could not resolve system actor");
        return row.id;
    }
}
