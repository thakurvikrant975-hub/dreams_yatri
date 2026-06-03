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
        select: { id: true },
    });
    if (!payment) {
        await db.webhookEvent.update({ where: { id: eventRow.id }, data: { status: "IGNORED", processedAt: new Date(), error: "no matching payment" } });
        return { httpStatus: 200, result: "ignored", detail: "unknown order" };
    }

    try {
        const row = eventRow;
        const outcome = await db.$transaction(async (tx) => {
            const fin = await finalizeCapturedPayment(tx, {
                paymentId: payment.id,
                gatewayPaymentId: entity.id!,
                method: entity.method,
                rawPayload: body as unknown as object,
                webhookEventId: row.id,
            });
            if (fin.result === "finalized" || fin.result === "already") {
                await tx.webhookEvent.update({
                    where: { id: row.id },
                    data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id, bookingId: fin.bookingId },
                });
                return "ok" as const;
            }
            // not_found / no_booking — surface as failure (no booking to credit).
            await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "FAILED", error: fin.result } });
            return "fail" as const;
        });
        if (outcome === "fail") return { httpStatus: 500, result: "error", detail: "finalize failed" };
    } catch (e) {
        console.error("[razorpay webhook] processing failed", e);
        await db.webhookEvent.update({ where: { id: eventRow.id }, data: { status: "FAILED", error: String(e) } }).catch(() => {});
        return { httpStatus: 500, result: "error" };
    }

    return { httpStatus: 200, result: "processed" };
}
