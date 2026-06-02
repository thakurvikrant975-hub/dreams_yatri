/**
 * Money helpers — paise discipline.
 *
 * Gateways (Razorpay/PayU) charge in **integer minor units (paise)**. Floating
 * point rupee math drifts, so the rule is: round ONCE at the rupee→paise
 * boundary, then do all arithmetic on integer paise. Decimal(10,2) rupee
 * columns stay for display/back-compat; paise columns are the charge source of
 * truth.
 *
 * Pure module (no imports) — importable anywhere, trivially unit-tested.
 */

/** Convert rupees (number or numeric string) to integer paise. Rounds half-up. */
export function rupeesToPaise(rupees: number | string): number {
    const n = typeof rupees === "string" ? Number(rupees) : rupees;
    if (!Number.isFinite(n)) throw new Error(`rupeesToPaise: not a finite number: ${rupees}`);
    return Math.round(n * 100);
}

/** Convert integer paise back to rupees (number, 2-dp precise). */
export function paiseToRupees(paise: number): number {
    assertIntPaise(paise);
    return paise / 100;
}

/** Format paise as an Indian-rupee display string, e.g. 3645338 → "₹36,453.38". */
export function formatPaise(paise: number): string {
    assertIntPaise(paise);
    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(paise / 100);
}

/** Sum a list of paise amounts (all must be integers). */
export function sumPaise(amounts: number[]): number {
    let total = 0;
    for (const a of amounts) {
        assertIntPaise(a);
        total += a;
    }
    return total;
}

/** Throw if a value isn't a safe integer (paise must never be fractional). */
export function assertIntPaise(paise: number): void {
    if (!Number.isInteger(paise)) {
        throw new Error(`paise must be an integer, got: ${paise}`);
    }
    if (!Number.isSafeInteger(paise)) {
        throw new Error(`paise out of safe integer range: ${paise}`);
    }
}
