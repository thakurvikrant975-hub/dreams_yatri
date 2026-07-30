import "server-only";
import { db } from "@/app/lib/db";
import { computePackagePrice } from "@/app/services/package-pricing.service";
import { parseRoomsJson } from "@/app/actions/quote/get-quote.service";
import { resolveConfig } from "@/app/services/cancellation-policy/config";
import { getProvider, activeGateway } from "@/app/lib/payments/registry";
import type { GatewayId } from "@/app/lib/payments/types";
import { rupeesToPaise } from "@/app/lib/money";
import type { DateChangeResult, DateChangePreview, DateChangeDirection } from "./types";

/**
 * Change a booking's travel date: re-price the new date, add a date-change fee,
 * and settle the difference. (newTotal + fee) − paid = newOutstanding:
 *   < 0 → refund the excess to the original payment;
 *   > 0 with a pending balance leg → fold into the balance (pay later);
 *   > 0 with nothing outstanding (fully-paid booking) → immediate TOPUP charge;
 *   = 0 → nothing to settle.
 * The booking dates/total/snapshot update immediately; the refund/top-up money is
 * confirmed by the gateway webhook (TOPUP capture is finalized by the purpose-aware
 * finalize; refund by the Phase-5 refund webhook).
 */

const EXCLUDED = new Set(["CANCELLED", "COMPLETED"]);
const MS_PER_DAY = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

function todayISO(): string {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
}
function isRealFutureDate(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
    return s >= todayISO();
}

async function reprice(quoteId: string, newDate: string): Promise<number | null> {
    const q = await db.package_quote.findUnique({ where: { id: quoteId } });
    if (!q) return null;
    const rooms = parseRoomsJson(q.rooms);
    const bd = await computePackagePrice({
        package_id: q.package_id, duration_id: q.duration_id, route_id: q.route_id, stay_category_id: q.stay_category_id,
        adults: q.adults, children: q.children, infants: q.infants, child_ages: q.child_ages,
        cab_type_ids: q.cab_type_ids.length ? q.cab_type_ids : null, rooms: rooms.length ? rooms : null, travel_date: newDate,
    });
    if (bd.missing_pricing_config) return null;
    return rupeesToPaise(bd.final_price);
}

/** Load booking + derived fields shared by preview & apply. */
async function loadCtx(bookingId: string, byUserId?: string) {
    const booking = await db.booking.findUnique({
        where: { id: bookingId },
        select: {
            id: true, userId: true, status: true, quoteId: true, startDate: true, endDate: true, currency: true,
            totalAmount_paise: true, paymentPlan: true,
            payments: { select: { id: true, gateway: true, status: true, amount_paise: true, gatewayPaymentId: true } },
            installments: { select: { id: true, type: true, status: true } },
        },
    });
    if (!booking) return { ok: false as const, error: "not_found" as const };
    if (byUserId && booking.userId !== byUserId) return { ok: false as const, error: "forbidden" as const };
    if (EXCLUDED.has(booking.status)) return { ok: false as const, error: "not_changeable" as const };
    if (!booking.quoteId) return { ok: false as const, error: "not_changeable" as const };
    return { ok: true as const, booking };
}

export function planSettlement(newTotalPaise: number, feePaise: number, paidPaise: number, hasPendingBalance: boolean) {
    const newOutstanding = newTotalPaise + feePaise - paidPaise;
    let direction: DateChangeDirection;
    let settleAmountPaise = 0;
    if (newOutstanding < 0) { direction = "refund"; settleAmountPaise = -newOutstanding; }
    else if (newOutstanding === 0) { direction = "none"; }
    else if (hasPendingBalance) { direction = "balance"; settleAmountPaise = newOutstanding; }
    else { direction = "topup"; settleAmountPaise = newOutstanding; }
    return { newOutstanding, direction, settleAmountPaise };
}

export async function previewDateChange(bookingId: string, newDate: string, byUserId?: string): Promise<DateChangePreview | null> {
    const ctx = await loadCtx(bookingId, byUserId);
    if (!ctx.ok) return null;
    if (!isRealFutureDate(newDate)) return null;
    const newTotalPaise = await reprice(ctx.booking.quoteId!, newDate);
    if (newTotalPaise == null) return null;

    const feePaise = resolveConfig().dateChangeFeePaise;
    const paidPaise = ctx.booking.payments.filter((p) => p.status === "FULLY_PAID").reduce((s, p) => s + p.amount_paise, 0);
    const hasPendingBalance = ctx.booking.installments.some((i) => i.type === "BALANCE" && (i.status === "PENDING" || i.status === "OVERDUE"));
    const { newOutstanding, direction, settleAmountPaise } = planSettlement(newTotalPaise, feePaise, paidPaise, hasPendingBalance);

    return { newDate, oldTotalPaise: ctx.booking.totalAmount_paise, newTotalPaise, feePaise, paidPaise, newOutstandingPaise: newOutstanding, direction, settleAmountPaise };
}

export async function changeTravelDate(params: { bookingId: string; newDate: string; byUserId?: string }): Promise<DateChangeResult> {
    const { bookingId, newDate, byUserId } = params;
    const ctx = await loadCtx(bookingId, byUserId);
    if (!ctx.ok) return { success: false, reason: ctx.error };
    if (!isRealFutureDate(newDate)) return { success: false, reason: "invalid_date" };

    const booking = ctx.booking;
    const newTotalPaise = await reprice(booking.quoteId!, newDate);
    if (newTotalPaise == null) return { success: false, reason: "unpriceable" };

    const feePaise = resolveConfig().dateChangeFeePaise;
    const captured = booking.payments.filter((p) => p.status === "FULLY_PAID" && p.gatewayPaymentId);
    const paidPaise = captured.reduce((s, p) => s + p.amount_paise, 0);
    const hasPendingBalance = booking.installments.some((i) => i.type === "BALANCE" && (i.status === "PENDING" || i.status === "OVERDUE"));
    const { newOutstanding, direction, settleAmountPaise } = planSettlement(newTotalPaise, feePaise, paidPaise, hasPendingBalance);

    // Apply the new dates + total (the trip price; the fee is a separate charge).
    const nights = Math.max(1, Math.round((booking.endDate.getTime() - booking.startDate.getTime()) / MS_PER_DAY));
    const startDate = new Date(`${newDate}T00:00:00.000Z`);
    const endDate = new Date(startDate.getTime() + nights * MS_PER_DAY);
    const newBalancePaise = Math.max(0, newOutstanding);

    try {
        if (direction === "refund") {
            // Refund the excess across captured payments (skip already-refunded).
            let remaining = settleAmountPaise;
            for (const p of captured) {
                if (remaining <= 0) break;
                const amt = Math.min(remaining, p.amount_paise);
                const res = await getProvider(p.gateway as GatewayId).refund({ gatewayPaymentId: p.gatewayPaymentId!, amountPaise: amt, idempotencyKey: `datechange:${booking.id}:${newDate}:${p.id}` });
                await db.payment.update({ where: { id: p.id }, data: { refundId: res.refundId, refundAmount: (amt / 100).toFixed(2) } });
                remaining -= amt;
            }
            await applyBookingUpdate(booking.id, startDate, endDate, newTotalPaise, 0);
            return { success: true, direction: "refund", bookingId: booking.id, amountPaise: settleAmountPaise };
        }

        if (direction === "topup") {
            const gateway = (captured[0]?.gateway as GatewayId) ?? activeGateway();
            const payment = await db.payment.create({
                data: {
                    bookingId: booking.id, userId: booking.userId, amount: (settleAmountPaise / 100).toFixed(2), amount_paise: settleAmountPaise,
                    gateway, status: "PENDING", purpose: "TOPUP", idempotencyKey: `datechange:${booking.id}:${newDate}`,
                },
                select: { id: true },
            });
            const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
            const charge = await getProvider(gateway).createCharge({
                amountPaise: settleAmountPaise, receipt: `DC-${booking.id.slice(-8)}`, bookingId: booking.id, customer: {},
                notes: { bookingId: booking.id, purpose: "datechange" },
                successUrl: `${base}/api/payments/payu/callback?b=${booking.id}&k=success`,
                failureUrl: `${base}/api/payments/payu/callback?b=${booking.id}&k=failure`,
            });
            await db.payment.update({ where: { id: payment.id }, data: { gatewayOrderId: charge.gatewayOrderRef } });
            await applyBookingUpdate(booking.id, startDate, endDate, newTotalPaise, newBalancePaise);
            return { success: true, direction: "topup", bookingId: booking.id, amountPaise: settleAmountPaise, checkout: charge.checkout };
        }

        if (direction === "balance") {
            await db.$transaction(async (tx) => {
                await tx.paymentInstallment.updateMany({ where: { bookingId: booking.id, type: "BALANCE" }, data: { amount_paise: settleAmountPaise } });
                await applyBookingUpdateTx(tx, booking.id, startDate, endDate, newTotalPaise, settleAmountPaise);
            });
            return { success: true, direction: "balance", bookingId: booking.id, amountPaise: settleAmountPaise };
        }

        // none
        await applyBookingUpdate(booking.id, startDate, endDate, newTotalPaise, newBalancePaise);
        return { success: true, direction: "none", bookingId: booking.id, amountPaise: 0 };
    } catch (e) {
        console.error("[changeTravelDate] failed", e);
        return { success: false, reason: "error", message: "Could not change the date. Please try again." };
    }
}

async function applyBookingUpdate(id: string, startDate: Date, endDate: Date, totalPaise: number, balancePaise: number) {
    await db.booking.update({
        where: { id },
        data: { startDate, endDate, totalAmount_paise: totalPaise, totalAmount: (totalPaise / 100).toFixed(2), balanceAmount_paise: balancePaise, balanceDueAmount: (balancePaise / 100).toFixed(2) },
    });
}
async function applyBookingUpdateTx(tx: Parameters<Parameters<typeof db.$transaction>[0]>[0], id: string, startDate: Date, endDate: Date, totalPaise: number, balancePaise: number) {
    await tx.booking.update({
        where: { id },
        data: { startDate, endDate, totalAmount_paise: totalPaise, totalAmount: (totalPaise / 100).toFixed(2), balanceAmount_paise: balancePaise, balanceDueAmount: (balancePaise / 100).toFixed(2) },
    });
}
