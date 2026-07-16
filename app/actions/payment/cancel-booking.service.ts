import "server-only";
import { db } from "@/app/lib/db";
import { getProvider } from "@/app/lib/payments/registry";
import type { GatewayId } from "@/app/lib/payments/types";
import { computeCancellationRefund } from "@/app/services/cancellation-policy/engine";
import { notifyCancellation } from "@/app/services/notifications/booking-notify";
import { notifyOwnerBookingCancelled } from "@/app/services/notifications/owner-notify";
import type { CancelBookingResult, CancelRefundLine, CancellationPreview } from "./types";

/**
 * Cancel a booking and initiate a policy-driven refund.
 *
 * Order matters: compute policy → initiate gateway refund(s) on captured
 * payments (per-payment idempotent via `refundId`) → THEN mark the booking
 * CANCELLED + cancel the unpaid installments. Money is only *initiated* here; the
 * refund webhook (Phase 5) — backed by reconciliation (7.6) — flips Payment/Booking
 * to REFUNDED/PARTIALLY_REFUNDED. Re-cancelling is a no-op.
 */

const CANCELLABLE_EXCLUDED = new Set(["CANCELLED", "COMPLETED"]);

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export async function cancelBooking(params: {
    bookingId: string;
    reason?: string;
    /** When set, the booking must belong to this user (self-service). Omit for admin. */
    byUserId?: string;
}): Promise<CancelBookingResult> {
    const booking = await db.booking.findUnique({
        where: { id: params.bookingId },
        select: {
            id: true, userId: true, status: true, startDate: true, bookingNumber: true,
            payments: { select: { id: true, gateway: true, status: true, amount_paise: true, gatewayPaymentId: true, refundId: true } },
            hotelBookings: { select: { hotelId: true, checkInDate: true, checkOutDate: true } },
        },
    });
    if (!booking) return { success: false, reason: "not_found" };
    if (params.byUserId && booking.userId !== params.byUserId) return { success: false, reason: "forbidden" };

    const captured = booking.payments.filter((p) => p.status === "FULLY_PAID" && p.gatewayPaymentId);
    const paidPaise = captured.reduce((sum, p) => sum + p.amount_paise, 0);

    // Idempotent: already cancelled → report current refund lines, don't re-refund.
    if (booking.status === "CANCELLED") {
        const refunds: CancelRefundLine[] = captured
            .filter((p) => p.refundId)
            .map((p) => ({ paymentId: p.id, refundId: p.refundId!, state: "pending", amountPaise: 0 }));
        const r = computeCancellationRefund({ paidPaise, travelDate: isoDate(booking.startDate) });
        return { success: true, alreadyCancelled: true, paidPaise, refundablePaise: r.refundablePaise, feePaise: r.feePaise, refundPct: r.refundPct, refunds };
    }
    if (CANCELLABLE_EXCLUDED.has(booking.status)) {
        return { success: false, reason: "not_cancellable", message: `Booking is ${booking.status}.` };
    }

    const policy = computeCancellationRefund({ paidPaise, travelDate: isoDate(booking.startDate) });

    // Initiate refunds (external) — allocate refundable across captured payments.
    const refunds: CancelRefundLine[] = [];
    let remaining = policy.refundablePaise;
    try {
        for (const p of captured) {
            if (remaining <= 0) break;
            if (p.refundId) continue; // already refunded (idempotent retry)
            const amt = Math.min(remaining, p.amount_paise);
            if (amt <= 0) continue;
            const res = await getProvider(p.gateway as GatewayId).refund({ gatewayPaymentId: p.gatewayPaymentId!, amountPaise: amt, idempotencyKey: `cancel:${p.id}` });
            await db.payment.update({ where: { id: p.id }, data: { refundId: res.refundId, refundAmount: (amt / 100).toFixed(2) } });
            refunds.push({ paymentId: p.id, refundId: res.refundId, state: res.state, amountPaise: amt });
            remaining -= amt;
        }
    } catch (e) {
        console.error("[cancelBooking] refund failed", e);
        return { success: false, reason: "error", message: "Refund could not be initiated. Please try again." };
    }

    // Mark cancelled + cancel the unpaid installments (atomic).
    await db.$transaction(async (tx) => {
        await tx.booking.update({
            where: { id: booking.id },
            data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: params.reason ?? null },
        });
        await tx.paymentInstallment.updateMany({
            where: { bookingId: booking.id, status: { in: ["PENDING", "OVERDUE"] } },
            data: { status: "CANCELLED" },
        });
    });

    try { await notifyCancellation(booking.id, policy.refundablePaise, policy.feePaise); } catch (e) { console.error("[cancelBooking] email failed", e); }

    for (const hb of booking.hotelBookings) {
        try {
            await notifyOwnerBookingCancelled({
                hotelId: hb.hotelId,
                bookingNumber: booking.bookingNumber,
                checkInDate: hb.checkInDate,
                checkOutDate: hb.checkOutDate,
            });
        } catch (e) {
            console.error("[cancelBooking] owner notify failed", e);
        }
    }

    return { success: true, alreadyCancelled: false, paidPaise, refundablePaise: policy.refundablePaise, feePaise: policy.feePaise, refundPct: policy.refundPct, refunds };
}

/** Read-only preview for the confirm dialog (no writes). */
export async function previewCancellation(bookingId: string, byUserId?: string): Promise<CancellationPreview | null> {
    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: { userId: true, startDate: true, payments: { select: { status: true, amount_paise: true } } },
    });
    if (!booking) return null;
    if (byUserId && booking.userId !== byUserId) return null;
    const paidPaise = booking.payments.filter((p) => p.status === "FULLY_PAID").reduce((s, p) => s + p.amount_paise, 0);
    const r = computeCancellationRefund({ paidPaise, travelDate: isoDate(booking.startDate) });
    return { paidPaise, refundablePaise: r.refundablePaise, feePaise: r.feePaise, refundPct: r.refundPct, daysToTravel: r.daysToTravel };
}
