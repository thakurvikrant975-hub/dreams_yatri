/**
 * Pure-unit tests for app/lib/money.ts (paise discipline).
 * Run:  npm run test:money
 */
import { rupeesToPaise, paiseToRupees, formatPaise, sumPaise, assertIntPaise } from "../app/lib/money";

let passed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean) {
    if (cond) passed++;
    else { failures.push(name); console.error(`  ✗ ${name}`); }
}
function throws(fn: () => unknown): boolean {
    try { fn(); return false; } catch { return true; }
}

console.log("Money:");

// rupeesToPaise
check("whole rupees → paise", rupeesToPaise(100) === 10000);
check("2-dp rupees → paise", rupeesToPaise(36453.38) === 3645338);
check("rounds half-up", rupeesToPaise(0.005) === 1);
check("rounds tiny float noise", rupeesToPaise(19.99) === 1999);
check("numeric string accepted", rupeesToPaise("1260.50") === 126050);
check("zero", rupeesToPaise(0) === 0);
check("non-finite throws", throws(() => rupeesToPaise(Number("abc"))));

// paiseToRupees
check("paise → rupees", paiseToRupees(3645338) === 36453.38);
check("paise → rupees whole", paiseToRupees(10000) === 100);
check("fractional paise throws", throws(() => paiseToRupees(100.5)));

// round-trip
check("round-trip stable", paiseToRupees(rupeesToPaise(12999.99)) === 12999.99);

// formatPaise
check("format basic", formatPaise(3645338) === "₹36,453.38");
check("format whole", formatPaise(10000) === "₹100.00");
check("format zero", formatPaise(0) === "₹0.00");

// sumPaise
check("sum", sumPaise([1999, 1, 100000]) === 102000);
check("sum empty", sumPaise([]) === 0);
check("sum rejects fractional", throws(() => sumPaise([100, 0.5])));

// assertIntPaise
check("assert passes on int", !throws(() => assertIntPaise(500)));
check("assert fails on float", throws(() => assertIntPaise(500.1)));

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
