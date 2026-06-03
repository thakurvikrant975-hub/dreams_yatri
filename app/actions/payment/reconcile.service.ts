import "server-only";
import { db } from "@/app/lib/db";
import { getProvider } from "@/app/lib/payments/registry";
import type { ChargeStatus, GatewayId } from "@/app/lib/payments/types";
import { finalizeCapturedPayment } from "./finalize.service";

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
                await db.$transaction((tx) =>
                    finalizeCapturedPayment(tx, {
                        paymentId: p.id,
                        gatewayPaymentId: status.gatewayPaymentId!,
                        method: status.method ?? null,
                        webhookEventId: null,
                    }),
                );
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
