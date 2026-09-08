/**
 * Money math for offline payments: settle, then reverse, and prove the booking
 * lands back exactly where it started.
 *
 * The reversal is the part worth testing. Settling is the gateway's own path,
 * exercised by e2e-phase4/6 already; reversing is new, and it recomputes a
 * booking's money from the payments that survive rather than decrementing what
 * was there. That is the safer design but only if the arithmetic is right, and
 * getting it wrong means a client's balance is wrong.
 *
 * Creates its own scratch booking and deletes it at the end, so it is safe to
 * run against the shared dev database.
 *
 * Run:  npx tsx --conditions=react-server --env-file=.env --env-file=.env.development.local scripts/test-offline-payment.ts
 */
import { db, dbTarget } from "./_db";
import type { TransactionClient } from "../app/lib/db";
import { finalizeCapturedPayment, reverseFinalizedPayment } from "../app/actions/payment/finalize.service";

/** scripts/_db builds a plain PrismaClient; app/lib/db exports an extended one
 *  (retry extension), and the two transaction-client types are nominally
 *  different while being structurally the same for every call made here. The
 *  cast marks that seam. `import type` is erased, so pulling the type in does
 *  not drag app/lib/db — and its top-level await — into a tsx script. */
const asTx = (tx: unknown) => tx as TransactionClient;

let passed = 0, failed = 0;
function expect(label: string, cond: boolean, detail?: string) {
    if (cond) { passed++; console.log(`  ✓ ${label}`); }
    else { failed++; console.log(`  ✗ ${label}${detail ? `  — ${detail}` : ""}`); }
}

const TOTAL = 5_000_000;    // ₹50,000
const DEPOSIT = 1_250_000;  // ₹12,500 (25%)
const BALANCE = TOTAL - DEPOSIT;
const tag = Date.now().toString(36);

async function money(id: string) {
    const b = await db.booking.findUnique({
        where: { id },
        select: {
            paymentStatus: true, paidAmount: true, advancePaidAmount: true,
            balanceDueAmount: true, balanceAmount_paise: true,
        },
    });
    return {
        status: b!.paymentStatus,
        paid: Number(b!.paidAmount),
        advance: Number(b!.advancePaidAmount),
        balanceDue: Number(b!.balanceDueAmount),
        balancePaise: b!.balanceAmount_paise,
    };
}

async function main() {
    console.log(`\n▸ Offline payment: settle & reverse\n  target: ${dbTarget}\n`);

    const user = await db.user.findFirst({ select: { id: true } });
    const dest = await db.destinations.findFirst({ select: { id: true } });
    if (!user || !dest) throw new Error("need a user + destination in this database");

    const booking = await db.booking.create({
        data: {
            bookingNumber: `TEST-OFF-${tag}`,
            userId: user.id, destinationId: dest.id, tripType: "Leisure",
            startDate: new Date("2027-02-10"), endDate: new Date("2027-02-14"),
            duration: 5, travellers: 2,
            totalAmount: (TOTAL / 100).toFixed(2), totalAmount_paise: TOTAL,
            advanceAmount_paise: DEPOSIT, balanceAmount_paise: BALANCE,
            balanceDueAmount: (BALANCE / 100).toFixed(2),
            currency: "INR", paymentPlan: "DEPOSIT", paymentStatus: "PENDING",
            installments: {
                create: [
                    { type: "DEPOSIT", sequence: 0, amount_paise: DEPOSIT, status: "PENDING" },
                    { type: "BALANCE", sequence: 1, amount_paise: BALANCE, status: "PENDING" },
                ],
            },
        },
        select: { id: true },
    });

    try {
        const before = await money(booking.id);
        expect("starts PENDING, nothing paid", before.status === "PENDING" && before.paid === 0);

        // ── 1. Deposit taken over company UPI, recorded two days late ────────
        const receivedAt = new Date(Date.now() - 2 * 86_400_000);
        const dep = await db.payment.create({
            data: {
                bookingId: booking.id, userId: user.id,
                amount: (DEPOSIT / 100).toFixed(2), amount_paise: DEPOSIT,
                gateway: "OFFLINE", method: "UPI", status: "PENDING", purpose: "INITIAL",
                recordedByName: "Test Exec", receiptUrl: "https://example.invalid/receipt.jpg",
            },
            select: { id: true },
        });
        const finDep = await db.$transaction((tx) => finalizeCapturedPayment(asTx(tx), {
            paymentId: dep.id, gatewayPaymentId: `UTR-${tag}-A`, method: "UPI", paidAt: receivedAt,
        }));
        expect("deposit finalizes", finDep.result === "finalized");

        const afterDep = await money(booking.id);
        expect("booking ADVANCE_PAID", afterDep.status === "ADVANCE_PAID", afterDep.status);
        expect("paid = deposit", afterDep.paid === DEPOSIT / 100, String(afterDep.paid));
        expect("balance due = total - deposit", afterDep.balanceDue === BALANCE / 100, String(afterDep.balanceDue));

        const depRow = await db.payment.findUnique({ where: { id: dep.id }, select: { paidAt: true, status: true } });
        expect("paidAt is when the money arrived, not now",
            Math.abs(depRow!.paidAt!.getTime() - receivedAt.getTime()) < 2000,
            `${depRow!.paidAt?.toISOString()} vs ${receivedAt.toISOString()}`);

        const inst = await db.paymentInstallment.findFirst({
            where: { bookingId: booking.id, type: "DEPOSIT" }, select: { status: true, paidPaymentId: true },
        });
        expect("deposit installment PAID and linked", inst?.status === "PAID" && inst?.paidPaymentId === dep.id);

        // ── 2. Balance taken by bank transfer ────────────────────────────────
        const bal = await db.payment.create({
            data: {
                bookingId: booking.id, userId: user.id,
                amount: (BALANCE / 100).toFixed(2), amount_paise: BALANCE,
                gateway: "OFFLINE", method: "BANK_TRANSFER", status: "PENDING", purpose: "BALANCE",
                recordedByName: "Test Exec", receiptUrl: "https://example.invalid/receipt2.jpg",
            },
            select: { id: true },
        });
        const finBal = await db.$transaction((tx) => finalizeCapturedPayment(asTx(tx), {
            paymentId: bal.id, gatewayPaymentId: `UTR-${tag}-B`, method: "BANK_TRANSFER",
        }));
        expect("balance finalizes", finBal.result === "finalized");

        const afterBal = await money(booking.id);
        expect("booking FULLY_PAID", afterBal.status === "FULLY_PAID", afterBal.status);
        expect("paid = total", afterBal.paid === TOTAL / 100, String(afterBal.paid));
        expect("nothing outstanding", afterBal.balancePaise === 0, String(afterBal.balancePaise));

        // ── 3. The balance was a mistake — void it ───────────────────────────
        const rev = await db.$transaction((tx) => reverseFinalizedPayment(asTx(tx), {
            paymentId: bal.id, reason: "Entered against the wrong booking", byName: "Test Manager",
        }));
        expect("balance reverses", rev.result === "reversed", JSON.stringify(rev));

        const afterVoid = await money(booking.id);
        expect("back to ADVANCE_PAID", afterVoid.status === "ADVANCE_PAID", afterVoid.status);
        expect("paid back to deposit only", afterVoid.paid === DEPOSIT / 100, String(afterVoid.paid));
        expect("balance due restored", afterVoid.balancePaise === BALANCE, String(afterVoid.balancePaise));
        expect("advance still counted", afterVoid.advance === DEPOSIT / 100, String(afterVoid.advance));

        const voided = await db.payment.findUnique({
            where: { id: bal.id }, select: { status: true, voidedAt: true, voidReason: true, voidedByName: true },
        });
        expect("row survives as VOIDED with a reason",
            voided?.status === "VOIDED" && voided.voidedAt != null
            && voided.voidReason === "Entered against the wrong booking" && voided.voidedByName === "Test Manager");

        expect("voiding is idempotent",
            (await db.$transaction((tx) => reverseFinalizedPayment(asTx(tx), { paymentId: bal.id, reason: "again" }))).result === "already");

        // ── 4. Void the deposit too — booking must fall all the way back ─────
        const rev2 = await db.$transaction((tx) => reverseFinalizedPayment(asTx(tx), {
            paymentId: dep.id, reason: "Duplicate of an earlier entry", byName: "Test Manager",
        }));
        expect("deposit reverses", rev2.result === "reversed");

        const afterAll = await money(booking.id);
        expect("booking back to PENDING", afterAll.status === "PENDING", afterAll.status);
        expect("paid back to zero", afterAll.paid === 0, String(afterAll.paid));
        expect("advance back to zero", afterAll.advance === 0, String(afterAll.advance));
        expect("full amount outstanding again", afterAll.balancePaise === TOTAL, String(afterAll.balancePaise));

        const inst2 = await db.paymentInstallment.findFirst({
            where: { bookingId: booking.id, type: "DEPOSIT" }, select: { status: true, paidPaymentId: true, paidAt: true },
        });
        expect("deposit installment released",
            inst2?.status === "PENDING" && inst2.paidPaymentId === null && inst2.paidAt === null);

        // ── 5. A voided payment must not be reachable as money ───────────────
        const sum = await db.payment.aggregate({
            where: { bookingId: booking.id, status: { in: ["ADVANCE_PAID", "FULLY_PAID"] } },
            _sum: { amount_paise: true },
        });
        expect("voided rows drop out of the money query", (sum._sum.amount_paise ?? 0) === 0);

        // ── 6. Nothing else is reversible ────────────────────────────────────
        const pending = await db.payment.create({
            data: {
                bookingId: booking.id, userId: user.id, amount: "1.00", amount_paise: 100,
                gateway: "OFFLINE", status: "PENDING", purpose: "TOPUP",
            },
            select: { id: true },
        });
        const revPending = await db.$transaction((tx) => reverseFinalizedPayment(asTx(tx), { paymentId: pending.id, reason: "nope" }));
        expect("a PENDING payment cannot be voided", revPending.result === "not_reversible");
    } finally {
        await db.payment.deleteMany({ where: { bookingId: booking.id } });
        await db.paymentInstallment.deleteMany({ where: { bookingId: booking.id } });
        await db.bookingTimeline.deleteMany({ where: { bookingId: booking.id } });
        await db.booking.delete({ where: { id: booking.id } });
        console.log("\n  scratch booking removed");
    }

    console.log(`\n${passed} passed, ${failed} failed\n`);
    await db.$disconnect();
    if (failed) process.exit(1);
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
