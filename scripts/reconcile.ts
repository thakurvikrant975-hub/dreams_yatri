/**
 * Dev helper: reconcile pending payments + refunds against the gateway.
 * Run:  npm run cron:reconcile
 * Finalizes captured payments whose webhook didn't reach localhost.
 */
import { reconcilePendingPayments, reconcileRefunds } from "../app/actions/payment/reconcile.service";

(async () => {
    const payments = await reconcilePendingPayments();
    const refunds = await reconcileRefunds();
    console.log("reconcile →", JSON.stringify({ payments, refunds }));
    process.exit(0);
})().catch((e) => { console.error("reconcile failed", e); process.exit(1); });
