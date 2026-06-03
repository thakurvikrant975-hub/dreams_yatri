/**
 * Phase 4 integration e2e — authoritative Razorpay webhook, self-signed.
 * Run:  npm run e2e:phase4   (needs DATABASE_URL; sets its own webhook secret)
 *
 * Seeds a DEPOSIT booking + PENDING payment, then drives processRazorpayWebhook:
 * bad signature → 400; valid capture → processed (Payment/Booking/installment
 * transitions); duplicate delivery → no reprocess. Cleans up after itself.
 * DB-mutating, so it is NOT part of `npm test`.
 */
import { createHmac } from "crypto";

process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test_wh_secret_e2e";

import { db } from "../app/lib/db";
import { processGatewayWebhook } from "../app/actions/payment/webhook.service";

const rzpHeaders = (sig: string, eventId: string) => new Headers({ "x-razorpay-signature": sig, "x-razorpay-event-id": eventId });

const tag = Date.now();
const ORDER_ID = `order_E2E_${tag}`;
const PAYMENT_ID = `pay_E2E_${tag}`;
const EVENT_ID = `evt_E2E_${tag}`;

const sign = (body: string) => createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest("hex");

let bookingId: string | null = null;
const failures: string[] = [];
const expect = (name: string, cond: boolean) => { if (!cond) { failures.push(name); console.error(`  ✗ ${name}`); } };

async function main() {
    const user = await db.user.findFirst({ select: { id: true } });
    const dest = await db.destinations.findFirst({ select: { id: true } });
    if (!user || !dest) throw new Error("need a user + destination to seed a booking");

    const booking = await db.booking.create({
        data: {
            bookingNumber: `TEST-WH-${tag}`,
            userId: user.id,
            destinationId: dest.id,
            tripType: "Leisure",
            startDate: new Date("2026-09-30"),
            endDate: new Date("2026-10-03"),
            duration: 4,
            travellers: 2,
            totalAmount: "36453.38",
            totalAmount_paise: 3645338,
            advanceAmount_paise: 911335,
            balanceAmount_paise: 2734003,
            balanceDueAmount: "27340.03",
            currency: "INR",
            paymentPlan: "DEPOSIT",
            paymentStatus: "PENDING",
            installments: {
                create: [
                    { type: "DEPOSIT", sequence: 0, amount_paise: 911335, status: "PENDING" },
                    { type: "BALANCE", sequence: 1, amount_paise: 2734003, status: "PENDING" },
                ],
            },
            payments: {
                create: [{ userId: user.id, amount: "9113.35", amount_paise: 911335, gateway: "RAZORPAY", status: "PENDING", gatewayOrderId: ORDER_ID, idempotencyKey: `e2e:${tag}` }],
            },
        },
        select: { id: true },
    });
    bookingId = booking.id;

    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: PAYMENT_ID, order_id: ORDER_ID, method: "upi" } } } });
    const goodSig = sign(body);

    const bad = await processGatewayWebhook("RAZORPAY", body, rzpHeaders("deadbeef", EVENT_ID));
    expect("bad signature → 400 invalid_signature", bad.httpStatus === 400 && bad.result === "invalid_signature");

    const first = await processGatewayWebhook("RAZORPAY", body, rzpHeaders(goodSig, EVENT_ID));
    expect("valid capture → processed", first.result === "processed");

    const dup = await processGatewayWebhook("RAZORPAY", body, rzpHeaders(goodSig, EVENT_ID));
    expect("duplicate → duplicate (no reprocess)", dup.result === "duplicate");

    const pay = await db.payment.findFirst({ where: { gatewayOrderId: ORDER_ID }, select: { status: true, gatewayPaymentId: true, paidAt: true, method: true } });
    const bk = await db.booking.findUnique({ where: { id: booking.id }, select: { paymentStatus: true, paidAmount: true, balanceDueAmount: true } });
    const dep = await db.paymentInstallment.findFirst({ where: { bookingId: booking.id, type: "DEPOSIT" }, select: { status: true, paidPaymentId: true } });
    const evCount = await db.webhookEvent.count({ where: { eventId: EVENT_ID } });

    expect("payment FULLY_PAID + ids", pay?.status === "FULLY_PAID" && pay.gatewayPaymentId === PAYMENT_ID && pay.method === "UPI" && pay.paidAt != null);
    expect("booking ADVANCE_PAID + money", bk?.paymentStatus === "ADVANCE_PAID" && bk.paidAmount.toString() === "9113.35" && bk.balanceDueAmount.toString() === "27340.03");
    expect("deposit installment PAID", dep?.status === "PAID" && dep.paidPaymentId != null);
    expect("exactly one webhook event row", evCount === 1);

    console.log(failures.length === 0 ? "\nPHASE4_E2E_PASS" : `\nPHASE4_E2E_FAIL (${failures.length})`);
}

main()
    .catch((e) => { console.error("E2E ERROR", e); failures.push("threw"); })
    .finally(async () => {
        if (bookingId) {
            await db.payment.deleteMany({ where: { bookingId } }).catch(() => {});
            await db.booking.delete({ where: { id: bookingId } }).catch(() => {});
        }
        await db.webhookEvent.deleteMany({ where: { eventId: EVENT_ID } }).catch(() => {});
        await db.$disconnect();
        process.exit(failures.length === 0 ? 0 : 1);
    });
