import "server-only";
import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/app/generated/prisma";
import { getBoolSetting, SETTINGS_KEYS } from "@/app/lib/system-settings";
import { pickPartnerForLead } from "./partner-share";

export const ACTIVE_PIPELINE_STATUSES = [
  "ASSIGNED",
  "IN_PROGRESS",
  "FOLLOW_UP",
  "PACKAGE_SENT",
  "CLIENT_ACCEPTED",
  "CLIENT_DECLINED",
  "PAYMENT_INITIATED",
] as const;

export type AutoAssignResult =
  | { assigned: true; memberId: string; memberName: string; partner?: boolean }
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

  /*
   * Some leads are sold on rather than worked in-house, and this is where
   * that fork happens — before the team rotation, because whether a lead is
   * the agency's is decided by their pacing and not by how loaded our own
   * executives happen to be.
   *
   * Everything about it is the lead manager's to set, and it does nothing at
   * all until they set a daily cap. A lead that does not qualify, or simply
   * is not the one the pacing lands on, falls straight through to the team
   * below — as does any failure here: an agency lookup going wrong must never
   * cost us a lead.
   */
  try {
    const lead = await db.package_queries.findUnique({
      where: { id: queryId },
      select: { id: true, groupSize: true, destination: true, source: true, createdAt: true },
    });
    if (lead) {
      const partner = await pickPartnerForLead(lead);
      if (partner) {
        await db.package_queries.update({
          where: { id: queryId },
          data: {
            assignedTo: partner.memberId,
            assignedAt: new Date(),
            assignedToName: partner.memberName,
            status: "ASSIGNED",
          },
        });
        await db.queryTimeline.create({
          data: {
            queryId,
            event: `Auto-assigned to partner agency ${partner.memberName}`,
            actorName: "System",
          },
        });
        revalidatePath("/dashboard/queries");
        revalidatePath("/dashboard/sales-query");
        return { assigned: true, memberId: partner.memberId, memberName: partner.memberName, partner: true };
      }
    }
  } catch (e) {
    console.error("[autoAssignLead] partner share failed, keeping the lead in-house:", e);
  }

  const members = await db.teamMember.findMany({
    where: {
      teamRole: { name: { equals: "Sales Executive", mode: "insensitive" } },
      isActive: true,
      // Independent of isActive — see the field's own doc comment. Filtered
      // in the query (not after) so a member who's opted out never even
      // shows up in "no eligible member" diagnostics below as a false lead.
      autoAssignActive: true,
    },
    select: { id: true, name: true, autoAssignMin: true, autoAssignMax: true },
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

  const ranked = members.map((m) => ({
    ...m,
    activeCount: activeMap.get(m.id) ?? 0,
    lastAssignedAt: lastMap.get(m.id) ?? null,
  }));

  // A member at (or past) their own ceiling drops out of the rotation
  // entirely until something moves off their pipeline — never overridden,
  // regardless of everyone else's load.
  const eligible = ranked.filter((m) => m.autoAssignMax == null || m.activeCount < m.autoAssignMax);

  if (eligible.length === 0) {
    await db.queryTimeline.create({
      data: {
        queryId,
        event: "Auto-assignment skipped — every Sales Executive is at their auto-assign limit",
        actorName: "System",
      },
    });
    return { assigned: false, reason: "Every Sales Executive is at their auto-assign limit" };
  }

  const sortByLeastLoaded = (a: (typeof eligible)[number], b: (typeof eligible)[number]) => {
    if (a.activeCount !== b.activeCount) return a.activeCount - b.activeCount;
    const aTime = a.lastAssignedAt?.getTime() ?? 0;
    const bTime = b.lastAssignedAt?.getTime() ?? 0;
    return aTime - bTime; // never-assigned (0) or oldest wins the tie
  };

  // Anyone still under their own floor is filled up to it first — the
  // ordinary least-loaded round robin only takes over once every member
  // who set one has actually reached it. Without this split, a member
  // with a floor set today but zero leads could still lose every tie to
  // someone else who merely has fewer ACTIVE leads right now.
  const underMin = eligible.filter((m) => m.autoAssignMin != null && m.activeCount < m.autoAssignMin);
  const pool = (underMin.length > 0 ? underMin : eligible).slice().sort(sortByLeastLoaded);

  const winner = pool[0];
  const winnerWasUnderMin = underMin.some((m) => m.id === winner.id);

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
      event: winnerWasUnderMin
        ? `Auto-assigned to ${winner.name} by system (below their ${winner.autoAssignMin}-lead floor — ${winner.activeCount} active lead${winner.activeCount !== 1 ? "s" : ""} at the time)`
        : `Auto-assigned to ${winner.name} by system (round-robin — ${winner.activeCount} active lead${winner.activeCount !== 1 ? "s" : ""} at the time)`,
      actorName: "System",
      meta: {
        memberId: winner.id,
        memberName: winner.name,
        activeCountAtAssignment: winner.activeCount,
        strategy: winnerWasUnderMin ? "min-floor-priority" : "least-active-round-robin",
      } as Prisma.InputJsonValue,
    },
  });

  revalidatePath("/dashboard/queries");
  revalidatePath("/dashboard/sales-query");

  return { assigned: true, memberId: winner.id, memberName: winner.name };
}
