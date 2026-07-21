import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * WhatsApp Cloud API (Meta, direct — no BSP). Webhook verification only for now;
 * the send-side client is added once templates exist.
 */

function requireEnv(key: string): string {
    const v = process.env[key];
    if (!v || v.trim() === "") throw new Error(`WhatsApp: ${key} is not configured`);
    return v;
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

/** Meta's verify-token check for the one-time GET subscription handshake. */
export function isValidWebhookVerifyToken(token: string | null): boolean {
    if (!token) return false;
    return token === requireEnv("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
}

/**
 * Verify a webhook delivery: HMAC-SHA256(rawBody, app secret), sent as
 * `X-Hub-Signature-256: sha256=<hex>`. `rawBody` MUST be the exact raw
 * request body (no JSON re-serialization) — same discipline as the Razorpay
 * webhook verifier in app/lib/razorpay.ts.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    if (!signatureHeader) return false;
    const provided = signatureHeader.startsWith("sha256=") ? signatureHeader.slice("sha256=".length) : signatureHeader;
    const expected = createHmac("sha256", requireEnv("WHATSAPP_APP_SECRET")).update(rawBody).digest("hex");
    return safeEqualHex(expected, provided);
}
