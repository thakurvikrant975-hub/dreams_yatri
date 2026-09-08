"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/app/lib/db";
import { getCurrentMember } from "../lib/get-current-member";
import { finalizeCapturedPayment, reverseFinalizedPayment } from "@/app/actions/payment/finalize.service";
import { runPaymentConfirmedEffects } from "@/app/actions/payment/confirmation-effects";

/**
 * Money taken outside the payment gateway — company UPI, a bank transfer, cash
 * or a cheque — recorded by the sales exec who took it.
 *
 * WHY THIS EXISTS. Razorpay records itself: the gateway confirms, the booking
 * settles, the invoice and the receipt and the ops handoff all follow. Money
 * collected any other way was invisible — the booking still read unpaid, so
 * ops never picked it up and the day's revenue was wrong. It was being typed
 * into the lead report and kept in ONE PERSON'S BROWSER (localStorage), which
 * is why that module says of itself that it goes away once this exists.
 *
 * WHAT IT DELIBERATELY DOES NOT DO. There is no approval step. At three or
 * four payments a day with a manager reading the numbers, a verification queue
 * would be ceremony rather than control, and that was a considered decision.
 * The mandatory receipt image and the recorded-by name are the audit trail
 * instead — which is exactly why the receipt is required rather than optional:
 * with no second pair of eyes, it is the only evidence there is.
 *
 * THE ONE THING IT REFUSES TO DO IS DELETE. See voidOfflinePayment.
 *
 * Everything downstream is the gateway's own path, unchanged:
 * finalizeCapturedPayment settles the booking and runPaymentConfirmedEffects
 * raises the invoice, emails the receipt, congratulates the exec and moves the
 * booking into the ops queue. Nothing below this file knows how the money
 * arrived, and nothing below it should have to.
 */

type Member = NonNullable<Awaited<ReturnType<typeof getCurrentMember>>>;

async function requireMember(): Promise<{ ok: true; member: Member } | { ok: false; error: string }> {
    const member = await getCurrentMember();
    if (!member) return { ok: false, error: "Not authenticated." };
    if (!member.isActive) return { ok: false, error: "Your account is inactive." };
    return { ok: true, member };
}

/** The rails money actually arrives on outside the gateway. */
const OFFLINE_METHODS = ["UPI", "BANK_TRANSFER", "CASH", "CHEQUE"] as const;
type OfflineMethod = (typeof OFFLINE_METHODS)[number];

const recordSchema = z.object({
    bookingId: z.string().min(1),
    /** Whole rupees as typed; converted to paise here so the UI never has to. */
    amountRupees: z.number().positive("Enter an amount greater than zero.").finite(),
    method: z.enum(OFFLINE_METHODS),
    /** UTR / transaction / cheque number. Optional only for cash, which has none. */
    reference: z.string().trim().max(120).optional(),
    /** When the money actually arrived — not when this form was filled in. */
    receivedAt: z.coerce.date(),
    /** Screenshot or photo of the receipt. Required: with no approval step this
     *  is the whole evidence trail. */
    receiptUrl: z.string().trim().min(1, "Attach the payment receipt."),
    notes: z.string().trim().max(500).optional(),
});

export type RecordOfflinePaymentInput = z.input<typeof recordSchema>;

export type RecordResult =
    | { success: true; paymentId: string; bookingNumber: string }
    | { success: false; error: string };

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

function isUniqueViolation(e: unknown): boolean {
    return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export async function recordOfflinePayment(raw: RecordOfflinePaymentInput): Promise<RecordResult> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const parsed = recordSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
    }
    const input = parsed.data;

    // A cheque or a transfer without its number cannot be matched to a bank
    // statement later, which is the only way this record ever gets checked.
    const reference = input.reference?.trim() || null;
    if (!reference && input.method !== "CASH") {
        return { success: false, error: "Enter the UTR / transaction / cheque number." };
    }
    if (input.receivedAt.getTime() > Date.now() + 60_000) {
        return { success: false, error: "The received date cannot be in the future." };
    }

    const amountPaise = Math.round(input.amountRupees * 100);

    const booking = await db.booking.findUnique({
        where: { id: input.bookingId },
        select: {
            id: true, bookingNumber: true, userId: true, currency: true, paymentPlan: true,
            totalAmount_paise: true, advanceAmount_paise: true,
        },
    });
    if (!booking) return { success: false, error: "Booking not found." };

    // What has actually been settled so far. Voided rows are excluded by the
    // status filter, which is the whole reason VOIDED is a status.
    const settled = await db.payment.aggregate({
        where: { bookingId: booking.id, status: { in: ["ADVANCE_PAID", "FULLY_PAID"] } },
        _sum: { amount_paise: true },
        _count: true,
    });
    const paidPaise = settled._sum.amount_paise ?? 0;
    const outstanding = booking.totalAmount_paise - paidPaise;

    if (outstanding <= 0) {
        return { success: false, error: `${booking.bookingNumber} is already paid in full.` };
    }
    if (amountPaise > outstanding) {
        return {
            success: false,
            error: `That is more than the outstanding ${rupees(outstanding)}. Record the exact amount received.`,
        };
    }

    // ── Which leg is this? ───────────────────────────────────────────────────
    // The INITIAL branch of finalizeCapturedPayment sets the booking's paid
    // figure from the BOOKING's deposit/total, not from the payment's own
    // amount — safe for a gateway charge, which is always raised for exactly
    // that figure, but it would overstate a part payment typed in by hand. So
    // a first payment is only INITIAL when it matches one of those two figures
    // exactly; anything else is refused rather than silently rounded up.
    const isFirst = settled._count === 0;
    const expectedFull = booking.totalAmount_paise;
    const expectedDeposit = booking.paymentPlan === "FULL" ? expectedFull : booking.advanceAmount_paise;

    if (isFirst && amountPaise !== expectedDeposit && amountPaise !== expectedFull) {
        const options = expectedDeposit === expectedFull
            ? rupees(expectedFull)
            : `${rupees(expectedDeposit)} (deposit) or ${rupees(expectedFull)} (full)`;
        return {
            success: false,
            error: `The first payment on a booking must be ${options}. Received a different amount? Record it once the deposit is settled.`,
        };
    }
    const purpose = isFirst ? "INITIAL" : "BALANCE";

    // ── Write, then settle, in one transaction ───────────────────────────────
    let paymentId: string;
    try {
        paymentId = await db.$transaction(async (tx) => {
            const payment = await tx.payment.create({
                data: {
                    bookingId: booking.id,
                    userId: booking.userId,
                    amount: (amountPaise / 100).toFixed(2),
                    amount_paise: amountPaise,
                    currency: booking.currency ?? "INR",
                    gateway: "OFFLINE",
                    method: input.method,
                    status: "PENDING",
                    purpose,
                    // The UTR goes in the gateway id column, which is @unique —
                    // so the database itself refuses the same transfer twice.
                    // With several execs entering payments, one being recorded
                    // twice is far likelier than anyone acting in bad faith.
                    gatewayPaymentId: reference,
                    recordedById: gate.member.id,
                    recordedByName: gate.member.name,
                    receiptUrl: input.receiptUrl,
                    notes: input.notes || null,
                },
                select: { id: true },
            });

            const fin = await finalizeCapturedPayment(tx, {
                paymentId: payment.id,
                // Cash has no reference of its own; a synthetic one keeps the
                // column populated and unique without pretending to be a UTR.
                gatewayPaymentId: reference ?? `OFFLINE-${payment.id}`,
                method: input.method,
                paidAt: input.receivedAt,
            });
            if (fin.result !== "finalized") {
                throw new Error(`Could not settle this payment (${fin.result}).`);
            }

            await tx.bookingTimeline.create({
                data: {
                    bookingId: booking.id,
                    action: "NOTE_ADDED",
                    note: `Offline payment recorded: ${rupees(amountPaise)} by ${input.method.toLowerCase().replace("_", " ")}`
                        + `${reference ? ` (ref ${reference})` : ""} received ${input.receivedAt.toISOString().slice(0, 10)}.`,
                    performedById: gate.member.id,
                    performedByName: gate.member.name,
                    departmentId: gate.member.department?.id ?? null,
                },
            });

            return payment.id;
        });
    } catch (e) {
        if (isUniqueViolation(e)) {
            return { success: false, error: `Reference ${reference} is already recorded against a payment.` };
        }
        console.error("[offline-payment] record failed", e);
        return { success: false, error: e instanceof Error ? e.message : "Could not record this payment." };
    }

    // Outside the transaction, exactly as the webhook does it: these are
    // best-effort and must never roll back money that is already settled.
    await runPaymentConfirmedEffects({
        confirmInitial: purpose === "INITIAL",
        isNewCapture: true,
        bookingId: booking.id,
        paymentId,
    });

    revalidatePath(`/dashboard/package-bookings/${booking.id}`);
    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/transactions");

    return { success: true, paymentId, bookingNumber: booking.bookingNumber };
}

const voidSchema = z.object({
    paymentId: z.string().min(1),
    reason: z.string().trim().min(4, "Say why this is being voided.").max(300),
});

export type VoidResult = { success: true } | { success: false; error: string };

/**
 * Reverse a payment recorded in error.
 *
 * Voids rather than deletes, and the difference is not pedantry. By the time
 * someone notices, the invoice number is spent, the receipt is in the client's
 * inbox and ops may have confirmed a hotel against the booking. Deleting the
 * row leaves a hole in a GST sequence and no record of why; voiding leaves the
 * trail and still removes the money from every figure, because the sums filter
 * on status. It also matches a decision already made in the schema, where
 * Payment deliberately does not cascade from Booking so that deleting a
 * booking cannot quietly take financial records with it.
 */
export async function voidOfflinePayment(raw: z.input<typeof voidSchema>): Promise<VoidResult> {
    const gate = await requireMember();
    if (!gate.ok) return { success: false, error: gate.error };

    const parsed = voidSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0]?.message ?? "Check the details and try again." };
    }

    const payment = await db.payment.findUnique({
        where: { id: parsed.data.paymentId },
        select: { id: true, gateway: true, bookingId: true, amount_paise: true, status: true },
    });
    if (!payment) return { success: false, error: "Payment not found." };

    // A gateway payment is the gateway's record, not ours, and unwinding one
    // here would leave our books disagreeing with Razorpay's. Those are
    // refunded through the provider instead.
    if (payment.gateway !== "OFFLINE") {
        return { success: false, error: "Only offline payments can be voided here. Refund gateway payments through the gateway." };
    }

    try {
        const out = await db.$transaction(async (tx) => {
            const res = await reverseFinalizedPayment(tx, {
                paymentId: payment.id,
                reason: parsed.data.reason,
                byId: gate.member.id,
                byName: gate.member.name,
            });
            if (res.result === "reversed") {
                await tx.bookingTimeline.create({
                    data: {
                        bookingId: payment.bookingId,
                        action: "NOTE_ADDED",
                        note: `Offline payment of ${rupees(payment.amount_paise)} voided: ${parsed.data.reason}`,
                        performedById: gate.member.id,
                        performedByName: gate.member.name,
                        departmentId: gate.member.department?.id ?? null,
                    },
                });
            }
            return res;
        });

        if (out.result === "already") return { success: false, error: "This payment is already voided." };
        if (out.result === "not_reversible") return { success: false, error: `A ${out.status.toLowerCase()} payment cannot be voided.` };
        if (out.result !== "reversed") return { success: false, error: "Could not void this payment." };
    } catch (e) {
        console.error("[offline-payment] void failed", e);
        return { success: false, error: "Could not void this payment." };
    }

    revalidatePath(`/dashboard/package-bookings/${payment.bookingId}`);
    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/transactions");
    return { success: true };
}
