import "server-only";
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "crypto";
import { assertIntPaise } from "./money";

/**
 * Razorpay client wrapper (server-only).
 *
 * Order creation goes through the official SDK; signature verification uses Node
 * crypto (HMAC-SHA256, timing-safe). Secrets are read lazily inside each call —
 * never at import — so the app boots without keys and only the payment paths
 * fail if they're missing. Razorpay amounts are in paise, matching our money discipline.
 */

function requireEnv(key: string): string {
    const v = process.env[key];
    if (!v || v.trim() === "") throw new Error(`Razorpay: ${key} is not configured`);
    return v;
}

let client: Razorpay | null = null;
function getClient(): Razorpay {
    if (!client) {
        client = new Razorpay({ key_id: requireEnv("RAZORPAY_KEY_ID"), key_secret: requireEnv("RAZORPAY_KEY_SECRET") });
    }
    return client;
}

/** The public (client-side) key id for the checkout widget. */
export function razorpayKeyId(): string {
    return requireEnv("NEXT_PUBLIC_RAZORPAY_KEY_ID");
}

export interface CreateOrderInput {
    amountPaise: number;
    receipt: string;
    notes?: Record<string, string>;
}

export interface RazorpayOrder {
    orderId: string;
    amountPaise: number;
    currency: string;
}

/** Create a Razorpay order for `amountPaise` (INR). */
export async function createRazorpayOrder(input: CreateOrderInput): Promise<RazorpayOrder> {
    assertIntPaise(input.amountPaise);
    if (input.amountPaise <= 0) throw new Error("Razorpay: order amount must be positive");

    const order = await getClient().orders.create({
        amount: input.amountPaise,
        currency: "INR",
        receipt: input.receipt,
        notes: input.notes,
    });

    return { orderId: order.id, amountPaise: Number(order.amount), currency: order.currency };
}

// ── Signature verification ───────────────────────────────────────────────────

function hmacHex(secret: string, payload: string): string {
    return createHmac("sha256", secret).update(payload).digest("hex");
}

function safeEqualHex(expectedHex: string, providedHex: string): boolean {
    const expected = Buffer.from(expectedHex, "hex");
    let provided: Buffer;
    try {
        provided = Buffer.from(providedHex ?? "", "hex");
    } catch {
        return false;
    }
    if (expected.length === 0 || expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
}

/**
 * Verify the browser checkout signature: HMAC-SHA256(`<orderId>|<paymentId>`,
 * key_secret). Defense-in-depth — the webhook remains the source of truth.
 */
export function verifyCheckoutSignature(input: { orderId: string; paymentId: string; signature: string }): boolean {
    const expected = hmacHex(requireEnv("RAZORPAY_KEY_SECRET"), `${input.orderId}|${input.paymentId}`);
    return safeEqualHex(expected, input.signature);
}

/**
 * Verify a webhook delivery: HMAC-SHA256(rawBody, webhook_secret). `rawBody`
 * MUST be the exact raw request body (no JSON re-serialization).
 */
export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const expected = hmacHex(requireEnv("RAZORPAY_WEBHOOK_SECRET"), rawBody);
    return safeEqualHex(expected, signature);
}

// ── Fetch (for reconciliation) ───────────────────────────────────────────────

export interface RazorpayPaymentLite {
    id: string;
    status: string; // created | authorized | captured | refunded | failed
    method?: string;
    amount?: number; // paise
}

/** Fetch all payment attempts on an order — used by reconciliation to learn the true status. */
export async function fetchOrderPayments(orderId: string): Promise<RazorpayPaymentLite[]> {
    const res = (await getClient().orders.fetchPayments(orderId)) as unknown as {
        items?: Array<{ id: string; status: string; method?: string; amount?: number | string }>;
    };
    return (res.items ?? []).map((p) => ({ id: p.id, status: p.status, method: p.method, amount: Number(p.amount) }));
}
