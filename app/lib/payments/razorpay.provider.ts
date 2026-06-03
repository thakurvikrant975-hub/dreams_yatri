import "server-only";
import {
    createRazorpayOrder,
    verifyCheckoutSignature,
    verifyWebhookSignature,
    fetchOrderPayments,
    razorpayKeyId,
} from "@/app/lib/razorpay";
import type {
    PaymentProvider,
    CreateChargeInput,
    CreateChargeResult,
    CallbackResult,
    NormalizedWebhookEvent,
    ChargeStatus,
} from "./types";

/**
 * Razorpay provider — a thin adapter over the existing `razorpay.ts` client that
 * speaks the gateway-agnostic `PaymentProvider` contract. Behavior must match
 * Phase 4/5 exactly (e2e:phase4/5 stay green).
 */

type RzpBody = {
    event?: string;
    payload?: {
        payment?: { entity?: { id?: string; order_id?: string; method?: string; error_description?: string; error_reason?: string; amount?: number; amount_refunded?: number } };
        refund?: { entity?: { id?: string; payment_id?: string; amount?: number } };
    };
};

export const razorpayProvider: PaymentProvider = {
    gateway: "RAZORPAY",

    async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
        const order = await createRazorpayOrder({
            amountPaise: input.amountPaise,
            receipt: input.receipt,
            notes: input.notes,
        });
        return {
            gatewayOrderRef: order.orderId,
            checkout: { provider: "RAZORPAY", orderId: order.orderId, keyId: razorpayKeyId(), amountPaise: order.amountPaise, currency: order.currency },
        };
    },

    verifyCallback(payload: Record<string, string>): CallbackResult {
        const orderId = payload.razorpay_order_id;
        const paymentId = payload.razorpay_payment_id;
        const signature = payload.razorpay_signature;
        if (!orderId || !paymentId || !signature) return { valid: false };
        const valid = verifyCheckoutSignature({ orderId, paymentId, signature });
        return { valid, gatewayOrderRef: orderId, gatewayPaymentId: paymentId };
    },

    verifyWebhook(rawBody: string, headers: Headers): boolean {
        return verifyWebhookSignature(rawBody, headers.get("x-razorpay-signature") ?? "");
    },

    parseWebhookEvent(rawBody: string, headers: Headers): NormalizedWebhookEvent | null {
        let body: RzpBody;
        try { body = JSON.parse(rawBody); } catch { return null; }

        const eventType = body.event ?? "unknown";
        const pay = body.payload?.payment?.entity;
        const ref = body.payload?.refund?.entity;
        const eventId = headers.get("x-razorpay-event-id") ?? `${eventType}:${pay?.id ?? ref?.id ?? rawBody.length}`;

        if (eventType === "payment.captured") {
            return { eventId, type: "captured", gatewayOrderRef: pay?.order_id, gatewayPaymentId: pay?.id, amountPaise: pay?.amount, method: pay?.method };
        }
        if (eventType === "payment.failed") {
            return { eventId, type: "failed", gatewayOrderRef: pay?.order_id, gatewayPaymentId: pay?.id, failureReason: pay?.error_description ?? pay?.error_reason };
        }
        if (eventType === "refund.processed" || eventType === "refund.created" || eventType === "payment.refunded") {
            return { eventId, type: "refunded", gatewayPaymentId: ref?.payment_id ?? pay?.id, refundId: ref?.id, refundAmountPaise: ref?.amount ?? pay?.amount_refunded };
        }
        return { eventId, type: "other" };
    },

    async fetchChargeStatus(gatewayOrderRef: string): Promise<ChargeStatus> {
        const attempts = await fetchOrderPayments(gatewayOrderRef);
        const captured = attempts.find((a) => a.status === "captured");
        if (captured) return { state: "captured", gatewayPaymentId: captured.id, method: captured.method };
        if (attempts.length > 0 && attempts.every((a) => a.status === "failed")) return { state: "failed" };
        return { state: "pending" };
    },
};
