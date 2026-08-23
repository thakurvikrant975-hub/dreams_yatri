"use server";

import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";

/** Called every ~60s by IdleHeartbeat while a dashboard tab is open and
 * active. sla-sweep.service.ts's dashboard-inactivity rule auto-logs out
 * anyone whose lastHeartbeatAt goes 15 min stale (requirement #3). */
export async function heartbeat(): Promise<void> {
  const session = await dashboardAuth();
  const email = session?.user?.email;
  if (!email) return;

  await db.teamMember.updateMany({
    where: { email },
    data: { lastHeartbeatAt: new Date() },
  });
}
