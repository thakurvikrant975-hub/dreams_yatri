import type { AdsSyncKind, Prisma } from "@/app/generated/prisma/client";

/**
 * The ads_sync_runs log: one row per sync, opened before it starts and closed
 * with its outcome. A sync that stops silently looks exactly like a day with no
 * spend — this is how anyone can tell the two apart, and where a failure's
 * reason is kept. Platform-neutral; the Meta sync will write here too.
 */

/**
 * Only the operations used here, not Pick<PrismaClient, …>: the app's client is
 * wrapped in a retry extension that changes its model types, and a Pick of the
 * plain client would accept the scripts' client but reject the app's. Both
 * satisfy this.
 */
export type SyncRunDb = {
  adsSyncRun: {
    create(args: { data: Prisma.AdsSyncRunUncheckedCreateInput; select: { id: true } }): PromiseLike<{ id: string }>;
    update(args: { where: { id: string }; data: Prisma.AdsSyncRunUncheckedUpdateInput }): PromiseLike<unknown>;
  };
};

export async function startSyncRun(
  db: SyncRunDb,
  run: { platform: string; kind: AdsSyncKind; windowFrom?: string; windowTo?: string },
): Promise<string> {
  const row = await db.adsSyncRun.create({
    data: {
      platform: run.platform,
      kind: run.kind,
      windowFrom: run.windowFrom ? new Date(`${run.windowFrom}T00:00:00Z`) : null,
      windowTo: run.windowTo ? new Date(`${run.windowTo}T00:00:00Z`) : null,
    },
    select: { id: true },
  });
  return row.id;
}

export async function finishSyncRun(db: SyncRunDb, id: string, rowsWritten: number, details: Record<string, unknown>) {
  await db.adsSyncRun.update({
    where: { id },
    data: { status: "SUCCEEDED", finishedAt: new Date(), rowsWritten, details: details as object },
  });
}

/** Never throws: it runs on the failure path, and must not bury the error it records. */
export async function failSyncRun(db: SyncRunDb, id: string, error: unknown) {
  try {
    await db.adsSyncRun.update({
      where: { id },
      data: { status: "FAILED", finishedAt: new Date(), error: (error instanceof Error ? error.message : String(error)).slice(0, 4000) },
    });
  } catch (e) {
    console.error("[ads-sync] could not record the failure:", e);
  }
}
