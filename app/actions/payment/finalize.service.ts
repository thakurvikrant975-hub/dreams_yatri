import "server-only";
import type { TransactionClient } from "@/app/lib/db";

/**
 * Apply a captured payment to the booking — the single place that flips
 * Payment → FULLY_PAID, the DEPOSIT installment → PAID, and the Booking's
 * paymentStatus + money. Shared by the webhook (truth) and reconciliation
 * (safety net) so they can never diverge.
 *
 * Runs inside a caller-supplied transaction. Idempotent: a Payment already
 * FULLY_PAID is a no-op (`already`), so re-delivery / recon-after-webhook is safe.
 */

export type FinalizeResult =
    | { result: "finalized"; bookingId: string; purpose: "INITIAL" | "TOPUP" | "BALANCE" }
    | { result: "already"; bookingId: string }
    | { result: "not_found" }
    | { result: "no_booking" };

/** Map a gateway method/mode (Razorpay lowercase or PayU codes) to our enum.
 *  Also accepts our own enum values verbatim, which is how an offline payment
 *  — whose method is chosen from a dropdown, not reported by a gateway —
 *  arrives here. */
function mapMethod(m: unknown): "UPI" | "CARD" | "NET_BANKING" | "WALLET" | "EMI" | "CASH" | "BANK_TRANSFER" | "CHEQUE" | null {
    const s = String(m ?? "").toLowerCase();
    if (s === "upi") return "UPI";
    if (s === "card" || s === "cc" || s === "dc" || s === "creditcard" || s === "debitcard") return "CARD";
    if (s === "netbanking" || s === "nb") return "NET_BANKING";
    if (s === "wallet" || s === "cashcard") return "WALLET";
    if (s === "emi") return "EMI";
    if (s === "cash") return "CASH";
    if (s === "bank_transfer") return "BANK_TRANSFER";
    if (s === "cheque") return "CHEQUE";
    return null;
}

export async function finalizeCapturedPayment(
    tx: TransactionClient,
    args: {
        paymentId: string;
        gatewayPaymentId: string;
        method?: string | null;
        rawPayload?: object | null;
        webhookEventId?: string | null;
        /** When the money actually arrived. Gateway captures are "now" by
         *  definition, but an offline payment is typically entered a day or two
         *  after it was taken, and the daily report reads paidAt — so recording
         *  it as the entry time would put yesterday's cash in today's figures. */
        paidAt?: Date | null;
    },
): Promise<FinalizeResult> {
    const payment = await tx.payment.findUnique({
        where: { id: args.paymentId },
        select: { id: true, status: true, bookingId: true, purpose: true, amount_paise: true },
    });
    if (!payment) return { result: "not_found" };
    if (payment.status === "FULLY_PAID") return { result: "already", bookingId: payment.bookingId };

    const booking = await tx.booking.findUnique({
        where: { id: payment.bookingId },
        select: { id: true, paymentPlan: true, paidAmount: true, totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true },
    });
    if (!booking) return { result: "no_booking" };

    const now = new Date();
    /** When the money landed; `now` for a gateway capture. */
    const paidAt = args.paidAt ?? now;
    const rupees = (paise: number) => (paise / 100).toFixed(2);

    // Mark the captured payment paid (common to all purposes).
    await tx.payment.update({
        where: { id: payment.id },
        data: {
            status: "FULLY_PAID",
            gatewayPaymentId: args.gatewayPaymentId,
            method: mapMethod(args.method),
            paidAt,
            rawResponse: args.rawPayload ?? undefined,
            webhookEventId: args.webhookEventId ?? undefined,
        },
    });

    if (payment.purpose === "INITIAL") {
        const isFull = booking.paymentPlan === "FULL";
        await tx.paymentInstallment.updateMany({
            where: { bookingId: booking.id, type: "DEPOSIT" },
            data: { status: "PAID", paidPaymentId: payment.id, paidAt },
        });
        await tx.booking.update({
            where: { id: booking.id },
            data: {
                paymentStatus: isFull ? "FULLY_PAID" : "ADVANCE_PAID",
                paidAmount: isFull ? rupees(booking.totalAmount_paise) : rupees(booking.advanceAmount_paise),
                advancePaidAmount: isFull ? rupees(booking.totalAmount_paise) : rupees(booking.advanceAmount_paise),
                balanceDueAmount: isFull ? "0.00" : rupees(booking.balanceAmount_paise),
            },
        });
    } else {
        // TOPUP / BALANCE: add to paid, recompute balance & status; don't touch the deposit installment.
        const newPaidPaise = Math.round(Number(booking.paidAmount) * 100) + payment.amount_paise;
        const balancePaise = Math.max(0, booking.totalAmount_paise - newPaidPaise);
        await tx.booking.update({
            where: { id: booking.id },
            data: {
                paidAmount: rupees(newPaidPaise),
                balanceDueAmount: rupees(balancePaise),
                balanceAmount_paise: balancePaise,
                paymentStatus: newPaidPaise >= booking.totalAmount_paise ? "FULLY_PAID" : "ADVANCE_PAID",
            },
        });
    }

    return { result: "finalized", bookingId: booking.id, purpose: payment.purpose };
}

export type ReverseResult =
    | { result: "reversed"; bookingId: string }
    | { result: "already" }
    | { result: "not_reversible"; status: string }
    | { result: "not_found" }
    | { result: "no_booking" };

/**
 * Undo a settled payment — the exact inverse of finalizeCapturedPayment, and
 * kept beside it so the two are read and changed together.
 *
 * VOIDS, never deletes. By the time a mistake surfaces the invoice number is
 * spent, the receipt is in the client's inbox and ops may already have
 * confirmed a hotel against the booking. A deleted row leaves a hole in a GST
 * sequence and no record of why; a voided one leaves the trail intact and
 * still drops out of every money query, because those filter on status.
 *
 * The booking's money is RECOMPUTED from the payments that remain, not
 * decremented. Decrementing trusts the stored figure to have been right;
 * recomputing makes the payments the source of truth, so a booking that had
 * drifted is corrected rather than having the drift preserved.
 *
 * NOTE ON BOOKING.status: deliberately untouched. paymentStatus falling back
 * below ADVANCE_PAID already removes the booking from the ops queue (which
 * filters on it), and rolling a workflow status backwards would erase real
 * work — a hotel ops actually confirmed does not become unconfirmed because
 * the payment behind it was mis-keyed. That is a conversation for a human.
 */
export async function reverseFinalizedPayment(
    tx: TransactionClient,
    args: {
        paymentId: string;
        reason: string;
        byId?: string | null;
        byName?: string | null;
        now?: Date;
    },
): Promise<ReverseResult> {
    const payment = await tx.payment.findUnique({
        where: { id: args.paymentId },
        select: { id: true, status: true, bookingId: true, amount_paise: true },
    });
    if (!payment) return { result: "not_found" };
    if (payment.status === "VOIDED") return { result: "already" };
    // Refunds are the gateway's own reversal and carry money movement of their
    // own; voiding one on top would double-count. FAILED/PENDING never touched
    // the booking, so there is nothing to unwind.
    if (payment.status !== "FULLY_PAID" && payment.status !== "ADVANCE_PAID") {
        return { result: "not_reversible", status: payment.status };
    }

    const booking = await tx.booking.findUnique({
        where: { id: payment.bookingId },
        select: { id: true, paymentPlan: true, totalAmount_paise: true, advanceAmount_paise: true },
    });
    if (!booking) return { result: "no_booking" };

    const now = args.now ?? new Date();
    const rupees = (paise: number) => (paise / 100).toFixed(2);

    await tx.payment.update({
        where: { id: payment.id },
        data: {
            status: "VOIDED",
            voidedAt: now,
            voidedById: args.byId ?? undefined,
            voidedByName: args.byName ?? undefined,
            voidReason: args.reason,
        },
    });

    // Release the deposit installment if THIS payment is the one that settled
    // it; another payment may legitimately have covered it.
    await tx.paymentInstallment.updateMany({
        where: { bookingId: booking.id, paidPaymentId: payment.id },
        data: { status: "PENDING", paidPaymentId: null, paidAt: null },
    });

    // Recompute from what is left standing.
    const live = await tx.payment.aggregate({
        where: { bookingId: booking.id, status: { in: ["ADVANCE_PAID", "FULLY_PAID"] } },
        _sum: { amount_paise: true },
    });
    const paidPaise = live._sum.amount_paise ?? 0;
    const balancePaise = Math.max(0, booking.totalAmount_paise - paidPaise);

    // The advance leg counts as paid only while a DEPOSIT installment is still
    // PAID — the same fact the forward path asserts when it sets this.
    const depositStillPaid = await tx.paymentInstallment.count({
        where: { bookingId: booking.id, type: "DEPOSIT", status: "PAID" },
    });
    const isFull = booking.paymentPlan === "FULL";
    const advancePaidPaise = depositStillPaid > 0
        ? (isFull ? booking.totalAmount_paise : booking.advanceAmount_paise)
        : 0;

    await tx.booking.update({
        where: { id: booking.id },
        data: {
            paymentStatus: paidPaise <= 0 ? "PENDING"
                : paidPaise >= booking.totalAmount_paise ? "FULLY_PAID"
                    : "ADVANCE_PAID",
            paidAmount: rupees(paidPaise),
            advancePaidAmount: rupees(advancePaidPaise),
            balanceDueAmount: rupees(balancePaise),
            balanceAmount_paise: balancePaise,
        },
    });

    return { result: "reversed", bookingId: booking.id };
}
