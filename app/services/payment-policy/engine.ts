import { assertIntPaise, ceilPaiseToRupee, sumPaise } from "../../lib/money";
import { resolveConfig, type PaymentPolicyConfig } from "./config";

/**
 * Pure payment-schedule engine.
 *
 * Given a total (paise) + travel date, decide FULL vs DEPOSIT and produce the
 * exact legs (amounts in paise, due dates). No DB, no gateway, no hidden clock —
 * the caller passes `now` (defaulting to new Date()) so the function is a
 * deterministic function of its inputs.
 *
 * Invariants enforced at runtime: integer paise in/out, positive total, and the
 * installment legs always sum to exactly `totalPaise` (round deposit once,
 * balance = total − deposit — never round both independently).
 */

export type PaymentPlanKind = "FULL" | "DEPOSIT";
export type InstallmentLegType = "DEPOSIT" | "BALANCE";
export type ScheduleReason = "FULL_NEAR_TRAVEL" | "FULL_DEPOSIT_COVERS_TOTAL" | "DEPOSIT_ALLOWED";

export interface ScheduleInstallment {
    type: InstallmentLegType;
    sequence: number;
    amountPaise: number;
    dueDate: string; // YYYY-MM-DD (deposit = today; balance = balanceDueDate)
}

export interface PaymentSchedule {
    plan: PaymentPlanKind;
    depositPaise: number;
    balancePaise: number;
    balanceDueDate: string | null; // YYYY-MM-DD, null for FULL
    daysUntilTravel: number;
    installments: ScheduleInstallment[];
    reason: ScheduleReason;
}

export interface PaymentScheduleInput {
    totalPaise: number;
    travelDate: string; // YYYY-MM-DD
    now?: Date;
    config?: PaymentPolicyConfig;
}

const MS_PER_DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, "0");

/** Calendar-number → UTC ms (used purely for tz-independent day arithmetic). */
function calMs(year: number, monthIdx: number, day: number): number {
    return Date.UTC(year, monthIdx, day);
}

/** Parse 'YYYY-MM-DD' to its calendar UTC ms; throws on a non-real date. */
function parseDateMs(s: string): number {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`payment-policy: bad travelDate '${s}'`);
    const [y, m, d] = s.split("-").map(Number);
    const ms = calMs(y, m - 1, d);
    const dt = new Date(ms);
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
        throw new Error(`payment-policy: travelDate is not a real calendar date '${s}'`);
    }
    return ms;
}

function msToISO(ms: number): string {
    const d = new Date(ms);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function fullSchedule(
    totalPaise: number,
    todayISO: string,
    daysUntilTravel: number,
    reason: ScheduleReason,
): PaymentSchedule {
    return {
        plan: "FULL",
        depositPaise: totalPaise,
        balancePaise: 0,
        balanceDueDate: null,
        daysUntilTravel,
        installments: [{ type: "DEPOSIT", sequence: 0, amountPaise: totalPaise, dueDate: todayISO }],
        reason,
    };
}

export function computePaymentSchedule(input: PaymentScheduleInput): PaymentSchedule {
    const { totalPaise, travelDate } = input;
    const now = input.now ?? new Date();
    const config = input.config ?? resolveConfig();

    assertIntPaise(totalPaise);
    if (totalPaise <= 0) throw new Error(`payment-policy: totalPaise must be positive, got ${totalPaise}`);

    const travelMs = parseDateMs(travelDate);
    // `now` read by LOCAL components → matches server-local "today" (as the quote engine does).
    const nowMs = calMs(now.getFullYear(), now.getMonth(), now.getDate());
    const todayISO = msToISO(nowMs);
    const daysUntilTravel = Math.floor((travelMs - nowMs) / MS_PER_DAY);

    // Near (or past) travel → full payment now (a future balance date is impossible).
    if (daysUntilTravel <= config.balanceDueDaysBeforeTravel) {
        return fullSchedule(totalPaise, todayISO, daysUntilTravel, "FULL_NEAR_TRAVEL");
    }

    // Deposit: round UP to a whole rupee once, then apply the floor — so the
    // deposit leg (and, since totalPaise is itself a whole rupee, the derived
    // balance leg) can never end up as a fractional rupee.
    let deposit = ceilPaiseToRupee(Math.round((totalPaise * config.depositPercent) / 100));
    if (deposit < config.minDepositPaise) deposit = config.minDepositPaise;

    // Floor (or pct) covering the whole total ⇒ effectively full.
    if (deposit >= totalPaise) {
        return fullSchedule(totalPaise, todayISO, daysUntilTravel, "FULL_DEPOSIT_COVERS_TOTAL");
    }

    const balance = totalPaise - deposit;
    const balanceDueISO = msToISO(travelMs - config.balanceDueDaysBeforeTravel * MS_PER_DAY);

    const schedule: PaymentSchedule = {
        plan: "DEPOSIT",
        depositPaise: deposit,
        balancePaise: balance,
        balanceDueDate: balanceDueISO,
        daysUntilTravel,
        installments: [
            { type: "DEPOSIT", sequence: 0, amountPaise: deposit, dueDate: todayISO },
            { type: "BALANCE", sequence: 1, amountPaise: balance, dueDate: balanceDueISO },
        ],
        reason: "DEPOSIT_ALLOWED",
    };

    // Invariant: legs must reconstitute the exact total.
    const legSum = sumPaise(schedule.installments.map((l) => l.amountPaise));
    if (legSum !== totalPaise) {
        throw new Error(`payment-policy: legs (${legSum}) != total (${totalPaise})`);
    }
    return schedule;
}
