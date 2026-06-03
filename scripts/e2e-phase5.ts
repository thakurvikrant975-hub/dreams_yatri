/**
 * Phase 5 integration e2e — failure/refund webhooks, reconciliation, balance reminders.
 * Run:  npm run e2e:phase5   (needs DATABASE_URL; sets its own webhook secret; stubs Razorpay fetch + mailer)
 * DB-mutating, self-cleaning, NOT part of `npm test`.
 */
import { createHmac } from "crypto";
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "test_wh_secret_e2e";

import { db } from "../app/lib/db";
import { processRazorpayWebhook } from "../app/actions/payment/webhook.service";
import { reconcilePendingPayments, type ReconFetcher } from "../app/actions/payment/reconcile.service";
import { runBalanceReminders, type Mailer } from "../app/actions/payment/reminders.service";

const tag = Date.now();
const sign = (b: string) => createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(b).digest("hex");
const failures: string[] = [];
const expect = (n: string, c: boolean) => { if (!c) { failures.push(n); console.error(`  ✗ ${n}`); } };
const bookingIds: string[] = [];
const eventIds: string[] = [];

async function seed(opts: {
    paymentStatus: "PENDING" | "ADVANCE_PAID";
    payment?: object;
    balanceInstallment?: { dueDate: Date; reminderCount: number; status?: "PENDING" | "OVERDUE" };
}) {
    const user = await db.user.findFirst({ select: { id: true } });
    const dest = await db.destinations.findFirst({ select: { id: true } });
    const b = await db.booking.create({
        data: {
            bookingNumber: `T5-${tag}-${Math.random().toString(36).slice(2, 6)}`,
            userId: user!.id, destinationId: dest!.id, tripType: "Leisure",
            startDate: new Date("2026-09-30"), endDate: new Date("2026-10-03"), duration: 4, travellers: 2,
            totalAmount: "36453.38", totalAmount_paise: 3645338, advanceAmount_paise: 911335, balanceAmount_paise: 2734003,
            currency: "INR", paymentPlan: "DEPOSIT", paymentStatus: opts.paymentStatus,
            installments: {
                create: [
                    { type: "DEPOSIT", sequence: 0, amount_paise: 911335, status: opts.paymentStatus === "ADVANCE_PAID" ? "PAID" : "PENDING" },
                    { type: "BALANCE", sequence: 1, amount_paise: 2734003, status: opts.balanceInstallment?.status ?? "PENDING", dueDate: opts.balanceInstallment?.dueDate, reminderCount: opts.balanceInstallment?.reminderCount ?? 0 },
                ],
            },
            ...(opts.payment ? { payments: { create: [opts.payment] } } : {}),
        },
        select: { id: true },
    });
    bookingIds.push(b.id);
    return b.id;
}
async function userId() { return (await db.user.findFirst({ select: { id: true } }))!.id; }

async function failedAndRefund() {
    // payment.failed
    const orderF = `order_F_${tag}`;
    await seed({ paymentStatus: "PENDING", payment: { userId: await userId(), amount: "9113.35", amount_paise: 911335, gateway: "RAZORPAY", status: "PENDING", gatewayOrderId: orderF, idempotencyKey: `f:${tag}` } });
    const fb = JSON.stringify({ event: "payment.failed", payload: { payment: { entity: { id: `pay_F_${tag}`, order_id: orderF, error_description: "card declined" } } } });
    eventIds.push(`evt_F_${tag}`);
    const fr = await processRazorpayWebhook({ rawBody: fb, signature: sign(fb), eventId: `evt_F_${tag}` });
    const pf = await db.payment.findFirst({ where: { gatewayOrderId: orderF }, select: { status: true, failureReason: true } });
    expect("failed→processed", fr.result === "processed");
    expect("payment FAILED + reason", pf?.status === "FAILED" && pf.failureReason === "card declined");

    // refund (partial)
    const payR = `pay_R_${tag}`;
    const bId = await seed({ paymentStatus: "ADVANCE_PAID", payment: { userId: await userId(), amount: "9113.35", amount_paise: 911335, gateway: "RAZORPAY", status: "FULLY_PAID", gatewayPaymentId: payR, gatewayOrderId: `order_R_${tag}`, idempotencyKey: `r:${tag}` } });
    const rb = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: `rfnd_${tag}`, payment_id: payR, amount: 500000 } } } });
    eventIds.push(`evt_R_${tag}`);
    const rr = await processRazorpayWebhook({ rawBody: rb, signature: sign(rb), eventId: `evt_R_${tag}` });
    const pr = await db.payment.findFirst({ where: { gatewayPaymentId: payR }, select: { status: true, refundId: true, refundAmount: true } });
    const bk = await db.booking.findUnique({ where: { id: bId }, select: { paymentStatus: true } });
    expect("refund→processed", rr.result === "processed");
    expect("payment PARTIALLY_REFUNDED", pr?.status === "PARTIALLY_REFUNDED" && pr.refundId === `rfnd_${tag}` && Number(pr.refundAmount) === 5000);
    expect("booking mirrors PARTIALLY_REFUNDED", bk?.paymentStatus === "PARTIALLY_REFUNDED");
    const dup = await processRazorpayWebhook({ rawBody: rb, signature: sign(rb), eventId: `evt_R_${tag}` });
    expect("refund duplicate→duplicate", dup.result === "duplicate");
}

async function reconciliation() {
    const sc = `order_SC_${tag}`, sf = `order_SF_${tag}`, fr = `order_FR_${tag}`;
    const old = new Date(Date.now() - 30 * 60_000), recent = new Date(Date.now() - 60_000);
    const bCap = await seed({ paymentStatus: "PENDING", payment: { userId: await userId(), amount: "9113.35", amount_paise: 911335, gateway: "RAZORPAY", status: "PENDING", gatewayOrderId: sc, idempotencyKey: `sc:${tag}`, createdAt: old } });
    await seed({ paymentStatus: "PENDING", payment: { userId: await userId(), amount: "9113.35", amount_paise: 911335, gateway: "RAZORPAY", status: "PENDING", gatewayOrderId: sf, idempotencyKey: `sf:${tag}`, createdAt: old } });
    await seed({ paymentStatus: "PENDING", payment: { userId: await userId(), amount: "9113.35", amount_paise: 911335, gateway: "RAZORPAY", status: "PENDING", gatewayOrderId: fr, idempotencyKey: `fr:${tag}`, createdAt: recent } });
    const stub: ReconFetcher = async (o) => o === sc ? [{ id: `pay_${tag}_c`, status: "captured", method: "upi", amount: 911335 }] : o === sf ? [{ id: `pay_${tag}_x`, status: "failed" }] : [];
    const sum = await reconcilePendingPayments({ olderThanMinutes: 15, fetcher: stub });
    const capPay = await db.payment.findFirst({ where: { gatewayOrderId: sc }, select: { status: true } });
    const capBk = await db.booking.findUnique({ where: { id: bCap }, select: { paymentStatus: true } });
    const freshPay = await db.payment.findFirst({ where: { gatewayOrderId: fr }, select: { status: true } });
    expect("recon finalized 1 + failed 1", sum.finalized === 1 && sum.failed === 1);
    expect("recon captured→FULLY_PAID + booking ADVANCE_PAID", capPay?.status === "FULLY_PAID" && capBk?.paymentStatus === "ADVANCE_PAID");
    expect("recon fresh untouched (PENDING)", freshPay?.status === "PENDING");
    const again = await reconcilePendingPayments({ olderThanMinutes: 15, fetcher: stub });
    expect("recon idempotent (2nd scans 0)", again.scanned === 0);
}

async function reminders() {
    const NOW = new Date(2026, 6, 10);
    const due = (m: number, d: number) => new Date(Date.UTC(2026, m - 1, d));
    await seed({ paymentStatus: "ADVANCE_PAID", balanceInstallment: { dueDate: due(7, 15), reminderCount: 0 } }); // +5d
    await seed({ paymentStatus: "ADVANCE_PAID", balanceInstallment: { dueDate: due(7, 11), reminderCount: 0 } }); // +1d
    await seed({ paymentStatus: "ADVANCE_PAID", balanceInstallment: { dueDate: due(7, 9), reminderCount: 0 } });  // overdue
    await seed({ paymentStatus: "ADVANCE_PAID", balanceInstallment: { dueDate: due(7, 30), reminderCount: 0 } }); // +20d none
    await seed({ paymentStatus: "ADVANCE_PAID", balanceInstallment: { dueDate: due(7, 15), reminderCount: 1 } }); // already reminded
    const sent: string[] = [];
    const mailer: Mailer = async () => { sent.push("x"); return true; };
    const r1 = await runBalanceReminders({ now: NOW, mailer });
    expect("reminders: 3 sent, 1 overdue", r1.remindersSent === 3 && r1.markedOverdue === 1 && sent.length === 3);
    const r2 = await runBalanceReminders({ now: NOW, mailer });
    expect("reminders idempotent (0 on 2nd)", r2.remindersSent === 0 && r2.markedOverdue === 0);
}

async function main() {
    await failedAndRefund();
    await reconciliation();
    await reminders();
    console.log(failures.length === 0 ? "PHASE5_E2E_PASS" : `PHASE5_E2E_FAIL (${failures.length})`);
}

main().catch((e) => { console.error("E2E ERROR", e); failures.push("threw"); }).finally(async () => {
    for (const id of bookingIds) { await db.payment.deleteMany({ where: { bookingId: id } }).catch(() => {}); await db.booking.delete({ where: { id } }).catch(() => {}); }
    for (const e of eventIds) { await db.webhookEvent.deleteMany({ where: { eventId: e } }).catch(() => {}); }
    await db.$disconnect();
    process.exit(failures.length === 0 ? 0 : 1);
});
