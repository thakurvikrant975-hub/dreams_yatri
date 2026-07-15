"use server";

import { db } from "@/app/lib/db";
import { getCurrentMember } from "../../lib/get-current-member";

export type HotelDepartmentAnalytics = {
  totalAdded: number;
  activeAdded: number;
  inactiveAdded: number;
  byMember: { name: string; count: number }[];
};

const EMPTY_RESULT: HotelDepartmentAnalytics = {
  totalAdded: 0,
  activeAdded: 0,
  inactiveAdded: 0,
  byMember: [],
};

/**
 * Hotels aren't linked to team members by id — `created_by` is a free-text
 * name/email snapshot taken at creation time — so "added by this department"
 * is matched by joining that text against the department's CURRENT members.
 * A member who has since switched departments carries their past hotels with
 * their new department, since there's no historical record to do otherwise.
 */
export async function getHotelDepartmentAnalytics(
  departmentId: string,
  from: string | null,
  to: string | null,
): Promise<HotelDepartmentAnalytics> {
  // Only members of this same department (or a Full Stack Developer) may
  // query its analytics — enforced server-side, not just hidden in the UI.
  const member = await getCurrentMember();
  const isFsd = member?.teamRole?.name?.toLowerCase() === "full stack developer";
  if (!member || (!isFsd && member.department?.id !== departmentId)) {
    return EMPTY_RESULT;
  }

  const members = await db.teamMember.findMany({
    where: { departmentId },
    select: { name: true, email: true },
  });
  const identifiers = Array.from(new Set(members.flatMap(m => [m.name, m.email]).filter(Boolean)));
  if (identifiers.length === 0) return EMPTY_RESULT;

  const createdAtFilter: { gte?: Date; lte?: Date } = {};
  if (from) createdAtFilter.gte = new Date(`${from}T00:00:00.000Z`);
  if (to) createdAtFilter.lte = new Date(`${to}T23:59:59.999Z`);

  const hotelsInRange = await db.hotels.findMany({
    where: {
      created_by: { in: identifiers },
      ...(Object.keys(createdAtFilter).length > 0 ? { created_at: createdAtFilter } : {}),
    },
    select: { is_active: true, created_by: true },
  });

  const totalAdded = hotelsInRange.length;
  const activeAdded = hotelsInRange.filter(h => h.is_active).length;
  const inactiveAdded = totalAdded - activeAdded;

  const countByIdentifier = new Map<string, number>();
  for (const h of hotelsInRange) {
    if (!h.created_by) continue;
    countByIdentifier.set(h.created_by, (countByIdentifier.get(h.created_by) ?? 0) + 1);
  }

  const nameByIdentifier = new Map<string, string>();
  for (const m of members) {
    if (m.name) nameByIdentifier.set(m.name, m.name);
    if (m.email) nameByIdentifier.set(m.email, m.name || m.email);
  }

  const byMember = Array.from(countByIdentifier.entries())
    .map(([identifier, count]) => ({ name: nameByIdentifier.get(identifier) ?? identifier, count }))
    .sort((a, b) => b.count - a.count);

  return { totalAdded, activeAdded, inactiveAdded, byMember };
}
