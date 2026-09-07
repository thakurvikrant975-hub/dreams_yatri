/**
 * Payment-policy configuration (pure).
 *
 * Code defaults ← env overrides ← explicit per-call overrides. Reads
 * `process.env` only inside `resolveConfig()` (never at import time) so the
 * engine stays a pure, deterministic function of its inputs.
 *
 * Locked policy (2026-06-02): 25% deposit, balance due 15 days before travel
 * (also the full-payment cutoff), ₹2,000 minimum deposit floor.
 */

export interface PaymentPolicyConfig {
    /** Percentage of the total collected up front for a DEPOSIT booking (1–100). */
    depositPercent: number;
    /**
     * Days before travel the balance is due. This SAME window is the
     * full-payment cutoff: booking inside it ⇒ 100% now.
     */
    balanceDueDaysBeforeTravel: number;
    /** Minimum deposit in paise; if total < floor the deposit becomes the total. */
    minDepositPaise: number;
}

export const DEFAULT_PAYMENT_POLICY: PaymentPolicyConfig = {
    depositPercent: 25,
    balanceDueDaysBeforeTravel: 15,
    // ₹5,000 — "Book Now Pay Later": deposit = max(25%, ₹5,000).
    //
    // Halved from ₹10,000. The floor is what a trip must clear before it can
    // be split at all, so it decides who is allowed to pay in two parts: at
    // ₹10,000 that was only trips over ₹40,000, which put every short or
    // shoulder-season booking on pay-in-full. At ₹5,000 the split opens up
    // from ₹20,000. Anything cheaper than the floor still resolves to a single
    // FULL leg — a deposit larger than the trip is not a deposit.
    minDepositPaise: 500_000,
};

function envNumber(key: string): number | undefined {
    const raw = process.env[key];
    if (raw == null || raw.trim() === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

function validate(c: PaymentPolicyConfig): PaymentPolicyConfig {
    if (!Number.isFinite(c.depositPercent) || c.depositPercent < 1 || c.depositPercent > 100) {
        throw new Error(`payment-policy: depositPercent must be 1–100, got ${c.depositPercent}`);
    }
    if (!Number.isInteger(c.balanceDueDaysBeforeTravel) || c.balanceDueDaysBeforeTravel < 0) {
        throw new Error(`payment-policy: balanceDueDaysBeforeTravel must be an integer ≥ 0, got ${c.balanceDueDaysBeforeTravel}`);
    }
    if (!Number.isInteger(c.minDepositPaise) || c.minDepositPaise < 0) {
        throw new Error(`payment-policy: minDepositPaise must be an integer ≥ 0, got ${c.minDepositPaise}`);
    }
    return c;
}

/**
 * Resolve the effective config: defaults, overlaid with any env vars
 * (`PAYMENT_DEPOSIT_PERCENT`, `PAYMENT_BALANCE_DUE_DAYS_BEFORE_TRAVEL`,
 * `PAYMENT_MIN_DEPOSIT_PAISE`), overlaid with explicit overrides. Validated.
 */
export function resolveConfig(overrides?: Partial<PaymentPolicyConfig>): PaymentPolicyConfig {
    const fromEnv: Partial<PaymentPolicyConfig> = {
        depositPercent: envNumber("PAYMENT_DEPOSIT_PERCENT"),
        balanceDueDaysBeforeTravel: envNumber("PAYMENT_BALANCE_DUE_DAYS_BEFORE_TRAVEL"),
        minDepositPaise: envNumber("PAYMENT_MIN_DEPOSIT_PAISE"),
    };

    const merged: PaymentPolicyConfig = {
        depositPercent:
            overrides?.depositPercent ?? fromEnv.depositPercent ?? DEFAULT_PAYMENT_POLICY.depositPercent,
        balanceDueDaysBeforeTravel:
            overrides?.balanceDueDaysBeforeTravel ?? fromEnv.balanceDueDaysBeforeTravel ?? DEFAULT_PAYMENT_POLICY.balanceDueDaysBeforeTravel,
        minDepositPaise:
            overrides?.minDepositPaise ?? fromEnv.minDepositPaise ?? DEFAULT_PAYMENT_POLICY.minDepositPaise,
    };

    return validate(merged);
}
