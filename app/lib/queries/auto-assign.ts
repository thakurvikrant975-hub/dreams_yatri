import "server-only";
import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma";
import { getBoolSetting, SETTINGS_KEYS } from "@/app/lib/system-settings";

const ACTIVE_PIPELINE_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "FOLLOW_UP",
  "PACKAGE_SENT",
  "CLIENT_ACCEPTED",
  "CLIENT_DECLINED",
  "PAYMENT_INITIATED",
] as const;

export type AutoAssignResult =
  | { assigned: true; memberId: string; memberName: string }
  | { assigned: false; reason: string };

/**
 * Auto-assigns a freshly-created lead to the active Sales Executive currently
 * carrying the fewest active-pipeline leads. Ties (e.g. everyone at 0, or a
 * brand-new team) are broken by whoever was assigned longest ago — never
 * assigned counts as "longest ago" — so the rotation stays fair over time
 * instead of always landing on the same first member.
 */
export async function autoAssignLead(queryId: string): Promise<AutoAssignResult> {
  // Global on/off switch — controllable from /dashboard/queries. Defaults to
  // on so behavior is unchanged for anyone who never touches the toggle.
  const enabled = await getBoolSetting(SETTINGS_KEYS.autoAssignQueries, true);
  if (!enabled) {
    await db.queryTimeline.create({
      data: {
        queryId,
        event: "Auto-assignment skipped — turned off, awaiting manual assignment",
        actorName: "System",
      },
    });
    return { assigned: false, reason: "Auto-assign is turned off" };
  }

  const members = await db.teamMember.findMany({
    where: {
      teamRole: { name: { equals: "Sales Executive", mode: "insensitive" } },
      isActive: true,
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  if (members.length === 0) {
    await db.queryTimeline.create({
      data: {
        queryId,
        event: "Auto-assignment skipped — no active Sales Executive found",
        actorName: "System",
      },
    });
    return { assigned: false, reason: "No active Sales Executive found" };
  }

  const ids = members.map((m) => m.id);

  const [activeCounts, lastAssigned] = await Promise.all([
    db.package_queries.groupBy({
      by: ["assignedTo"],
      where: { assignedTo: { in: ids }, status: { in: [...ACTIVE_PIPELINE_STATUSES] } },
      _count: { id: true },
    }),
    db.package_queries.groupBy({
      by: ["assignedTo"],
      where: { assignedTo: { in: ids } },
      _max: { assignedAt: true },
    }),
  ]);

  const activeMap = new Map(activeCounts.map((c) => [c.assignedTo as string, c._count.id]));
  const lastMap = new Map(lastAssigned.map((c) => [c.assignedTo as string, c._max.assignedAt]));

  const ranked = members
    .map((m) => ({
      ...m,
      activeCount: activeMap.get(m.id) ?? 0,
      lastAssignedAt: lastMap.get(m.id) ?? null,
    }))
    .sort((a, b) => {
      if (a.activeCount !== b.activeCount) return a.activeCount - b.activeCount;
      const aTime = a.lastAssignedAt?.getTime() ?? 0;
      const bTime = b.lastAssignedAt?.getTime() ?? 0;
      return aTime - bTime; // never-assigned (0) or oldest wins the tie
    });

  const winner = ranked[0];

  await db.package_queries.update({
    where: { id: queryId },
    data: {
      assignedTo: winner.id,
      assignedAt: new Date(),
      assignedToName: winner.name,
      status: "ASSIGNED",
    },
  });

  await db.queryTimeline.create({
    data: {
      queryId,
      event: `Auto-assigned to ${winner.name} by system (round-robin — ${winner.activeCount} active lead${winner.activeCount !== 1 ? "s" : ""} at the time)`,
      actorName: "System",
      meta: {
        memberId: winner.id,
        memberName: winner.name,
        activeCountAtAssignment: winner.activeCount,
        strategy: "least-active-round-robin",
      } as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/dashboard/queries");
  revalidatePath("/dashboard/sales-query");

  return { assigned: true, memberId: winner.id, memberName: winner.name };
}
