/**
 * Phase 6 integration e2e — PayU webhook through the provider-driven processor.
 * Run:  npm run e2e:phase6   (needs DATABASE_URL; sets its own PayU test creds)
 * DB-mutating, self-cleaning, NOT part of `npm test`.
 */
import { createHash } from "crypto";
process.env.PAYU_KEY = process.env.PAYU_KEY || "testkey";
process.env.PAYU_SALT = process.env.PAYU_SALT || "testsalt";
process.env.PAYU_BASE_URL = process.env.PAYU_BASE_URL || "https://test.payu.in";

import { db } from "../app/lib/db";
import { processGatewayWebhook } from "../app/actions/payment/webhook.service";

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");
const tag = Date.now();
const TXN = `txn_${tag}`;
const MIH = `mih_${tag}`;
const failures: string[] = [];
const expect = (n: string, c: boolean) => { if (!c) { failures.push(n); console.error(`  ✗ ${n}`); } };
let bookingId: string | null = null;

function payuBody(status: string) {
    const amount = "9113.35";
    const f: Record<string, string> = { status, txnid: TXN, amount, productinfo: "Package booking", firstname: "Guest", email: "", mihpayid: MIH, mode: "UPI", udf1: "", udf2: "", udf3: "", udf4: "", udf5: "" };
    f.hash = sha512([process.env.PAYU_SALT, status, "", "", "", "", "", "", "", "", "", "", "", "Guest", "Package booking", amount, TXN, process.env.PAYU_KEY].join("|"));
    return new URLSearchParams(f).toString();
}

async function main() {
    const user = await db.user.findFirst({ select: { id: true } });
    const dest = await db.destinations.findFirst({ select: { id: true } });
    if (!user || !dest) throw new Error("need a user + destination");

    const b = await db.booking.create({
        data: {
            bookingNumber: `T6-${tag}`, userId: user.id, destinationId: dest.id, tripType: "Leisure",
            startDate: new Date("2026-09-30"), endDate: new Date("2026-10-03"), duration: 4, travellers: 2,
            totalAmount: "36453.38", totalAmount_paise: 3645338, advanceAmount_paise: 911335, balanceAmount_paise: 2734003,
            currency: "INR", paymentPlan: "DEPOSIT", paymentStatus: "PENDING",
            installments: { create: [{ type: "DEPOSIT", sequence: 0, amount_paise: 911335, status: "PENDING" }, { type: "BALANCE", sequence: 1, amount_paise: 2734003, status: "PENDING" }] },
            payments: { create: [{ userId: user.id, amount: "9113.35", amount_paise: 911335, gateway: "PAYU", status: "PENDING", gatewayOrderId: TXN, idempotencyKey: `p6:${tag}` }] },
        },
        select: { id: true },
    });
    bookingId = b.id;

    const body = payuBody("success");
    const bad = await processGatewayWebhook("PAYU", new URLSearchParams({ status: "success", txnid: TXN, hash: "deadbeef" }).toString(), new Headers());
    expect("bad hash → invalid_signature", bad.result === "invalid_signature");
    const first = await processGatewayWebhook("PAYU", body, new Headers());
    expect("payu captured → processed", first.result === "processed");
    const dup = await processGatewayWebhook("PAYU", body, new Headers());
    expect("payu duplicate → duplicate", dup.result === "duplicate");

    const pay = await db.payment.findFirst({ where: { gatewayOrderId: TXN }, select: { status: true, gatewayPaymentId: true, method: true } });
    const bk = await db.booking.findUnique({ where: { id: b.id }, select: { paymentStatus: true, paidAmount: true } });
    const dep = await db.paymentInstallment.findFirst({ where: { bookingId: b.id, type: "DEPOSIT" }, select: { status: true } });
    const evCount = await db.webhookEvent.count({ where: { gateway: "PAYU", eventId: MIH } });

    expect("payment FULLY_PAID + mihpayid + UPI", pay?.status === "FULLY_PAID" && pay.gatewayPaymentId === MIH && pay.method === "UPI");
    expect("booking ADVANCE_PAID 9113.35", bk?.paymentStatus === "ADVANCE_PAID" && bk.paidAmount.toString() === "9113.35");
    expect("deposit installment PAID", dep?.status === "PAID");
    expect("one webhook event row", evCount === 1);

    console.log(failures.length === 0 ? "PHASE6_E2E_PASS" : `PHASE6_E2E_FAIL (${failures.length})`);
}

main().catch((e) => { console.error("E2E ERROR", e); failures.push("threw"); }).finally(async () => {
    if (bookingId) { await db.payment.deleteMany({ where: { bookingId } }).catch(() => {}); await db.booking.delete({ where: { id: bookingId } }).catch(() => {}); }
    await db.webhookEvent.deleteMany({ where: { gateway: "PAYU", eventId: MIH } }).catch(() => {});
    await db.$disconnect();
    process.exit(failures.length === 0 ? 0 : 1);
});
