/**
 * Pure-unit tests for the cancellation-policy engine + config.
 * Run:  npm run test:cancel
 */
import { computeCancellationRefund } from "../app/services/cancellation-policy/engine";
import { resolveConfig, DEFAULT_CANCELLATION_POLICY } from "../app/services/cancellation-policy/config";

let passed = 0;
const failures: string[] = [];
const check = (n: string, c: boolean) => { if (c) passed++; else { failures.push(n); console.error(`  ✗ ${n}`); } };
const throws = (f: () => unknown) => { try { f(); return false; } catch { return true; } };
const localNow = (y: number, mh: number, d: number) => new Date(y, mh - 1, d);

const NOW = localNow(2026, 6, 10); // 10 Jun 2026
const PAID = 3_645_338; // ₹36,453.38

console.log("Cancellation policy:");

// Tier boundaries (curve 90/50/25/0).
{
    const far = computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-08-01", now: NOW }); // 52d
    check("≥30d → 90%", far.refundPct === 90 && far.tierMinDays === 30);
    check("90% refundable rounded", far.refundablePaise === Math.round(PAID * 0.9));
    check("fee = paid − refundable", far.feePaise === PAID - far.refundablePaise);
    check("refundable + fee = paid", far.refundablePaise + far.feePaise === PAID);
    check("reason label", far.reason === "TIER_30D_90PCT");
}
check("exactly 30d → 90%", computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-07-10", now: NOW }).refundPct === 90); // 30d
check("29d → 50%", computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-07-09", now: NOW }).refundPct === 50); // 29d
check("exactly 15d → 50%", computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-06-25", now: NOW }).refundPct === 50); // 15d
check("14d → 25%", computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-06-24", now: NOW }).refundPct === 25); // 14d
check("exactly 7d → 25%", computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-06-17", now: NOW }).refundPct === 25); // 7d
check("6d → 0%", computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-06-16", now: NOW }).refundPct === 0); // 6d
check("same day → 0%", computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-06-10", now: NOW }).refundPct === 0);
{
    const past = computeCancellationRefund({ paidPaise: PAID, travelDate: "2026-06-01", now: NOW });
    check("past travel (no-show) → 0% refundable, full fee", past.refundPct === 0 && past.refundablePaise === 0 && past.feePaise === PAID && past.daysToTravel < 0);
}

// zero paid
{
    const z = computeCancellationRefund({ paidPaise: 0, travelDate: "2026-08-01", now: NOW });
    check("zero paid → 0/0", z.refundablePaise === 0 && z.feePaise === 0);
}

// rounding on an odd amount at 25%
{
    const r = computeCancellationRefund({ paidPaise: 100_003, travelDate: "2026-06-20", now: NOW }); // 10d → 25%
    check("odd amount 25% rounds + sums", r.refundablePaise === Math.round(100_003 * 0.25) && r.refundablePaise + r.feePaise === 100_003);
}

// config override
{
    const c = computeCancellationRefund({ paidPaise: 100_000, travelDate: "2026-08-01", now: NOW, config: resolveConfig({ tiers: [{ minDays: 0, refundPct: 100 }] }) });
    check("override single 100% tier", c.refundPct === 100 && c.refundablePaise === 100_000 && c.feePaise === 0);
}

// bad input
check("negative paid throws", throws(() => computeCancellationRefund({ paidPaise: -1, travelDate: "2026-08-01", now: NOW })));
check("non-int paid throws", throws(() => computeCancellationRefund({ paidPaise: 1.5, travelDate: "2026-08-01", now: NOW })));
check("bad date throws", throws(() => computeCancellationRefund({ paidPaise: 100, travelDate: "2026-02-30", now: NOW })));

// config defaults + validation
check("defaults 90/50/25/0 + ₹500 fee", DEFAULT_CANCELLATION_POLICY.tiers[0].refundPct === 90 && DEFAULT_CANCELLATION_POLICY.dateChangeFeePaise === 50_000);
check("resolveConfig appends 0-day catch-all", resolveConfig({ tiers: [{ minDays: 10, refundPct: 50 }] }).tiers.some((t) => t.minDays === 0));
check("resolveConfig refundPct>100 throws", throws(() => resolveConfig({ tiers: [{ minDays: 0, refundPct: 150 }] })));
check("resolveConfig negative fee throws", throws(() => resolveConfig({ dateChangeFeePaise: -1 })));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
