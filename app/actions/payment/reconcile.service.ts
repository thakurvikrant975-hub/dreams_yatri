import "server-only";
import { db } from "@/app/lib/db";
import { fetchOrderPayments, type RazorpayPaymentLite } from "@/app/lib/razorpay";
import { finalizeCapturedPayment } from "./finalize.service";

/**
 * Reconciliation — the safety net for missed/late webhooks.
 *
 * For Razorpay payments stuck PENDING past a staleness window, ask Razorpay for
 * the order's real status and finalize/fail accordingly. Uses the SAME
 * `finalizeCapturedPayment` as the webhook (idempotent) so the two never diverge,
 * and never touches a payment a webhook already finalized (we only select PENDING).
 *
 * The Razorpay fetcher is injectable so this is unit-testable without live keys.
 */

export type ReconFetcher = (orderId: string) => Promise<RazorpayPaymentLite[]>;

export interface ReconSummary {
    scanned: number;
    finalized: number;
    failed: number;
    skipped: number;
}

export async function reconcilePendingPayments(opts?: {
    olderThanMinutes?: number;
    fetcher?: ReconFetcher;
    limit?: number;
}): Promise<ReconSummary> {
    const minutes = (opts?.olderThanMinutes ?? Number(process.env.RECON_STALE_MINUTES)) || 15;
    const fetcher = opts?.fetcher ?? fetchOrderPayments;
    const cutoff = new Date(Date.now() - minutes * 60_000);

    const pendings = await db.payment.findMany({
        where: { status: "PENDING", gateway: "RAZORPAY", gatewayOrderId: { not: null }, createdAt: { lt: cutoff } },
        select: { id: true, gatewayOrderId: true },
        take: opts?.limit ?? 100,
        orderBy: { createdAt: "asc" },
    });

    let finalized = 0, failed = 0, skipped = 0;

    for (const p of pendings) {
        try {
            const attempts = await fetcher(p.gatewayOrderId!);
            const captured = attempts.find((a) => a.status === "captured");

            if (captured) {
                await db.$transaction((tx) =>
                    finalizeCapturedPayment(tx, {
                        paymentId: p.id,
                        gatewayPaymentId: captured.id,
                        method: captured.method ?? null,
                        rawPayload: captured as unknown as object,
                        webhookEventId: null,
                    }),
                );
                finalized++;
            } else if (attempts.length > 0 && attempts.every((a) => a.status === "failed")) {
                await db.payment.update({
                    where: { id: p.id },
                    data: { status: "FAILED", failureReason: "reconciled: no successful payment" },
                });
                failed++;
            } else {
                // still created/authorized, or no attempt yet — leave PENDING for the next pass.
                skipped++;
            }
        } catch (e) {
            console.error("[recon] order", p.gatewayOrderId, e);
            skipped++;
        }
    }

    return { scanned: pendings.length, finalized, failed, skipped };
}
