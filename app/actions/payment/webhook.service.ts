import "server-only";
import { db } from "@/app/lib/db";
import { verifyWebhookSignature } from "@/app/lib/razorpay";

/**
 * Authoritative Razorpay webhook processing (the source of payment truth).
 *
 * verify signature → dedupe via WebhookEvent (gateway,eventId) → on
 * payment.captured: mark Payment paid, flip Booking paymentStatus + money, mark
 * the DEPOSIT installment paid. Idempotent: a PROCESSED event is a no-op; a
 * recorded-but-unprocessed event is reprocessed (so a failed attempt can retry).
 *
 * Returns an httpStatus the route relays. 400 = bad signature (no retry wanted);
 * 200 = handled/ignored/duplicate; 500 = processing error (Razorpay will retry).
 */

export interface WebhookOutcome {
    httpStatus: number;
    result: "invalid_signature" | "duplicate" | "ignored" | "processed" | "error";
    detail?: string;
}

function mapMethod(m: unknown): "UPI" | "CARD" | "NET_BANKING" | "WALLET" | "EMI" | null {
    switch (m) {
        case "upi": return "UPI";
        case "card": return "CARD";
        case "netbanking": return "NET_BANKING";
        case "wallet": return "WALLET";
        case "emi": return "EMI";
        default: return null;
    }
}

function isUniqueViolation(e: unknown): boolean {
    return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export async function processRazorpayWebhook(args: {
    rawBody: string;
    signature: string;
    eventId: string | null;
}): Promise<WebhookOutcome> {
    if (!verifyWebhookSignature(args.rawBody, args.signature)) {
        return { httpStatus: 400, result: "invalid_signature" };
    }

    let body: {
        event?: string;
        payload?: { payment?: { entity?: { id?: string; order_id?: string; method?: string } } };
    };
    try {
        body = JSON.parse(args.rawBody);
    } catch {
        return { httpStatus: 400, result: "error", detail: "bad json" };
    }

    const eventType = body.event ?? "unknown";
    // Razorpay sends x-razorpay-event-id; fall back to a stable key from the body.
    const paymentEntityId = body.payload?.payment?.entity?.id;
    const eventId = args.eventId ?? `${eventType}:${paymentEntityId ?? args.rawBody.length}`;

    // ── Dedupe: find-or-create the event row (PROCESSED ⇒ no-op) ───────────────
    let eventRow = await db.webhookEvent.findUnique({
        where: { gateway_eventId: { gateway: "RAZORPAY", eventId } },
    });
    if (eventRow?.status === "PROCESSED") {
        return { httpStatus: 200, result: "duplicate" };
    }
    if (!eventRow) {
        try {
            eventRow = await db.webhookEvent.create({
                data: {
                    gateway: "RAZORPAY",
                    eventId,
                    eventType,
                    payload: body as unknown as object,
                    signature: args.signature,
                },
            });
        } catch (e) {
            if (isUniqueViolation(e)) return { httpStatus: 200, result: "duplicate" }; // raced
            throw e;
        }
    }

    // ── Only payment.captured drives money; record + ignore the rest ───────────
    const entity = body.payload?.payment?.entity;
    if (eventType !== "payment.captured" || !entity?.order_id || !entity.id) {
        await db.webhookEvent.update({ where: { id: eventRow.id }, data: { status: "IGNORED", processedAt: new Date() } });
        return { httpStatus: 200, result: "ignored" };
    }

    const payment = await db.payment.findUnique({
        where: { gatewayOrderId: entity.order_id },
        select: { id: true, status: true, bookingId: true },
    });
    if (!payment) {
        await db.webhookEvent.update({ where: { id: eventRow.id }, data: { status: "IGNORED", processedAt: new Date(), error: "no matching payment" } });
        return { httpStatus: 200, result: "ignored", detail: "unknown order" };
    }

    const booking = await db.booking.findUnique({
        where: { id: payment.bookingId },
        select: { id: true, paymentPlan: true, totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true },
    });
    if (!booking) {
        await db.webhookEvent.update({ where: { id: eventRow.id }, data: { status: "FAILED", error: "booking missing" } });
        return { httpStatus: 500, result: "error", detail: "booking missing" };
    }

    const now = new Date();
    const isFull = booking.paymentPlan === "FULL";
    const rupees = (paise: number) => (paise / 100).toFixed(2);

    try {
        await db.$transaction(async (tx) => {
            await tx.payment.update({
                where: { id: payment.id },
                data: {
                    status: "FULLY_PAID", // this payment captured in full
                    gatewayPaymentId: entity.id,
                    method: mapMethod(entity.method),
                    paidAt: now,
                    rawResponse: body as unknown as object,
                    webhookEventId: eventRow!.id,
                },
            });

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

            await tx.webhookEvent.update({
                where: { id: eventRow!.id },
                data: { status: "PROCESSED", processedAt: now, paymentId: payment.id, bookingId: booking.id },
            });
        });
    } catch (e) {
        console.error("[razorpay webhook] processing failed", e);
        await db.webhookEvent.update({ where: { id: eventRow.id }, data: { status: "FAILED", error: String(e) } }).catch(() => {});
        return { httpStatus: 500, result: "error" };
    }

    return { httpStatus: 200, result: "processed" };
}
