import "server-only";
import { db } from "@/app/lib/db";
import { getProvider } from "@/app/lib/payments/registry";
import type { ChargeStatus, RefundStatus, GatewayId } from "@/app/lib/payments/types";
import { finalizeCapturedPayment } from "./finalize.service";
import { runPaymentConfirmedEffects } from "./confirmation-effects";
import { notifyRefund } from "@/app/services/notifications/booking-notify";

/**
 * Reconciliation — the safety net for missed/late webhooks.
 *
 * For payments stuck PENDING past a staleness window, ask the gateway provider
 * for the order's real status and finalize/fail accordingly. Uses the SAME
 * `finalizeCapturedPayment` as the webhook (idempotent), and only ever touches
 * PENDING payments — so it can never override a webhook. `statusOf` is injectable
 * for tests (default: the gateway provider's `fetchChargeStatus`).
 */

export type StatusFetcher = (gateway: GatewayId, gatewayOrderRef: string) => Promise<ChargeStatus>;

export interface ReconSummary {
    scanned: number;
    finalized: number;
    failed: number;
    skipped: number;
}

const defaultStatusOf: StatusFetcher = (gateway, ref) => getProvider(gateway).fetchChargeStatus(ref);

export async function reconcilePendingPayments(opts?: {
    olderThanMinutes?: number;
    statusOf?: StatusFetcher;
    limit?: number;
}): Promise<ReconSummary> {
    const minutes = (opts?.olderThanMinutes ?? Number(process.env.RECON_STALE_MINUTES)) || 15;
    const statusOf = opts?.statusOf ?? defaultStatusOf;
    const cutoff = new Date(Date.now() - minutes * 60_000);

    const pendings = await db.payment.findMany({
        where: { status: "PENDING", gatewayOrderId: { not: null }, createdAt: { lt: cutoff } },
        select: { id: true, gateway: true, gatewayOrderId: true },
        take: opts?.limit ?? 100,
        orderBy: { createdAt: "asc" },
    });

    let finalized = 0, failed = 0, skipped = 0;

    for (const p of pendings) {
        try {
            const status = await statusOf(p.gateway as GatewayId, p.gatewayOrderId!);
            if (status.state === "captured" && status.gatewayPaymentId) {
                const fin = await db.$transaction((tx) =>
                    finalizeCapturedPayment(tx, {
                        paymentId: p.id,
                        gatewayPaymentId: status.gatewayPaymentId!,
                        method: status.method ?? null,
                        webhookEventId: null,
                    }),
                );
                // Identical to the webhook's, and shared with it rather than
                // copied: this branch previously confirmed hotels and moved
                // the badge counts but sent neither the customer's
                // confirmation nor their invoice, so a booking the webhook
                // missed was also a booking nobody was told about.
                await runPaymentConfirmedEffects({
                    confirmInitial: fin.result === "finalized" && fin.purpose === "INITIAL",
                    isNewCapture: fin.result === "finalized",
                    bookingId: fin.result === "finalized" ? fin.bookingId : undefined,
                    paymentId: p.id,
                });
                finalized++;
            } else if (status.state === "failed") {
                await db.payment.update({ where: { id: p.id }, data: { status: "FAILED", failureReason: "reconciled: no successful payment" } });
                failed++;
            } else {
                skipped++;
            }
        } catch (e) {
            console.error("[recon]", p.gateway, p.gatewayOrderId, e);
            skipped++;
        }
    }

    return { scanned: pendings.length, finalized, failed, skipped };
}

// ── Refund reconciliation (esp. PayU, which has no refund webhook) ────────────

export type RefundStatusFetcher = (gateway: GatewayId, refundId: string) => Promise<RefundStatus>;
export interface RefundReconSummary { scanned: number; confirmed: number; }

const defaultRefundStatusOf: RefundStatusFetcher = (gateway, refundId) => getProvider(gateway).fetchRefundStatus(refundId);

/**
 * Confirm refunds that were initiated (Payment.refundId set) but not yet marked
 * REFUNDED — i.e. the refund webhook never arrived (or the gateway sends none).
 * Polls the gateway for each and finalizes REFUNDED/PARTIALLY_REFUNDED + Booking.
 */
export async function reconcileRefunds(opts?: { statusOf?: RefundStatusFetcher; limit?: number }): Promise<RefundReconSummary> {
    const statusOf = opts?.statusOf ?? defaultRefundStatusOf;
    const pending = await db.payment.findMany({
        where: { refundId: { not: null }, status: { notIn: ["REFUNDED", "PARTIALLY_REFUNDED"] } },
        select: { id: true, gateway: true, refundId: true, amount_paise: true, refundAmount: true, bookingId: true },
        take: opts?.limit ?? 100,
    });

    let confirmed = 0;
    for (const p of pending) {
        try {
            const st = await statusOf(p.gateway as GatewayId, p.refundId!);
            if (st.state !== "processed") continue;
            const refundedPaise = Math.round(Number(p.refundAmount ?? 0) * 100);
            const status = refundedPaise > 0 && refundedPaise < p.amount_paise ? "PARTIALLY_REFUNDED" : "REFUNDED";
            await db.$transaction(async (tx) => {
                await tx.payment.update({ where: { id: p.id }, data: { status, refundedAt: new Date() } });
                await tx.booking.update({ where: { id: p.bookingId }, data: { paymentStatus: status } });
            });
            try { await notifyRefund(p.bookingId, refundedPaise || p.amount_paise); } catch (e) { console.error("[reconcileRefunds] email failed", e); }
            confirmed++;
        } catch (e) {
            console.error("[reconcileRefunds]", p.refundId, e);
        }
    }
    return { scanned: pending.length, confirmed };
}
