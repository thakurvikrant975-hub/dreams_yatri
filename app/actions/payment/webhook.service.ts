import "server-only";
import { db } from "@/app/lib/db";
import { verifyWebhookSignature } from "@/app/lib/razorpay";
import { finalizeCapturedPayment } from "./finalize.service";

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
        payload?: {
            payment?: {
                entity?: {
                    id?: string;
                    order_id?: string;
                    method?: string;
                    error_description?: string;
                    error_reason?: string;
                    amount?: number;
                    amount_refunded?: number;
                };
            };
            refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
        };
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

    const entity = body.payload?.payment?.entity;
    const refund = body.payload?.refund?.entity;
    const ignore = async (error?: string) => {
        await db.webhookEvent.update({ where: { id: eventRow!.id }, data: { status: "IGNORED", processedAt: new Date(), error } });
        return { httpStatus: 200, result: "ignored" as const };
    };

    try {
        const row = eventRow;

        // ── payment.captured → finalize (money truth) ──────────────────────────
        if (eventType === "payment.captured") {
            if (!entity?.order_id || !entity.id) return ignore("captured without order/id");
            const payment = await db.payment.findUnique({ where: { gatewayOrderId: entity.order_id }, select: { id: true } });
            if (!payment) return ignore("no matching payment");

            const outcome = await db.$transaction(async (tx) => {
                const fin = await finalizeCapturedPayment(tx, {
                    paymentId: payment.id, gatewayPaymentId: entity.id!, method: entity.method,
                    rawPayload: body as unknown as object, webhookEventId: row.id,
                });
                if (fin.result === "finalized" || fin.result === "already") {
                    await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id, bookingId: fin.bookingId } });
                    return "ok" as const;
                }
                await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "FAILED", error: fin.result } });
                return "fail" as const;
            });
            return outcome === "fail"
                ? { httpStatus: 500, result: "error", detail: "finalize failed" }
                : { httpStatus: 200, result: "processed" };
        }

        // ── payment.failed → mark the Payment FAILED (booking left PENDING) ────
        if (eventType === "payment.failed") {
            if (!entity?.order_id) return ignore("failed without order");
            const payment = await db.payment.findUnique({ where: { gatewayOrderId: entity.order_id }, select: { id: true, status: true } });
            if (!payment) return ignore("no matching payment");

            await db.$transaction(async (tx) => {
                if (payment.status === "PENDING") {
                    await tx.payment.update({
                        where: { id: payment.id },
                        data: { status: "FAILED", failureReason: entity.error_description ?? entity.error_reason ?? "payment failed", rawResponse: body as unknown as object, webhookEventId: row.id },
                    });
                }
                await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id } });
            });
            return { httpStatus: 200, result: "processed" };
        }

        // ── refund events → record REFUNDED / PARTIALLY_REFUNDED (record-only) ─
        if (eventType === "refund.processed" || eventType === "refund.created" || eventType === "payment.refunded") {
            const rpPaymentId = refund?.payment_id ?? entity?.id; // refund.* vs payment.refunded
            const refundAmtPaise = refund?.amount ?? entity?.amount_refunded;
            if (!rpPaymentId) return ignore("refund without payment id");

            const payment = await db.payment.findUnique({ where: { gatewayPaymentId: rpPaymentId }, select: { id: true, bookingId: true, amount_paise: true } });
            if (!payment) return ignore("no matching payment for refund");

            const isPartial = typeof refundAmtPaise === "number" && refundAmtPaise < payment.amount_paise;
            const status = isPartial ? "PARTIALLY_REFUNDED" : "REFUNDED";
            const refundRupees = typeof refundAmtPaise === "number" ? (refundAmtPaise / 100).toFixed(2) : undefined;

            await db.$transaction(async (tx) => {
                await tx.payment.update({
                    where: { id: payment.id },
                    data: { status, refundId: refund?.id, refundAmount: refundRupees, refundedAt: new Date(), rawResponse: body as unknown as object, webhookEventId: row.id },
                });
                await tx.booking.update({ where: { id: payment.bookingId }, data: { paymentStatus: status } });
                await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id, bookingId: payment.bookingId } });
            });
            return { httpStatus: 200, result: "processed" };
        }

        // ── anything else → recorded + ignored ─────────────────────────────────
        return ignore();
    } catch (e) {
        console.error("[razorpay webhook] processing failed", e);
        await db.webhookEvent.update({ where: { id: eventRow.id }, data: { status: "FAILED", error: String(e) } }).catch(() => {});
        return { httpStatus: 500, result: "error" };
    }
}
