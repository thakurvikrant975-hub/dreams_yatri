import "server-only";
import { createHash } from "crypto";
import { rupeesToPaise } from "@/app/lib/money";
import type {
    PaymentProvider,
    CreateChargeInput,
    CreateChargeResult,
    CheckoutInit,
    CallbackResult,
    NormalizedWebhookEvent,
    ChargeStatus,
    RefundResult,
    RefundStatus,
} from "./types";

/**
 * PayU (India) provider — hosted-page form-POST flow.
 *
 * Charge = generate a txnid + SHA-512 request hash, return fields the client
 * auto-submits to PayU's hosted page. PayU returns to surl/furl (and/or webhook)
 * with a **reverse hash** we verify. Recon uses the verify_payment API.
 *
 * Hash field SEQUENCES are PayU's exact pipe-delimited orders, built as explicit
 * arrays (symmetric forward/reverse) — the usual PayU footgun is a wrong pipe
 * count. NOTE: validate against PayU TEST creds before go-live.
 *
 * Money: PayU amount is RUPEES with 2 decimals (e.g. "9113.35"), not paise —
 * convert only at this boundary; paise stays the internal source of truth.
 */

function env(key: string): string {
    const v = process.env[key];
    if (!v || v.trim() === "") throw new Error(`PayU: ${key} is not configured`);
    return v;
}

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");
const rupees = (amountPaise: number) => (amountPaise / 100).toFixed(2);

// Constants used for BOTH createCharge and resume so the hash is reproducible
// from (txnid, amount) alone. (Customer prefill deferred — see Phase 6 notes.)
const PRODUCT_INFO = "Package booking";
const FIRST_NAME = "Guest";
const EMAIL = "";
const UDF = ["", "", "", "", ""]; // udf1..5

/** Request hash: key|txnid|amount|productinfo|firstname|email|udf1..5|||||(5 empty)|salt */
function requestHash(key: string, salt: string, txnid: string, amount: string): string {
    const seq = [key, txnid, amount, PRODUCT_INFO, FIRST_NAME, EMAIL, ...UDF, "", "", "", "", "", salt];
    return sha512(seq.join("|"));
}

/** Reverse hash: salt|status|(5 empty)|udf5..1|email|firstname|productinfo|amount|txnid|key */
function reverseHash(key: string, salt: string, f: { status: string; amount: string; txnid: string; productinfo: string; firstname: string; email: string; udf: string[] }): string {
    const udf = [f.udf[0] ?? "", f.udf[1] ?? "", f.udf[2] ?? "", f.udf[3] ?? "", f.udf[4] ?? ""];
    const seq = [salt, f.status, "", "", "", "", "", udf[4], udf[3], udf[2], udf[1], udf[0], f.email, f.firstname, f.productinfo, f.amount, f.txnid, key];
    return sha512(seq.join("|"));
}

function buildCheckout(txnid: string, amountPaise: number, successUrl: string, failureUrl: string): CheckoutInit {
    const key = env("PAYU_KEY");
    const salt = env("PAYU_SALT");
    const amount = rupees(amountPaise);
    const fields: Record<string, string> = {
        key, txnid, amount, productinfo: PRODUCT_INFO, firstname: FIRST_NAME, email: EMAIL,
        surl: successUrl, furl: failureUrl,
        udf1: "", udf2: "", udf3: "", udf4: "", udf5: "",
        hash: requestHash(key, salt, txnid, amount),
    };
    return { provider: "PAYU", actionUrl: `${env("PAYU_BASE_URL")}/_payment`, fields };
}

function verifyPosted(fields: Record<string, string>): boolean {
    if (!fields.hash || !fields.status || !fields.txnid) return false;
    const expected = reverseHash(env("PAYU_KEY"), env("PAYU_SALT"), {
        status: fields.status, amount: fields.amount ?? "", txnid: fields.txnid,
        productinfo: fields.productinfo ?? "", firstname: fields.firstname ?? "", email: fields.email ?? "",
        udf: [fields.udf1 ?? "", fields.udf2 ?? "", fields.udf3 ?? "", fields.udf4 ?? "", fields.udf5 ?? ""],
    });
    return expected.toLowerCase() === fields.hash.toLowerCase();
}

function formToObject(rawBody: string): Record<string, string> {
    const out: Record<string, string> = {};
    new URLSearchParams(rawBody).forEach((v, k) => { out[k] = v; });
    return out;
}

function normalize(fields: Record<string, string>): NormalizedWebhookEvent {
    const status = (fields.status ?? "").toLowerCase();
    const type = status === "success" ? "captured" : status === "failure" ? "failed" : "other";
    return {
        eventId: fields.mihpayid ?? fields.txnid ?? "",
        type,
        gatewayOrderRef: fields.txnid,
        gatewayPaymentId: fields.mihpayid,
        amountPaise: fields.amount ? rupeesToPaise(fields.amount) : undefined,
        method: fields.mode,
        failureReason: type === "failed" ? fields.error_Message ?? fields.field9 : undefined,
    };
}

export const payuProvider: PaymentProvider = {
    gateway: "PAYU",

    async createCharge(input: CreateChargeInput): Promise<CreateChargeResult> {
        const txnid = `txn${Date.now()}${Math.random().toString(36).slice(2, 6)}`.slice(0, 25);
        const checkout = buildCheckout(txnid, input.amountPaise, input.successUrl ?? "", input.failureUrl ?? "");
        return { gatewayOrderRef: txnid, checkout };
    },

    checkoutForExistingOrder(args): CheckoutInit {
        // surl/furl omitted on resume — the client re-derives them isn't needed; PayU only needs them at submit.
        return buildCheckout(args.gatewayOrderRef, args.amountPaise, "", "");
    },

    verifyCallback(payload: Record<string, string>): CallbackResult {
        const valid = verifyPosted(payload);
        return { valid, gatewayOrderRef: payload.txnid, gatewayPaymentId: payload.mihpayid };
    },

    verifyWebhook(rawBody: string): boolean {
        return verifyPosted(formToObject(rawBody));
    },

    parseWebhookEvent(rawBody: string): NormalizedWebhookEvent | null {
        const fields = formToObject(rawBody);
        if (!fields.txnid && !fields.mihpayid) return null;
        return normalize(fields);
    },

    async fetchChargeStatus(gatewayOrderRef: string): Promise<ChargeStatus> {
        const key = env("PAYU_KEY");
        const salt = env("PAYU_SALT");
        const command = "verify_payment";
        const hash = sha512(`${key}|${command}|${gatewayOrderRef}|${salt}`);
        const body = new URLSearchParams({ key, command, var1: gatewayOrderRef, hash });
        const res = await fetch(`${env("PAYU_BASE_URL")}/merchant/postservice?form=2`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const json = (await res.json()) as { transaction_details?: Record<string, { status?: string; mihpayid?: string; mode?: string }> };
        const detail = json.transaction_details?.[gatewayOrderRef];
        const status = (detail?.status ?? "").toLowerCase();
        if (status === "success" || status === "captured") return { state: "captured", gatewayPaymentId: detail?.mihpayid, method: detail?.mode };
        if (status === "failure" || status === "failed") return { state: "failed" };
        return { state: "pending" };
    },

    async refund(args): Promise<RefundResult> {
        const key = env("PAYU_KEY");
        const salt = env("PAYU_SALT");
        const command = "cancel_refund_transaction";
        const token = `rf${Date.now()}${Math.random().toString(36).slice(2, 6)}`.slice(0, 25);
        // PayU hash for postservice commands: key|command|var1|salt (var1 = mihpayid).
        const hash = sha512(`${key}|${command}|${args.gatewayPaymentId}|${salt}`);
        const body = new URLSearchParams({ key, command, var1: args.gatewayPaymentId, var2: token, var3: rupees(args.amountPaise), hash });
        const res = await fetch(`${env("PAYU_BASE_URL")}/merchant/postservice?form=2`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const json = (await res.json()) as { status?: number; request_id?: string | number; mihpayid?: string };
        // PayU refunds are async (status 1 = request accepted) → pending until the refund webhook confirms.
        const ok = json.status === 1;
        return { refundId: String(json.request_id ?? token), state: ok ? "pending" : "failed", amountPaise: args.amountPaise };
    },

    async fetchRefundStatus(refundId: string): Promise<RefundStatus> {
        const key = env("PAYU_KEY");
        const salt = env("PAYU_SALT");
        const command = "check_action_status";
        const hash = sha512(`${key}|${command}|${refundId}|${salt}`);
        const body = new URLSearchParams({ key, command, var1: refundId, hash });
        const res = await fetch(`${env("PAYU_BASE_URL")}/merchant/postservice?form=2`, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body.toString(),
        });
        const json = (await res.json()) as { transaction_details?: Record<string, { status?: string }> };
        const status = (json.transaction_details?.[refundId]?.status ?? "").toLowerCase();
        if (status.includes("success") || status.includes("refund")) return { state: "processed" };
        if (status.includes("fail")) return { state: "failed" };
        return { state: "pending" };
    },
};
