/**
 * Phase 7 integration e2e — cancellation refund → reconcile, and date-change TOPUP finalize.
 * Run:  npm run e2e:phase7   (needs DATABASE_URL; stubs PayU fetch; sets own creds)
 * DB-mutating, self-cleaning, NOT part of `npm test`.
 */
import { createHash } from "crypto";
process.env.PAYU_KEY = "testkey";
process.env.PAYU_SALT = "testsalt";
process.env.PAYU_BASE_URL = "https://test.payu.in";

import { db } from "../app/lib/db";
import { cancelBooking } from "../app/actions/payment/cancel-booking.service";
import { reconcileRefunds, type RefundStatusFetcher } from "../app/actions/payment/reconcile.service";
import { processGatewayWebhook } from "../app/actions/payment/webhook.service";

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");
const tag = Date.now();
const failures: string[] = [];
const expect = (n: string, c: boolean) => { if (!c) { failures.push(n); console.error(`  ✗ ${n}`); } };
const cleanup: string[] = [];

async function main() {
    const user = await db.user.findFirst({ select: { id: true } });
    const dest = await db.destinations.findFirst({ select: { id: true } });
    function future(days: number) { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); }

    // ── A. cancel → refund initiated → reconcileRefunds confirms ──
    const MIH = `mih_c_${tag}`;
    const bA = await db.booking.create({
        data: {
            bookingNumber: `T76A-${tag}`, userId: user!.id, destinationId: dest!.id, tripType: "Leisure",
            startDate: future(60), endDate: future(63), duration: 4, travellers: 2,
            totalAmount: "9113.35", totalAmount_paise: 911335, advanceAmount_paise: 911335, balanceAmount_paise: 0,
            paidAmount: "9113.35", currency: "INR", paymentPlan: "FULL", paymentStatus: "FULLY_PAID",
            installments: { create: [{ type: "DEPOSIT", sequence: 0, amount_paise: 911335, status: "PAID" }] },
            payments: { create: [{ userId: user!.id, amount: "9113.35", amount_paise: 911335, gateway: "PAYU", status: "FULLY_PAID", purpose: "INITIAL", gatewayPaymentId: MIH, gatewayOrderId: `txn_c_${tag}`, idempotencyKey: `c76:${tag}` }] },
        },
        select: { id: true },
    });
    cleanup.push(bA.id);

    const origFetch = global.fetch;
    global.fetch = (async () => ({ json: async () => ({ status: 1, request_id: `req_${tag}` }) } as Response)) as typeof fetch;
    try {
        const res = await cancelBooking({ bookingId: bA.id, reason: "test", byUserId: user!.id });
        expect("cancel success 90%", res.success === true && res.success && res.refundablePaise === Math.round(911335 * 0.9));
        const payAfterCancel = await db.payment.findFirst({ where: { gatewayPaymentId: MIH }, select: { refundId: true, status: true } });
        expect("refund initiated (refundId set, not yet REFUNDED)", !!payAfterCancel?.refundId && payAfterCancel.status === "FULLY_PAID");

        // reconcile refunds — gateway says processed
        const stub: RefundStatusFetcher = async () => ({ state: "processed" });
        const sum = await reconcileRefunds({ statusOf: stub });
        expect("reconcile confirmed ≥1", sum.confirmed >= 1);
        const payDone = await db.payment.findFirst({ where: { gatewayPaymentId: MIH }, select: { status: true } });
        const bkDone = await db.booking.findUnique({ where: { id: bA.id }, select: { paymentStatus: true, status: true } });
        expect("payment PARTIALLY_REFUNDED (90% < paid)", payDone?.status === "PARTIALLY_REFUNDED");
        expect("booking paymentStatus PARTIALLY_REFUNDED + CANCELLED", bkDone?.paymentStatus === "PARTIALLY_REFUNDED" && bkDone.status === "CANCELLED");

        // ── B. date-change TOPUP capture via webhook → finalize TOPUP branch ──
        const TXN = `txn_tu_${tag}`, MIHT = `mih_tu_${tag}`;
        const bB = await db.booking.create({
            data: {
                bookingNumber: `T76B-${tag}`, userId: user!.id, destinationId: dest!.id, tripType: "Leisure",
                startDate: future(60), endDate: future(63), duration: 4, travellers: 2,
                totalAmount: "36453.38", totalAmount_paise: 3645338, advanceAmount_paise: 911335, balanceAmount_paise: 2734003,
                paidAmount: "9113.35", balanceDueAmount: "27340.03", currency: "INR", paymentPlan: "DEPOSIT", paymentStatus: "ADVANCE_PAID",
                installments: { create: [{ type: "DEPOSIT", sequence: 0, amount_paise: 911335, status: "PAID" }, { type: "BALANCE", sequence: 1, amount_paise: 2734003, status: "PENDING" }] },
                payments: { create: [
                    { userId: user!.id, amount: "9113.35", amount_paise: 911335, gateway: "PAYU", status: "FULLY_PAID", purpose: "INITIAL", gatewayPaymentId: `mih_i_${tag}`, gatewayOrderId: `txn_i_${tag}`, idempotencyKey: `bi76:${tag}` },
                    { userId: user!.id, amount: "5000.00", amount_paise: 500000, gateway: "PAYU", status: "PENDING", purpose: "TOPUP", gatewayOrderId: TXN, idempotencyKey: `btu76:${tag}` },
                ] },
            },
            select: { id: true },
        });
        cleanup.push(bB.id);
        const f: Record<string, string> = { status: "success", txnid: TXN, amount: "5000.00", productinfo: "Package booking", firstname: "Guest", email: "", mihpayid: MIHT, mode: "UPI", udf1: "", udf2: "", udf3: "", udf4: "", udf5: "" };
        f.hash = sha512(["testsalt", "success", "", "", "", "", "", "", "", "", "", "", "", "Guest", "Package booking", "5000.00", TXN, "testkey"].join("|"));
        const wh = await processGatewayWebhook("PAYU", new URLSearchParams(f).toString(), new Headers());
        expect("topup webhook processed", wh.result === "processed");
        const bkB = await db.booking.findUnique({ where: { id: bB.id }, select: { paidAmount: true, paymentStatus: true } });
        const depB = await db.paymentInstallment.findFirst({ where: { bookingId: bB.id, type: "DEPOSIT" }, select: { status: true } });
        expect("topup → paid 14113.35, ADVANCE_PAID, deposit untouched", Number(bkB?.paidAmount) === 14113.35 && bkB?.paymentStatus === "ADVANCE_PAID" && depB?.status === "PAID");
    } finally {
        global.fetch = origFetch;
    }

    console.log(failures.length === 0 ? "PHASE7_E2E_PASS" : `PHASE7_E2E_FAIL (${failures.length})`);
}

main().catch((e) => { console.error("E2E ERROR", e); failures.push("threw"); }).finally(async () => {
    for (const id of cleanup) { await db.payment.deleteMany({ where: { bookingId: id } }).catch(() => {}); await db.booking.delete({ where: { id } }).catch(() => {}); }
    await db.webhookEvent.deleteMany({ where: { eventId: { contains: `_tu_${tag}` } } }).catch(() => {});
    await db.$disconnect();
    process.exit(failures.length === 0 ? 0 : 1);
});
