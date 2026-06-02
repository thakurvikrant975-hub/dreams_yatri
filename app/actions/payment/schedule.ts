"use server";

import { getQuote } from "@/app/actions/quote/get-quote.service";
import { computePaymentSchedule } from "@/app/services/payment-policy/engine";
import { rupeesToPaise } from "@/app/lib/money";
import type { PaymentScheduleResult } from "./types";

/**
 * Read-only: resolve a quote, then run the payment-policy engine on its total +
 * travel date. Returns a safe DTO (paise + dates only — no margin/cost). No DB
 * write, no gateway. Quote integrity/expiry handling is reused from getQuote;
 * the schedule is still computed for an EXPIRED quote (the review page decides
 * what to show) but a not_found/invalid quote passes the failure through.
 */
export async function getPaymentScheduleForQuote(quoteId: string): Promise<PaymentScheduleResult> {
    const res = await getQuote(quoteId);
    if (!res.success) {
        return { success: false, reason: res.reason };
    }

    const quote = res.quote;
    const schedule = computePaymentSchedule({
        totalPaise: rupeesToPaise(quote.total_amount),
        travelDate: quote.travel_date,
        now: new Date(),
    });

    return {
        success: true,
        schedule: {
            plan: schedule.plan,
            totalPaise: rupeesToPaise(quote.total_amount),
            depositPaise: schedule.depositPaise,
            balancePaise: schedule.balancePaise,
            balanceDueDate: schedule.balanceDueDate,
            currency: quote.currency,
            reason: schedule.reason,
        },
    };
}
