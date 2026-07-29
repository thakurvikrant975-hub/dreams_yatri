import "server-only";
import { db } from "@/app/lib/db";
import { publishVerificationCounts, type VerificationCounts } from "@/app/lib/ably";

/** Same "still needs verifying" filters as the Verify Hotels / Verify Cabs
 * page queries (VerifyHotelsClient.tsx / verify-cabs/page.tsx) — kept in one
 * place so the live count and the page's own "Total Pending" stat can never
 * drift apart. */
export async function computeVerificationCounts(): Promise<VerificationCounts> {
    const [hotelsPending, cabsPending] = await Promise.all([
        db.booking.count({
            where: {
                paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
                status: { notIn: ["CANCELLED", "COMPLETED", "REJECTED"] },
                hotelConfirmedAt: null,
            },
        }),
        db.booking.count({
            where: {
                paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
                status: { notIn: ["CANCELLED", "COMPLETED", "REJECTED", "PENDING_REVIEW", "HOTEL_VERIFICATION"] },
                cabConfirmedAt: null,
            },
        }),
    ]);
    return { hotelsPending, cabsPending };
}

/**
 * Recompute both pending-verification counts and push them over Ably so every
 * dashboard tab open on Verify Hotels / Verify Cabs updates live — no client
 * polling, no extra request per viewer. Call this after any write that can
 * change either count: a booking's payment finalizing (enters the queues), a
 * hotel/cab getting fully confirmed (leaves a queue), or a booking being
 * cancelled (leaves both). Best-effort: swallows its own errors so a realtime
 * hiccup never fails the mutation that triggered it.
 */
export async function broadcastVerificationCounts(): Promise<void> {
    try {
        const counts = await computeVerificationCounts();
        await publishVerificationCounts(counts);
    } catch (e) {
        console.error("[verification-counts] broadcast failed", e);
    }
}
