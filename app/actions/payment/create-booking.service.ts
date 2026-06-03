import "server-only";
import { randomBytes } from "crypto";
import { db } from "@/app/lib/db";
import { getQuote, isQuoteFresh } from "@/app/actions/quote/get-quote.service";
import { computePaymentSchedule } from "@/app/services/payment-policy/engine";
import { rupeesToPaise } from "@/app/lib/money";
import { createRazorpayOrder, razorpayKeyId } from "@/app/lib/razorpay";
import type { CreateBookingOrderResult } from "./types";

/**
 * Turn an ACTIVE + fresh quote into a Booking (+ installment legs, quote→CONSUMED,
 * a PENDING Payment) and a Razorpay order for the FIRST leg (deposit, or full).
 *
 * Server-authoritative: the amount comes from the quote total + Phase-3 policy,
 * never the client. The Razorpay order is created OUTSIDE the DB transaction
 * (no network call inside a tx). Idempotent: a quote already turned into a
 * booking is resumed (its pending order returned / created), so retries — and
 * the already-CONSUMED quote — never duplicate a booking (Booking.quoteId @unique).
 */

function genBookingNumber(): string {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `DY-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

async function ensureOrderForPayment(args: {
    paymentId: string;
    existingOrderId: string | null;
    amountPaise: number;
    receipt: string;
    bookingId: string;
    quoteId: string;
}): Promise<string> {
    if (args.existingOrderId) return args.existingOrderId;
    const order = await createRazorpayOrder({
        amountPaise: args.amountPaise,
        receipt: args.receipt,
        notes: { quoteId: args.quoteId, bookingId: args.bookingId },
    });
    await db.payment.update({ where: { id: args.paymentId }, data: { gatewayOrderId: order.orderId } });
    return order.orderId;
}

export async function createBookingAndOrder(params: {
    quoteId: string;
    userId: string;
}): Promise<CreateBookingOrderResult> {
    const { quoteId, userId } = params;

    // ── Resume path: this quote already became a booking (idempotent retry) ────
    const existing = await db.booking.findUnique({
        where: { quoteId },
        select: { id: true, userId: true, bookingNumber: true, paymentPlan: true, currency: true },
    });
    if (existing) {
        if (existing.userId !== userId) {
            return { success: false, reason: "invalid", message: "Booking belongs to another user." };
        }
        const payment = await db.payment.findFirst({
            where: { bookingId: existing.id, gateway: "RAZORPAY", status: "PENDING" },
            orderBy: { createdAt: "asc" },
            select: { id: true, amount_paise: true, gatewayOrderId: true },
        });
        if (!payment) return { success: false, reason: "error", message: "No pending payment to resume." };

        const orderId = await ensureOrderForPayment({
            paymentId: payment.id,
            existingOrderId: payment.gatewayOrderId,
            amountPaise: payment.amount_paise,
            receipt: existing.bookingNumber,
            bookingId: existing.id,
            quoteId,
        });
        return {
            success: true,
            order: {
                bookingId: existing.id,
                bookingNumber: existing.bookingNumber,
                orderId,
                amountPaise: payment.amount_paise,
                currency: existing.currency,
                keyId: razorpayKeyId(),
                plan: existing.paymentPlan ?? "FULL",
            },
        };
    }

    // ── Gate: quote must verify, be ACTIVE, and still be fresh ─────────────────
    const gate = await getQuote(quoteId);
    if (!gate.success) return { success: false, reason: gate.reason };
    if (gate.quote.status !== "ACTIVE") return { success: false, reason: "not_active" };
    const fresh = await isQuoteFresh(quoteId);
    if (!fresh || !fresh.fresh) return { success: false, reason: "stale" };

    // ── Load the raw quote row (ids + frozen breakdown) + package/duration ─────
    const row = await db.package_quote.findUnique({ where: { id: quoteId } });
    if (!row) return { success: false, reason: "not_found" };

    const [pkg, dur] = await Promise.all([
        db.packages.findUnique({ where: { id: row.package_id }, select: { id: true, destination_id: true } }),
        db.package_durations.findUnique({ where: { id: row.duration_id }, select: { days: true, nights: true } }),
    ]);
    if (!pkg || !dur) return { success: false, reason: "error", message: "Package or duration not found." };

    // ── Server-derived money + schedule ────────────────────────────────────────
    const totalPaise = rupeesToPaise(row.total_amount.toString());
    const schedule = computePaymentSchedule({ totalPaise, travelDate: isoDate(row.travel_date), now: new Date() });
    const firstLeg = schedule.installments[0];

    const startDate = new Date(`${isoDate(row.travel_date)}T00:00:00.000Z`);
    const endDate = new Date(startDate.getTime() + dur.nights * 86_400_000);
    const balanceRupees = (schedule.balancePaise / 100).toFixed(2);

    // ── Create booking + legs + PENDING payment; consume quote (atomic) ────────
    const created = await db.$transaction(async (tx) => {
        const booking = await tx.booking.create({
            data: {
                bookingNumber: genBookingNumber(),
                userId,
                packageId: pkg.id,
                destinationId: pkg.destination_id,
                tripType: "Leisure", // TODO: infer from package; not payment-critical
                startDate,
                endDate,
                duration: dur.days,
                travellers: row.adults + row.children + row.infants,
                totalAmount: row.total_amount.toString(),
                totalAmount_paise: totalPaise,
                advanceAmount_paise: schedule.depositPaise,
                balanceAmount_paise: schedule.balancePaise,
                balanceDueAmount: balanceRupees,
                balanceDueDate: schedule.balanceDueDate ? new Date(`${schedule.balanceDueDate}T00:00:00.000Z`) : null,
                currency: row.currency,
                paymentPlan: schedule.plan,
                paymentStatus: "PENDING",
                priceSnapshot: row.breakdown as object,
                quoteId,
                quoteInputsHash: row.inputs_hash,
                installments: {
                    create: schedule.installments.map((l) => ({
                        type: l.type,
                        sequence: l.sequence,
                        amount_paise: l.amountPaise,
                        dueDate: new Date(`${l.dueDate}T00:00:00.000Z`),
                        status: "PENDING" as const,
                    })),
                },
            },
            select: { id: true, bookingNumber: true },
        });

        await tx.package_quote.update({ where: { id: quoteId }, data: { status: "CONSUMED" } });

        const payment = await tx.payment.create({
            data: {
                bookingId: booking.id,
                userId,
                amount: (firstLeg.amountPaise / 100).toFixed(2),
                amount_paise: firstLeg.amountPaise,
                gateway: "RAZORPAY",
                status: "PENDING",
                idempotencyKey: `quote:${quoteId}:${firstLeg.type}`,
            },
            select: { id: true },
        });

        return { bookingId: booking.id, bookingNumber: booking.bookingNumber, paymentId: payment.id };
    });

    // ── Razorpay order (outside the tx) ────────────────────────────────────────
    const orderId = await ensureOrderForPayment({
        paymentId: created.paymentId,
        existingOrderId: null,
        amountPaise: firstLeg.amountPaise,
        receipt: created.bookingNumber,
        bookingId: created.bookingId,
        quoteId,
    });

    return {
        success: true,
        order: {
            bookingId: created.bookingId,
            bookingNumber: created.bookingNumber,
            orderId,
            amountPaise: firstLeg.amountPaise,
            currency: row.currency,
            keyId: razorpayKeyId(),
            plan: schedule.plan,
        },
    };
}
