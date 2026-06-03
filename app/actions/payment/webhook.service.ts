import "server-only";
import { db } from "@/app/lib/db";
import { getProvider } from "@/app/lib/payments/registry";
import type { GatewayId } from "@/app/lib/payments/types";
import { finalizeCapturedPayment } from "./finalize.service";

/**
 * Gateway-agnostic webhook processing (the source of payment truth).
 *
 * provider.verifyWebhook → dedupe via WebhookEvent(gateway,eventId) →
 * provider.parseWebhookEvent → act on the normalized event:
 *   captured → finalizeCapturedPayment; failed → Payment FAILED;
 *   refunded → REFUNDED / PARTIALLY_REFUNDED (+ Booking mirror); other → IGNORED.
 *
 * Idempotent: a PROCESSED event is a no-op; recorded-but-unprocessed is reprocessed.
 * httpStatus: 400 bad signature; 200 handled/ignored/duplicate; 500 processing error (retry).
 */

export interface WebhookOutcome {
    httpStatus: number;
    result: "invalid_signature" | "duplicate" | "ignored" | "processed" | "error";
    detail?: string;
}

function isUniqueViolation(e: unknown): boolean {
    return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export async function processGatewayWebhook(
    gateway: GatewayId,
    rawBody: string,
    headers: Headers,
): Promise<WebhookOutcome> {
    const provider = getProvider(gateway);

    if (!provider.verifyWebhook(rawBody, headers)) {
        return { httpStatus: 400, result: "invalid_signature" };
    }

    const event = provider.parseWebhookEvent(rawBody, headers);
    if (!event) return { httpStatus: 400, result: "error", detail: "unparseable" };

    // ── Dedupe: find-or-create the event row (PROCESSED ⇒ no-op) ───────────────
    let eventRow = await db.webhookEvent.findUnique({
        where: { gateway_eventId: { gateway, eventId: event.eventId } },
    });
    if (eventRow?.status === "PROCESSED") return { httpStatus: 200, result: "duplicate" };
    if (!eventRow) {
        try {
            eventRow = await db.webhookEvent.create({
                data: { gateway, eventId: event.eventId, eventType: event.type, payload: JSON.parse(rawBody) },
            });
        } catch (e) {
            if (isUniqueViolation(e)) return { httpStatus: 200, result: "duplicate" };
            throw e;
        }
    }
    const row = eventRow;

    const ignore = async (error?: string) => {
        await db.webhookEvent.update({ where: { id: row.id }, data: { status: "IGNORED", processedAt: new Date(), error } });
        return { httpStatus: 200, result: "ignored" as const };
    };

    try {
        // ── captured → finalize ────────────────────────────────────────────────
        if (event.type === "captured") {
            if (!event.gatewayOrderRef || !event.gatewayPaymentId) return ignore("captured without refs");
            const payment = await db.payment.findUnique({ where: { gatewayOrderId: event.gatewayOrderRef }, select: { id: true } });
            if (!payment) return ignore("no matching payment");

            const outcome = await db.$transaction(async (tx) => {
                const fin = await finalizeCapturedPayment(tx, {
                    paymentId: payment.id, gatewayPaymentId: event.gatewayPaymentId!, method: event.method,
                    rawPayload: JSON.parse(rawBody), webhookEventId: row.id,
                });
                if (fin.result === "finalized" || fin.result === "already") {
                    await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id, bookingId: fin.bookingId } });
                    return "ok" as const;
                }
                await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "FAILED", error: fin.result } });
                return "fail" as const;
            });
            return outcome === "fail" ? { httpStatus: 500, result: "error", detail: "finalize failed" } : { httpStatus: 200, result: "processed" };
        }

        // ── failed → mark Payment FAILED (booking stays PENDING) ───────────────
        if (event.type === "failed") {
            if (!event.gatewayOrderRef) return ignore("failed without order ref");
            const payment = await db.payment.findUnique({ where: { gatewayOrderId: event.gatewayOrderRef }, select: { id: true, status: true } });
            if (!payment) return ignore("no matching payment");
            await db.$transaction(async (tx) => {
                if (payment.status === "PENDING") {
                    await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: event.failureReason ?? "payment failed", rawResponse: JSON.parse(rawBody), webhookEventId: row.id } });
                }
                await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id } });
            });
            return { httpStatus: 200, result: "processed" };
        }

        // ── refunded → REFUNDED / PARTIALLY_REFUNDED (record-only) ─────────────
        if (event.type === "refunded") {
            if (!event.gatewayPaymentId) return ignore("refund without payment id");
            const payment = await db.payment.findUnique({ where: { gatewayPaymentId: event.gatewayPaymentId }, select: { id: true, bookingId: true, amount_paise: true } });
            if (!payment) return ignore("no matching payment for refund");
            const isPartial = typeof event.refundAmountPaise === "number" && event.refundAmountPaise < payment.amount_paise;
            const status = isPartial ? "PARTIALLY_REFUNDED" : "REFUNDED";
            const refundRupees = typeof event.refundAmountPaise === "number" ? (event.refundAmountPaise / 100).toFixed(2) : undefined;
            await db.$transaction(async (tx) => {
                await tx.payment.update({ where: { id: payment.id }, data: { status, refundId: event.refundId, refundAmount: refundRupees, refundedAt: new Date(), rawResponse: JSON.parse(rawBody), webhookEventId: row.id } });
                await tx.booking.update({ where: { id: payment.bookingId }, data: { paymentStatus: status } });
                await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id, bookingId: payment.bookingId } });
            });
            return { httpStatus: 200, result: "processed" };
        }

        return ignore();
    } catch (e) {
        console.error("[webhook] processing failed", e);
        await db.webhookEvent.update({ where: { id: row.id }, data: { status: "FAILED", error: String(e) } }).catch(() => {});
        return { httpStatus: 500, result: "error" };
    }
}
