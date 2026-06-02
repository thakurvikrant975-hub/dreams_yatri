/**
 * Pure-unit tests for the Razorpay signature verifiers.
 * Run:  npm run test:razorpay
 * Sets its own test secrets (no real keys needed); uses --conditions=react-server
 * so the `server-only` guard in razorpay.ts is a no-op.
 */
import { createHmac } from "crypto";

// razorpay.ts reads secrets lazily (inside the functions), so setting these
// before any verify() call is sufficient — import hoisting is irrelevant here.
process.env.RAZORPAY_KEY_SECRET = "test_key_secret_abc123";
process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret_xyz789";

import { verifyCheckoutSignature, verifyWebhookSignature } from "../app/lib/razorpay";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean) {
    if (cond) passed++;
    else { failures.push(name); console.error(`  ✗ ${name}`); }
}

console.log("Razorpay signatures:");

// ── Checkout signature: HMAC(orderId|paymentId, key_secret) ──
{
    const orderId = "order_ABC123";
    const paymentId = "pay_XYZ789";
    const good = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest("hex");

    check("checkout: valid signature accepted", verifyCheckoutSignature({ orderId, paymentId, signature: good }));
    check("checkout: tampered paymentId rejected", !verifyCheckoutSignature({ orderId, paymentId: "pay_OTHER", signature: good }));
    check("checkout: tampered orderId rejected", !verifyCheckoutSignature({ orderId: "order_OTHER", paymentId, signature: good }));
    check("checkout: garbage signature rejected", !verifyCheckoutSignature({ orderId, paymentId, signature: "zzzz" }));
    check("checkout: empty signature rejected", !verifyCheckoutSignature({ orderId, paymentId, signature: "" }));
    // a different but valid-hex signature of wrong length / value
    const wrong = createHmac("sha256", "different_secret").update(`${orderId}|${paymentId}`).digest("hex");
    check("checkout: wrong-secret signature rejected", !verifyCheckoutSignature({ orderId, paymentId, signature: wrong }));
}

// ── Webhook signature: HMAC(rawBody, webhook_secret) ──
{
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
    const good = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(rawBody).digest("hex");

    check("webhook: valid signature accepted", verifyWebhookSignature(rawBody, good));
    check("webhook: tampered body rejected", !verifyWebhookSignature(rawBody + " ", good));
    check("webhook: empty signature rejected", !verifyWebhookSignature(rawBody, ""));
    check("webhook: garbage signature rejected", !verifyWebhookSignature(rawBody, "nothex!!"));
    const wrong = createHmac("sha256", "different_secret").update(rawBody).digest("hex");
    check("webhook: wrong-secret signature rejected", !verifyWebhookSignature(rawBody, wrong));
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
