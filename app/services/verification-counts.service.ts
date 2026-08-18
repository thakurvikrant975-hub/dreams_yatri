import "server-only";
import { db } from "@/app/lib/db";
import { publishVerificationCounts, type VerificationCounts } from "@/app/lib/ably";

/** Same "still needs verifying" filters as the Verify Hotels / Verify Cabs /
 * Verify Packages page queries (VerifyHotelsClient.tsx / verify-cabs/page.tsx /
 * VerifyPackagesClient.tsx) — kept in one place so the live count and each
 * page's own "Total Pending" stat can never drift apart. */
export async function computeVerificationCounts(): Promise<VerificationCounts> {
    const [hotelsPending, cabsPending, bookingsUnconfirmed, packagesPending, hotelRequestsPending] = await Promise.all([
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
        // Package Bookings sidebar badge — paid bookings still mid-pipeline
        // (before CAB_CONFIRMED, the last stage the app currently advances a
        // package booking to; OPS_REVIEW/CONFIRMED exist in the schema but
        // nothing promotes a booking to them yet).
        db.booking.count({
            where: {
                paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] },
                status: { in: ["PENDING_REVIEW", "HOTEL_VERIFICATION", "HOTEL_CONFIRMED", "CAB_VERIFICATION"] },
            },
        }),
        // Verify Packages sidebar badge — same "pending" filter as
        // VerifyPackagesClient.tsx's own query. verified: false excludes
        // packages costing has already approved but the exec hasn't sent yet
        // (status stays READY until the exec's own send step) — without it,
        // an approved package would keep inflating this "still needs costing
        // review" count.
        db.custom_packages.count({
            where: { readyAt: { not: null }, status: "READY", verified: false },
        }),
        // Hotel Requests sidebar badge — packages with at least one day the
        // sales exec flagged as needing a hotel from the team AND still
        // awaiting one. hotelPending stays true after a reject (see the
        // field's doc comment in schema.prisma — that's for the exec's own
        // queue/notifications), so it alone isn't "needs the hotel team":
        // excluding rejectedAt keeps this in sync with what HotelRequestsClient
        // actually lists — a package where every flagged day ended up either
        // filled or rejected must drop out of this count too.
        db.custom_packages.count({
            where: { itineraries: { some: { hotelPending: true, hotelRejectedAt: null } } },
        }),
    ]);
    return { hotelsPending, cabsPending, bookingsUnconfirmed, packagesPending, hotelRequestsPending };
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
