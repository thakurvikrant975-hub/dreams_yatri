import { assertIntPaise } from "../../lib/money";
import { resolveConfig, type CancellationPolicyConfig } from "./config";

/**
 * Pure cancellation-refund engine.
 *
 * Given the amount paid (paise) + travel date, pick the refund tier by
 * days-to-travel and split paid → refundable + fee. No DB, no gateway, no hidden
 * clock (caller passes `now`). Rounds the refundable once; fee = paid − refundable
 * (no drift). The deposit isn't special — the % applies to the whole paid amount.
 */

export interface CancellationRefund {
    daysToTravel: number;
    refundPct: number;
    tierMinDays: number;
    paidPaise: number;
    refundablePaise: number;
    feePaise: number;
    reason: string; // e.g. "TIER_30D_90PCT"
}

export interface CancellationInput {
    paidPaise: number;
    travelDate: string; // YYYY-MM-DD
    now?: Date;
    config?: CancellationPolicyConfig;
}

const MS_PER_DAY = 86_400_000;

function parseDateMs(s: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`cancellation-policy: bad travelDate '${s}'`);
    const [y, m, d] = s.split("-").map(Number);
    const ms = Date.UTC(y, m - 1, d);
    const dt = new Date(ms);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
        throw new Error(`cancellation-policy: travelDate is not a real calendar date '${s}'`);
    }
    return ms;
}

export function computeCancellationRefund(input: CancellationInput): CancellationRefund {
    const { paidPaise, travelDate } = input;
    const now = input.now ?? new Date();
    const config = input.config ?? resolveConfig();

    assertIntPaise(paidPaise);
    if (paidPaise < 0) throw new Error(`cancellation-policy: paidPaise must be ≥ 0, got ${paidPaise}`);

    const travelMs = parseDateMs(travelDate);
    // `now` read by LOCAL components → server-local "today" (matches the other engines).
    const nowMs = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const daysToTravel = Math.floor((travelMs - nowMs) / MS_PER_DAY);

    // Tiers are sorted high→low with a guaranteed 0-day catch-all.
    const tier = config.tiers.find((t) => daysToTravel >= t.minDays) ?? { minDays: 0, refundPct: 0 };

    const refundablePaise = Math.round((paidPaise * tier.refundPct) / 100);
    const feePaise = paidPaise - refundablePaise;

    return {
        daysToTravel,
        refundPct: tier.refundPct,
        tierMinDays: tier.minDays,
        paidPaise,
        refundablePaise,
        feePaise,
        reason: `TIER_${tier.minDays}D_${tier.refundPct}PCT`,
    };
}
