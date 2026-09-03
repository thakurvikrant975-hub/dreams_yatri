import "server-only";
import { db } from "@/app/lib/db";
import { getProvider } from "@/app/lib/payments/registry";
import type { GatewayId } from "@/app/lib/payments/types";
import { finalizeCapturedPayment } from "./finalize.service";
import { runPaymentConfirmedEffects } from "./confirmation-effects";
import { notifyRefund } from "@/app/services/notifications/booking-notify";

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

/** Store the body as JSON object whether it's JSON (Razorpay) or form-urlencoded (PayU). */
function parsePayload(raw: string): object {
    try {
        return JSON.parse(raw);
    } catch {
        const o: Record<string, string> = {};
        new URLSearchParams(raw).forEach((v, k) => { o[k] = v; });
        return o;
    }
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

    const payloadObj = parsePayload(rawBody);

    // ── Dedupe: find-or-create the event row (PROCESSED ⇒ no-op) ───────────────
    let eventRow = await db.webhookEvent.findUnique({
        where: { gateway_eventId: { gateway, eventId: event.eventId } },
    });
    if (eventRow?.status === "PROCESSED") return { httpStatus: 200, result: "duplicate" };
    if (!eventRow) {
        try {
            eventRow = await db.webhookEvent.create({
                data: { gateway, eventId: event.eventId, eventType: event.type, payload: payloadObj },
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
            const payment = await db.payment.findUnique({ where: { gatewayOrderId: event.gatewayOrderRef }, select: { id: true, amount_paise: true } });
            if (!payment) return ignore("no matching payment");

            // A valid signature proves the message really came from the gateway —
            // NOT that it captured the amount we asked for. Without this check a
            // short capture (or a charge raised against a since-changed booking)
            // would still flip the booking to paid in full. Refuse to finalize and
            // leave the payment PENDING for manual review instead.
            if (typeof event.amountPaise === "number" && event.amountPaise !== payment.amount_paise) {
                console.error(
                    `[webhook] AMOUNT MISMATCH gateway=${gateway} order=${event.gatewayOrderRef} ` +
                    `captured=${event.amountPaise} expected=${payment.amount_paise} — not finalizing`,
                );
                return ignore(`amount mismatch: captured ${event.amountPaise} != expected ${payment.amount_paise}`);
            }

            const outcome = await db.$transaction(async (tx) => {
                const fin = await finalizeCapturedPayment(tx, {
                    paymentId: payment.id, gatewayPaymentId: event.gatewayPaymentId!, method: event.method,
                    rawPayload: payloadObj, webhookEventId: row.id,
                });
                if (fin.result === "finalized" || fin.result === "already") {
                    await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id, bookingId: fin.bookingId } });
                    // Only a genuinely NEW capture (never a duplicate/"already" redelivery)
                    // should trigger notifications — confirmInitial gates the booking-
                    // confirmed email, isNewCapture gates the payment invoice, which
                    // fires on every purpose (INITIAL/TOPUP/BALANCE), not just the first.
                    return {
                        status: "ok" as const,
                        confirmInitial: fin.result === "finalized" && fin.purpose === "INITIAL",
                        isNewCapture: fin.result === "finalized",
                        bookingId: fin.result === "finalized" ? fin.bookingId : undefined,
                    };
                }
                await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "FAILED", error: fin.result } });
                return { status: "fail" as const };
            });
            if (outcome.status === "fail") return { httpStatus: 500, result: "error", detail: "finalize failed" };
            // Shared with reconcile — see runPaymentConfirmedEffects for why
            // these no longer live inline here.
            await runPaymentConfirmedEffects({
                confirmInitial: outcome.confirmInitial,
                isNewCapture: outcome.isNewCapture,
                bookingId: outcome.bookingId,
                paymentId: payment.id,
            });
            return { httpStatus: 200, result: "processed" };
        }

        // ── failed → mark Payment FAILED (booking stays PENDING) ───────────────
        if (event.type === "failed") {
            if (!event.gatewayOrderRef) return ignore("failed without order ref");
            const payment = await db.payment.findUnique({ where: { gatewayOrderId: event.gatewayOrderRef }, select: { id: true, status: true } });
            if (!payment) return ignore("no matching payment");
            await db.$transaction(async (tx) => {
                if (payment.status === "PENDING") {
                    await tx.payment.update({ where: { id: payment.id }, data: { status: "FAILED", failureReason: event.failureReason ?? "payment failed", rawResponse: payloadObj, webhookEventId: row.id } });
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
                await tx.payment.update({ where: { id: payment.id }, data: { status, refundId: event.refundId, refundAmount: refundRupees, refundedAt: new Date(), rawResponse: payloadObj, webhookEventId: row.id } });
                await tx.booking.update({ where: { id: payment.bookingId }, data: { paymentStatus: status } });
                await tx.webhookEvent.update({ where: { id: row.id }, data: { status: "PROCESSED", processedAt: new Date(), paymentId: payment.id, bookingId: payment.bookingId } });
            });
            try { await notifyRefund(payment.bookingId, event.refundAmountPaise ?? payment.amount_paise); } catch (e) { console.error("[webhook] refund-email failed", e); }
            return { httpStatus: 200, result: "processed" };
        }

        return ignore();
    } catch (e) {
        console.error("[webhook] processing failed", e);
        await db.webhookEvent.update({ where: { id: row.id }, data: { status: "FAILED", error: String(e) } }).catch(() => {});
        return { httpStatus: 500, result: "error" };
    }
}
