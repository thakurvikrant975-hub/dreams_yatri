import "server-only";
import { db } from "@/app/lib/db";

/** Stamps the FIRST time a lead is actually worked (not a call-attempt
 * counter) — only ever set once; later calls are no-ops. Feeds the
 * unattended-lead SLA in sla-sweep.service.ts. */
export async function stampFirstResponded(queryId: string): Promise<void> {
  await db.package_queries.updateMany({
    where: { id: queryId, firstRespondedAt: null },
    data: { firstRespondedAt: new Date() },
  });
}

/** Stamps the FIRST time a query's package goes out — only ever set once.
 * Feeds the package-send-delay SLA in sla-sweep.service.ts. */
export async function stampPackageSent(queryId: string): Promise<void> {
  await db.package_queries.updateMany({
    where: { id: queryId, firstPackageSentAt: null },
    data: { firstPackageSentAt: new Date() },
  });
}
