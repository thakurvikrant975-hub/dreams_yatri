/**
 * Pure-unit tests for the payment-policy engine + config.
 * Run:  npm run test:policy
 */
import { computePaymentSchedule } from "../app/services/payment-policy/engine";
import { resolveConfig, DEFAULT_PAYMENT_POLICY } from "../app/services/payment-policy/config";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean) {
    if (cond) passed++;
    else { failures.push(name); console.error(`  ✗ ${name}`); }
}
function throws(fn: () => unknown): boolean {
    try { fn(); return false; } catch { return true; }
}
/** Local calendar date (tz-independent components). monthHuman is 1–12. */
function localNow(y: number, monthHuman: number, d: number): Date {
    return new Date(y, monthHuman - 1, d);
}

const NOW = localNow(2026, 6, 2); // 2 Jun 2026 (local)
const NO_FLOOR = { depositPercent: 25, balanceDueDaysBeforeTravel: 15, minDepositPaise: 0 };

console.log("Payment policy:");

// 1) Far → DEPOSIT 25% with DEFAULT config; legs sum to total; balance due travel−15.
{
    const total = 3_645_338; // ₹36,453.38
    const s = computePaymentSchedule({ totalPaise: total, travelDate: "2026-08-01", now: NOW });
    check("far → DEPOSIT", s.plan === "DEPOSIT" && s.reason === "DEPOSIT_ALLOWED");
    check("deposit = round(25%)", s.depositPaise === 911_335); // 911334.5 → 911335 (half-up)
    check("balance = total − deposit", s.balancePaise === total - 911_335);
    check("legs sum to total", s.installments.reduce((a, l) => a + l.amountPaise, 0) === total);
    check("balanceDueDate = travel − 15d", s.balanceDueDate === "2026-07-17");
    check("two legs DEPOSIT+BALANCE", s.installments.length === 2 && s.installments[0].type === "DEPOSIT" && s.installments[1].type === "BALANCE");
    check("deposit due today", s.installments[0].dueDate === "2026-06-02");
}

// 2) Exact cutoff (daysUntil == 15) → FULL.
{
    const s = computePaymentSchedule({ totalPaise: 1_000_000, travelDate: "2026-06-17", now: NOW });
    check("exactly 15 days → FULL", s.plan === "FULL" && s.reason === "FULL_NEAR_TRAVEL");
    check("FULL daysUntilTravel == 15", s.daysUntilTravel === 15);
    check("FULL: deposit = total, balance 0", s.depositPaise === 1_000_000 && s.balancePaise === 0);
    check("FULL: balanceDueDate null", s.balanceDueDate === null);
    check("FULL: single leg", s.installments.length === 1 && s.installments[0].amountPaise === 1_000_000);
}

// 3) Just past cutoff (16 days) → DEPOSIT.
{
    const s = computePaymentSchedule({ totalPaise: 1_000_000, travelDate: "2026-06-18", now: NOW });
    check("16 days → DEPOSIT", s.plan === "DEPOSIT" && s.daysUntilTravel === 16);
}

// 4) Near / today / past → FULL.
check("3 days → FULL", computePaymentSchedule({ totalPaise: 1_000_000, travelDate: "2026-06-05", now: NOW }).plan === "FULL");
check("today → FULL", computePaymentSchedule({ totalPaise: 1_000_000, travelDate: "2026-06-02", now: NOW }).plan === "FULL");
check("past → FULL (daysUntil < 0)", (() => { const s = computePaymentSchedule({ totalPaise: 1_000_000, travelDate: "2026-06-01", now: NOW }); return s.plan === "FULL" && s.daysUntilTravel === -1; })());

// 5) Rounding with no floor: odd total, deposit rounded, balance = remainder.
{
    const s = computePaymentSchedule({ totalPaise: 100_001, travelDate: "2026-08-01", now: NOW, config: NO_FLOOR });
    check("odd total deposit rounded", s.depositPaise === 25_000); // 25000.25 → 25000
    check("odd total balance = remainder", s.balancePaise === 75_001);
    check("odd total legs sum exact", s.depositPaise + s.balancePaise === 100_001);
}
// half-up at .5
{
    const s = computePaymentSchedule({ totalPaise: 2, travelDate: "2026-08-01", now: NOW, config: NO_FLOOR });
    check("0.5 paise rounds half-up to 1", s.depositPaise === 1 && s.balancePaise === 1);
}

// 6) Floor RAISES a small-percentage deposit (still < total → DEPOSIT).
{
    const s = computePaymentSchedule({ totalPaise: 600_000, travelDate: "2026-08-01", now: NOW }); // 25% = 150000 < ₹2000 floor
    check("floor raises deposit to 200000", s.depositPaise === 200_000 && s.plan === "DEPOSIT");
    check("floor-raised balance", s.balancePaise === 400_000);
}

// 7) Floor covers whole (cheap trip) → FULL.
{
    const s = computePaymentSchedule({ totalPaise: 150_000, travelDate: "2026-08-01", now: NOW }); // < ₹2000 floor
    check("cheap trip → FULL_DEPOSIT_COVERS_TOTAL", s.plan === "FULL" && s.reason === "FULL_DEPOSIT_COVERS_TOTAL");
    check("cheap trip single leg = total", s.installments.length === 1 && s.installments[0].amountPaise === 150_000);
}

// 8) Explicit config override (50% / 10 days / no floor).
{
    const s = computePaymentSchedule({ totalPaise: 1_000_000, travelDate: "2026-08-01", now: NOW, config: { depositPercent: 50, balanceDueDaysBeforeTravel: 10, minDepositPaise: 0 } });
    check("override 50% deposit", s.depositPaise === 500_000 && s.balancePaise === 500_000);
    check("override balance due travel−10", s.balanceDueDate === "2026-07-22");
}

// 9) Bad inputs throw.
check("zero total throws", throws(() => computePaymentSchedule({ totalPaise: 0, travelDate: "2026-08-01", now: NOW })));
check("negative total throws", throws(() => computePaymentSchedule({ totalPaise: -100, travelDate: "2026-08-01", now: NOW })));
check("non-integer total throws", throws(() => computePaymentSchedule({ totalPaise: 100.5, travelDate: "2026-08-01", now: NOW })));
check("malformed date throws", throws(() => computePaymentSchedule({ totalPaise: 1000, travelDate: "01-08-2026", now: NOW })));
check("impossible date throws", throws(() => computePaymentSchedule({ totalPaise: 1000, travelDate: "2026-02-30", now: NOW })));

// 10) Config resolution + validation.
check("defaults are 25/15/200000", DEFAULT_PAYMENT_POLICY.depositPercent === 25 && DEFAULT_PAYMENT_POLICY.balanceDueDaysBeforeTravel === 15 && DEFAULT_PAYMENT_POLICY.minDepositPaise === 200_000);
check("resolveConfig override wins", resolveConfig({ depositPercent: 40 }).depositPercent === 40);
check("resolveConfig percent 0 throws", throws(() => resolveConfig({ depositPercent: 0 })));
check("resolveConfig percent 101 throws", throws(() => resolveConfig({ depositPercent: 101 })));
check("resolveConfig negative days throws", throws(() => resolveConfig({ balanceDueDaysBeforeTravel: -1 })));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
