/**
 * Pure-unit tests for the PaymentProvider layer (registry + Razorpay + PayU).
 * Run:  npm run test:payments   (no DB; sets its own test secrets)
 */
import { createHash } from "crypto";

process.env.RAZORPAY_KEY_SECRET = "rzp_key_secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "rzp_wh_secret";
process.env.PAYU_KEY = "testkey";
process.env.PAYU_SALT = "testsalt";
process.env.PAYU_BASE_URL = "https://test.payu.in";

import { getProvider, activeGateway } from "../app/lib/payments/registry";
import { mapRzpRefundStatus } from "../app/lib/payments/razorpay.provider";

import { createHmac } from "crypto";
const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");
const hmac256 = (secret: string, s: string) => createHmac("sha256", secret).update(s).digest("hex");

let passed = 0;
const failures: string[] = [];
const check = (n: string, c: boolean) => { if (c) passed++; else { failures.push(n); console.error(`  ✗ ${n}`); } };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };

console.log("Payments providers:");

// ── Registry ──
check("getProvider RAZORPAY", getProvider("RAZORPAY").gateway === "RAZORPAY");
check("getProvider PAYU", getProvider("PAYU").gateway === "PAYU");
check("getProvider unknown throws", throws(() => getProvider("NOPE")));
check("activeGateway default RAZORPAY", activeGateway() === "RAZORPAY");

// ── Razorpay provider ──
{
    const p = getProvider("RAZORPAY");
    const capBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", method: "upi", amount: 911335 } } } });
    const h = new Headers({ "x-razorpay-signature": hmac256("rzp_wh_secret", capBody), "x-razorpay-event-id": "evt_cap" });
    check("rzp verifyWebhook good", p.verifyWebhook(capBody, h));
    check("rzp verifyWebhook bad", !p.verifyWebhook(capBody, new Headers({ "x-razorpay-signature": "x" })));
    const cap = p.parseWebhookEvent(capBody, h);
    check("rzp captured normalized", !!cap && cap.type === "captured" && cap.gatewayOrderRef === "order_1" && cap.gatewayPaymentId === "pay_1" && cap.amountPaise === 911335 && cap.eventId === "evt_cap");
    const refBody = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_1", payment_id: "pay_3", amount: 5000 } } } });
    const ref = p.parseWebhookEvent(refBody, new Headers({ "x-razorpay-event-id": "evt_r" }));
    check("rzp refund normalized", !!ref && ref.type === "refunded" && ref.gatewayPaymentId === "pay_3" && ref.refundId === "rfnd_1" && ref.refundAmountPaise === 5000);
    const cbSig = hmac256("rzp_key_secret", "order_1|pay_1");
    check("rzp verifyCallback valid", p.verifyCallback({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: cbSig }).valid);
    check("rzp verifyCallback bad", !p.verifyCallback({ razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "x" }).valid);
}

// ── PayU provider ──
async function payu() {
    const p = getProvider("PAYU");
    const charge = await p.createCharge({ amountPaise: 911335, receipt: "DY-1", bookingId: "b1", customer: {}, successUrl: "https://x/s", failureUrl: "https://x/f" });
    if (charge.checkout.provider !== "PAYU") throw new Error("not payu");
    const f = charge.checkout.fields, txnid = charge.gatewayOrderRef;
    check("payu amount rupees", f.amount === "9113.35");
    const fwd = sha512(["testkey", txnid, "9113.35", "Package booking", "Guest", "", "", "", "", "", "", "", "", "", "", "", "testsalt"].join("|"));
    check("payu forward hash matches", f.hash === fwd);
    check("payu resume hash identical", p.checkoutForExistingOrder({ gatewayOrderRef: txnid, amountPaise: 911335 }).provider === "PAYU" && (p.checkoutForExistingOrder({ gatewayOrderRef: txnid, amountPaise: 911335 }) as { fields: Record<string, string> }).fields.hash === f.hash);
    const rev = sha512(["testsalt", "success", "", "", "", "", "", "", "", "", "", "", "", "Guest", "Package booking", "9113.35", txnid, "testkey"].join("|"));
    const payload: Record<string, string> = { status: "success", txnid, amount: "9113.35", productinfo: "Package booking", firstname: "Guest", email: "", mihpayid: "mih_1", mode: "UPI", udf1: "", udf2: "", udf3: "", udf4: "", udf5: "", hash: rev };
    check("payu verifyCallback valid", p.verifyCallback(payload).valid);
    check("payu verifyCallback tampered amount", !p.verifyCallback({ ...payload, amount: "1.00" }).valid);
    const body = new URLSearchParams(payload).toString();
    check("payu verifyWebhook good", p.verifyWebhook(body, new Headers()));
    const ev = p.parseWebhookEvent(body, new Headers());
    check("payu captured normalized", !!ev && ev.type === "captured" && ev.gatewayOrderRef === txnid && ev.gatewayPaymentId === "mih_1" && ev.amountPaise === 911335);
    const fev = p.parseWebhookEvent(new URLSearchParams({ ...payload, status: "failure" }).toString(), new Headers());
    check("payu failure normalized", !!fev && fev.type === "failed");

    // ── refund via stubbed fetch ──
    const origFetch = global.fetch;
    let captured: { body: string } | null = null;
    let resp: unknown = { status: 1, request_id: "req_123" };
    global.fetch = (async (_url: string, init: { body: string }) => {
        captured = { body: init.body };
        return { json: async () => resp } as Response;
    }) as typeof fetch;
    try {
        const rf = await p.refund({ gatewayPaymentId: "mih_1", amountPaise: 911335 });
        check("payu refund pending + request_id", rf.state === "pending" && rf.refundId === "req_123" && rf.amountPaise === 911335);
        const params = new URLSearchParams(captured!.body);
        check("payu refund request shape", params.get("command") === "cancel_refund_transaction" && params.get("var1") === "mih_1" && params.get("var3") === "9113.35");
        check("payu refund hash", params.get("hash") === sha512("testkey|cancel_refund_transaction|mih_1|testsalt"));
        resp = { status: 0 };
        check("payu refund failed", (await p.refund({ gatewayPaymentId: "mih_1", amountPaise: 100 })).state === "failed");
        resp = { transaction_details: { req_123: { status: "Refund Successful" } } };
        check("payu refund status processed", (await p.fetchRefundStatus("req_123")).state === "processed");
    } finally {
        global.fetch = origFetch;
    }
}

// ── Razorpay refund status mapper ──
check("rzp refund map processed", mapRzpRefundStatus("processed") === "processed");
check("rzp refund map failed", mapRzpRefundStatus("failed") === "failed");
check("rzp refund map pending", mapRzpRefundStatus("created") === "pending");

payu().then(() => {
    console.log(`\n${passed} passed, ${failures.length} failed`);
    process.exit(failures.length === 0 ? 0 : 1);
});
