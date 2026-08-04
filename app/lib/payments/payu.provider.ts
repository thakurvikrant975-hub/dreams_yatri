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

function envOr(key: string, fallback: string): string {
    const v = process.env[key];
    return v && v.trim() !== "" ? v : fallback;
}

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");
const rupees = (amountPaise: number) => (amountPaise / 100).toFixed(2);

/**
 * PayU serves the hosted checkout and the postservice API from DIFFERENT hosts in
 * production — a split that test mode hides, since test.payu.in serves both:
 *
 *            checkout (`/_payment`)   postservice API
 *   test     test.payu.in             test.payu.in
 *   prod     secure.payu.in           info.payu.in
 *
 * So PAYU_API_URL exists separately from PAYU_BASE_URL, and falls back to it when
 * unset (test setups still need only the one var). Note `.php` in the path: test
 * tolerates its absence, production is documented with it.
 */
const checkoutUrl = () => `${env("PAYU_BASE_URL")}/_payment`;
const postserviceUrl = () => `${envOr("PAYU_API_URL", env("PAYU_BASE_URL"))}/merchant/postservice.php?form=2`;

/** POST a postservice command. Hash is always key|command|var1|salt. */
async function postservice<T>(command: string, vars: { var1: string; var2?: string; var3?: string }): Promise<T> {
    const key = env("PAYU_KEY");
    const salt = env("PAYU_SALT");
    const body = new URLSearchParams({ key, command, var1: vars.var1, hash: sha512(`${key}|${command}|${vars.var1}|${salt}`) });
    if (vars.var2 !== undefined) body.set("var2", vars.var2);
    if (vars.var3 !== undefined) body.set("var3", vars.var3);
    const res = await fetch(postserviceUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    return (await res.json()) as T;
}

const PRODUCT_INFO = "Package booking";
const UDF = ["", "", "", "", ""]; // udf1..5

/**
 * PayU's `_payment` API rejects a request outright when firstname, email or phone
 * is missing or blank ("Mandatory Parameter <x> is missing"), so every charge must
 * carry all three. These fallbacks exist only so a booking with no contact details
 * on file still reaches the hosted page rather than erroring at the gateway — real
 * values are threaded through from the Booking's contact fields by the caller.
 *
 * They also feed the request hash, so createCharge and any later resume of the same
 * txnid must derive them identically — hence one resolver used by both paths.
 */
function resolveCustomer(c?: { name?: string; email?: string; phone?: string }) {
    const firstname = (c?.name ?? "").trim().split(/\s+/)[0] || "Guest";
    const email = (c?.email ?? "").trim() || "noreply@dreamsyatri.com";
    // PayU validates this as a 10-digit Indian mobile; strip +91/spaces/dashes and
    // fall back rather than posting something it will reject.
    const digits = (c?.phone ?? "").replace(/\D/g, "").slice(-10);
    const phone = digits.length === 10 ? digits : "9999999999";
    return { firstname, email, phone };
}

/** Request hash: key|txnid|amount|productinfo|firstname|email|udf1..5|||||(5 empty)|salt */
function requestHash(key: string, salt: string, txnid: string, amount: string, firstname: string, email: string): string {
    const seq = [key, txnid, amount, PRODUCT_INFO, firstname, email, ...UDF, "", "", "", "", "", salt];
    return sha512(seq.join("|"));
}

/** Reverse hash: salt|status|(5 empty)|udf5..1|email|firstname|productinfo|amount|txnid|key */
function reverseHash(key: string, salt: string, f: { status: string; amount: string; txnid: string; productinfo: string; firstname: string; email: string; udf: string[] }): string {
    const udf = [f.udf[0] ?? "", f.udf[1] ?? "", f.udf[2] ?? "", f.udf[3] ?? "", f.udf[4] ?? ""];
    const seq = [salt, f.status, "", "", "", "", "", udf[4], udf[3], udf[2], udf[1], udf[0], f.email, f.firstname, f.productinfo, f.amount, f.txnid, key];
    return sha512(seq.join("|"));
}

function buildCheckout(
    txnid: string,
    amountPaise: number,
    successUrl: string,
    failureUrl: string,
    customer?: { name?: string; email?: string; phone?: string },
): CheckoutInit {
    const key = env("PAYU_KEY");
    const salt = env("PAYU_SALT");
    const amount = rupees(amountPaise);
    const { firstname, email, phone } = resolveCustomer(customer);
    const fields: Record<string, string> = {
        key, txnid, amount, productinfo: PRODUCT_INFO, firstname, email, phone,
        surl: successUrl, furl: failureUrl,
        udf1: "", udf2: "", udf3: "", udf4: "", udf5: "",
        hash: requestHash(key, salt, txnid, amount, firstname, email),
    };
    return { provider: "PAYU", actionUrl: checkoutUrl(), fields };
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
        const checkout = buildCheckout(txnid, input.amountPaise, input.successUrl ?? "", input.failureUrl ?? "", input.customer);
        return { gatewayOrderRef: txnid, checkout };
    },

    checkoutForExistingOrder(args): CheckoutInit {
        // surl/furl are form fields (not part of the hash), so a resumed payment must
        // carry them too — omit them and PayU falls back to its dashboard-configured
        // return URL, stranding the customer away from our confirmation page. The
        // customer identity fields are mandatory on every POST for the same reason.
        return buildCheckout(args.gatewayOrderRef, args.amountPaise, args.successUrl ?? "", args.failureUrl ?? "", args.customer);
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
        const json = await postservice<{ transaction_details?: Record<string, { status?: string; mihpayid?: string; mode?: string }> }>(
            "verify_payment",
            { var1: gatewayOrderRef },
        );
        const detail = json.transaction_details?.[gatewayOrderRef];
        const status = (detail?.status ?? "").toLowerCase();
        if (status === "success" || status === "captured") return { state: "captured", gatewayPaymentId: detail?.mihpayid, method: detail?.mode };
        if (status === "failure" || status === "failed") return { state: "failed" };
        return { state: "pending" };
    },

    async refund(args): Promise<RefundResult> {
        const token = `rf${Date.now()}${Math.random().toString(36).slice(2, 6)}`.slice(0, 25);
        // var1 = mihpayid, var2 = our refund token, var3 = amount in rupees.
        const json = await postservice<{ status?: number; request_id?: string | number; mihpayid?: string }>(
            "cancel_refund_transaction",
            { var1: args.gatewayPaymentId, var2: token, var3: rupees(args.amountPaise) },
        );
        // PayU refunds are async (status 1 = request accepted) → pending until the refund webhook confirms.
        const ok = json.status === 1;
        return { refundId: String(json.request_id ?? token), state: ok ? "pending" : "failed", amountPaise: args.amountPaise };
    },

    async fetchRefundStatus(refundId: string): Promise<RefundStatus> {
        const json = await postservice<{ transaction_details?: Record<string, { status?: string }> }>(
            "check_action_status",
            { var1: refundId },
        );
        const status = (json.transaction_details?.[refundId]?.status ?? "").toLowerCase();
        if (status.includes("success") || status.includes("refund")) return { state: "processed" };
        if (status.includes("fail")) return { state: "failed" };
        return { state: "pending" };
    },
};
