import "server-only";
import type { Prisma } from "@/app/generated/prisma";

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

/** Map a gateway method/mode (Razorpay lowercase or PayU codes) to our enum. */
function mapMethod(m: unknown): "UPI" | "CARD" | "NET_BANKING" | "WALLET" | "EMI" | "CASH" | null {
    const s = String(m ?? "").toLowerCase();
    if (s === "upi") return "UPI";
    if (s === "card" || s === "cc" || s === "dc" || s === "creditcard" || s === "debitcard") return "CARD";
    if (s === "netbanking" || s === "nb") return "NET_BANKING";
    if (s === "wallet" || s === "cashcard") return "WALLET";
    if (s === "emi") return "EMI";
    if (s === "cash") return "CASH";
    return null;
}

export async function finalizeCapturedPayment(
    tx: Prisma.TransactionClient,
    args: {
        paymentId: string;
        gatewayPaymentId: string;
        method?: string | null;
        rawPayload?: object | null;
        webhookEventId?: string | null;
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
    const rupees = (paise: number) => (paise / 100).toFixed(2);

    // Mark the captured payment paid (common to all purposes).
    await tx.payment.update({
        where: { id: payment.id },
        data: {
            status: "FULLY_PAID",
            gatewayPaymentId: args.gatewayPaymentId,
            method: mapMethod(args.method),
            paidAt: now,
            rawResponse: args.rawPayload ?? undefined,
            webhookEventId: args.webhookEventId ?? undefined,
        },
    });

    if (payment.purpose === "INITIAL") {
        const isFull = booking.paymentPlan === "FULL";
        await tx.paymentInstallment.updateMany({
            where: { bookingId: booking.id, type: "DEPOSIT" },
            data: { status: "PAID", paidPaymentId: payment.id, paidAt: now },
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
                paymentStatus: newPaidPaise >= booking.totalAmount_paise ? "FULLY_PAID" : "ADVANCE_PAID",
            },
        });
    }

    return { result: "finalized", bookingId: booking.id, purpose: payment.purpose };
}
