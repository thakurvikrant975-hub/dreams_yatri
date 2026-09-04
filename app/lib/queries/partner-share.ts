import "server-only";
import { db } from "@/app/lib/db";
import { istDayBounds } from "@/app/lib/ist-window";
import type { QuerySource } from "@/app/generated/prisma";
import { leadQualifies, fallsOnThisLead } from "./partner-rules";

export { leadQualifies, fallsOnThisLead } from "./partner-rules";

/**
 * Deciding whether the lead in hand is one we sell.
 *
 * An agency sits in the same rotation as our own executives but is not picked
 * the same way: an exec is chosen by who is least loaded, an agency by a pace
 * the lead manager sets — so many a day, spread across the day, and only from
 * the leads they judge suitable. This is the whole of that decision.
 */

export type PartnerPick = { memberId: string; memberName: string };

type Lead = {
  id: string;
  groupSize: number | null;
  destination: string | null;
  source: QuerySource;
  createdAt: Date;
};

/**
 * The agency this lead should go to, or null for "keep it in-house".
 *
 * Null is the answer for every ordinary reason — no agency configured, none
 * with a cap set, the lead does not qualify, the day's allowance is spent, or
 * simply that this is not the lead their pacing lands on.
 */
export async function pickPartnerForLead(lead: Lead): Promise<PartnerPick | null> {
  const partners = await db.teamMember.findMany({
    where: {
      isActive: true,
      autoAssignActive: true,
      teamRole: { isPartnerAgency: true },
      partnerLeadRule: { dailyCap: { gt: 0 } },
    },
    select: { id: true, name: true, partnerLeadRule: true },
  });
  if (partners.length === 0) return null;

  const { start, end } = istDayBounds();

  for (const partner of partners) {
    const rule = partner.partnerLeadRule;
    if (!rule) continue;
    if (!leadQualifies(lead, rule)) continue;

    const givenToday = await db.package_queries.count({
      where: { assignedTo: partner.id, deletedAt: null, assignedAt: { gte: start, lte: end } },
    });
    if (givenToday >= rule.dailyCap) continue;

    // Where this lead sits in the run since their last one. Counted from the
    // lead's own arrival rather than a stored tally, so nothing can drift.
    const previous = await db.package_queries.findFirst({
      where: { assignedTo: partner.id, deletedAt: null },
      orderBy: { assignedAt: "desc" },
      select: { createdAt: true },
    });
    const since = previous?.createdAt ?? start;
    const position = await db.package_queries.count({
      where: { deletedAt: null, createdAt: { gt: since, lte: lead.createdAt } },
    });

    if (fallsOnThisLead(position, rule.gapMin, rule.gapMax)) {
      return { memberId: partner.id, memberName: partner.name };
    }
  }

  return null;
}
