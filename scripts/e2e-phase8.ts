/**
 * Phase 8 integration e2e — capture → booking confirmed + ops handoff timeline.
 * Run:  npm run e2e:phase8   (needs DATABASE_URL; stubs PayU; emails stay gated off)
 * DB-mutating, self-cleaning, NOT part of `npm test`.
 */
import { createHash } from "crypto";
process.env.PAYU_KEY = "testkey";
process.env.PAYU_SALT = "testsalt";
process.env.PAYU_BASE_URL = "https://test.payu.in";

import { db } from "../app/lib/db";
import { processGatewayWebhook } from "../app/actions/payment/webhook.service";

const sha512 = (s: string) => createHash("sha512").update(s).digest("hex");
const tag = Date.now();
const TXN = `txn_8_${tag}`, MIH = `mih_8_${tag}`;
const failures: string[] = [];
const expect = (n: string, c: boolean) => { if (!c) { failures.push(n); console.error(`  ✗ ${n}`); } };
let bookingId: string | null = null;

async function main() {
    const user = await db.user.findFirst({ select: { id: true } });
    const dest = await db.destinations.findFirst({ select: { id: true } });
    const b = await db.booking.create({
        data: {
            bookingNumber: `T8-${tag}`, userId: user!.id, destinationId: dest!.id, tripType: "Leisure",
            startDate: new Date("2026-09-30"), endDate: new Date("2026-10-03"), duration: 4, travellers: 2,
            totalAmount: "36453.38", totalAmount_paise: 3645338, advanceAmount_paise: 911335, balanceAmount_paise: 2734003,
            currency: "INR", paymentPlan: "DEPOSIT", paymentStatus: "PENDING",
            installments: { create: [{ type: "DEPOSIT", sequence: 0, amount_paise: 911335, status: "PENDING" }, { type: "BALANCE", sequence: 1, amount_paise: 2734003, status: "PENDING" }] },
            payments: { create: [{ userId: user!.id, amount: "9113.35", amount_paise: 911335, gateway: "PAYU", status: "PENDING", purpose: "INITIAL", gatewayOrderId: TXN, idempotencyKey: `p8:${tag}` }] },
        },
        select: { id: true },
    });
    bookingId = b.id;

    const f: Record<string, string> = { status: "success", txnid: TXN, amount: "9113.35", productinfo: "Package booking", firstname: "Guest", email: "", mihpayid: MIH, mode: "UPI", udf1: "", udf2: "", udf3: "", udf4: "", udf5: "" };
    f.hash = sha512(["testsalt", "success", "", "", "", "", "", "", "", "", "", "", "", "Guest", "Package booking", "9113.35", TXN, "testkey"].join("|"));
    const wh = await processGatewayWebhook("PAYU", new URLSearchParams(f).toString(), new Headers());
    expect("capture processed", wh.result === "processed");

    const bk = await db.booking.findUnique({ where: { id: b.id }, select: { paymentStatus: true } });
    const tl = await db.bookingTimeline.findFirst({ where: { bookingId: b.id, action: "NOTE_ADDED" }, select: { performedByName: true, note: true } });
    const sys = await db.teamMember.findUnique({ where: { email: "system@dreamsyatri.internal" }, select: { id: true } });

    expect("booking confirmed (ADVANCE_PAID)", bk?.paymentStatus === "ADVANCE_PAID");
    expect("System actor seeded", !!sys);
    expect("ops handoff timeline NOTE_ADDED by System", tl?.performedByName === "System" && !!tl?.note?.includes("Payment received"));

    console.log(failures.length === 0 ? "PHASE8_E2E_PASS" : `PHASE8_E2E_FAIL (${failures.length})`);
}

main().catch((e) => { console.error("E2E ERROR", e); failures.push("threw"); }).finally(async () => {
    if (bookingId) { await db.payment.deleteMany({ where: { bookingId } }).catch(() => {}); await db.booking.delete({ where: { id: bookingId } }).catch(() => {}); }
    await db.webhookEvent.deleteMany({ where: { eventId: MIH } }).catch(() => {});
    await db.$disconnect();
    process.exit(failures.length === 0 ? 0 : 1);
});
