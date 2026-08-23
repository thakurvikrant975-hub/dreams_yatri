import "server-only";
import { db } from "@/app/lib/db";
import { Prisma } from "@/app/generated/prisma";

export const SETTINGS_KEYS = {
  autoAssignQueries: "auto_assign_queries_enabled",
  /** Shadow mode (default/false) logs late logins and notifies the Sales
   * Manager without blocking anyone; flip to true once the 10:05 AM cutoff
   * has been observed and trusted to actually enforce it. */
  enforceLoginCutoff: "enforce_login_cutoff",
} as const;

export async function getBoolSetting(key: string, fallback: boolean): Promise<boolean> {
  const row = await db.systemSetting.findUnique({ where: { key }, select: { value: true } });
  if (!row) return fallback;
  return typeof row.value === "boolean" ? row.value : fallback;
}

export async function setBoolSetting(key: string, value: boolean, actorId?: string | null): Promise<void> {
  await db.systemSetting.upsert({
    where: { key },
    create: { key, value: value as unknown as Prisma.InputJsonValue, updatedBy: actorId ?? null },
    update: { value: value as unknown as Prisma.InputJsonValue, updatedBy: actorId ?? null },
  });
}
