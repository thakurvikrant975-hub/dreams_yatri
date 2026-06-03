/**
 * Cancellation / date-change policy configuration (pure).
 *
 * Code defaults ← env overrides ← explicit per-call overrides. Reads
 * `process.env` only inside `resolveConfig()` so the engine stays a pure,
 * deterministic function of its inputs.
 *
 * Locked policy (2026-06-03): refund curve 90/50/25/0 by days-to-travel
 * (≥30 → 90% · 15–29 → 50% · 7–14 → 25% · <7 / no-show → 0%); deposit refundable
 * per the curve (the % applies to the whole paid amount); date-change fee ₹500.
 */

export interface CancellationTier {
    /** Refund this % when daysToTravel >= minDays (tiers checked high→low). */
    minDays: number;
    refundPct: number;
}

export interface CancellationPolicyConfig {
    tiers: CancellationTier[];
    dateChangeFeePaise: number;
}

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyConfig = {
    tiers: [
        { minDays: 30, refundPct: 90 },
        { minDays: 15, refundPct: 50 },
        { minDays: 7, refundPct: 25 },
        { minDays: 0, refundPct: 0 },
    ],
    dateChangeFeePaise: 50_000, // ₹500
};

function envNumber(key: string): number | undefined {
    const raw = process.env[key];
    if (raw == null || raw.trim() === "") return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
}

/** Parse CANCEL_TIERS env (JSON array of {minDays, refundPct}). Returns undefined if unset/invalid. */
function envTiers(): CancellationTier[] | undefined {
    const raw = process.env.CANCEL_TIERS;
    if (!raw || raw.trim() === "") return undefined;
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return undefined;
        const tiers = parsed.map((t) => ({ minDays: Number(t.minDays), refundPct: Number(t.refundPct) }));
        return tiers.every((t) => Number.isFinite(t.minDays) && Number.isFinite(t.refundPct)) ? tiers : undefined;
    } catch {
        return undefined;
    }
}

function validate(c: CancellationPolicyConfig): CancellationPolicyConfig {
    if (!c.tiers.length) throw new Error("cancellation-policy: at least one tier required");
    for (const t of c.tiers) {
        if (!Number.isInteger(t.minDays) || t.minDays < 0) throw new Error(`cancellation-policy: tier minDays must be int ≥ 0, got ${t.minDays}`);
        if (!Number.isFinite(t.refundPct) || t.refundPct < 0 || t.refundPct > 100) throw new Error(`cancellation-policy: tier refundPct must be 0–100, got ${t.refundPct}`);
    }
    if (!Number.isInteger(c.dateChangeFeePaise) || c.dateChangeFeePaise < 0) throw new Error(`cancellation-policy: dateChangeFeePaise must be int ≥ 0, got ${c.dateChangeFeePaise}`);

    // Sort high→low and guarantee a 0-day catch-all (else default it to 0% refund).
    const tiers = [...c.tiers].sort((a, b) => b.minDays - a.minDays);
    if (tiers[tiers.length - 1].minDays !== 0) tiers.push({ minDays: 0, refundPct: 0 });
    return { ...c, tiers };
}

export function resolveConfig(overrides?: Partial<CancellationPolicyConfig>): CancellationPolicyConfig {
    const merged: CancellationPolicyConfig = {
        tiers: overrides?.tiers ?? envTiers() ?? DEFAULT_CANCELLATION_POLICY.tiers,
        dateChangeFeePaise:
            overrides?.dateChangeFeePaise ?? envNumber("DATE_CHANGE_FEE_PAISE") ?? DEFAULT_CANCELLATION_POLICY.dateChangeFeePaise,
    };
    return validate(merged);
}
