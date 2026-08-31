"use server";

import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";

export type MyTeamMember = {
  id: string;
  name: string;
  employeeId: string;
  isActive: boolean;
  designation: string | null;
  profilePicUrl: string | null;
  joiningDate: Date | null;
  roleName: string | null;
};

export type MyTeam = {
  id: string;
  name: string;
  leader: { id: string; name: string } | null;
  members: MyTeamMember[];
};

/** The logged-in member's own sales team — read-only here, same data shape
 * SalesTeamsTableClient shows, but scoped to whichever team this member
 * belongs to (leader or not) rather than every team. Membership/leader
 * assignment is Sales Manager territory (see sales-teams/actions.ts) —
 * this page has no mutations. */
export async function getMyTeam(): Promise<MyTeam | null> {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;

  const me = await db.teamMember.findUnique({
    where: { email: session.user.email },
    select: {
      salesTeam: {
        select: {
          id: true,
          name: true,
          leader: { select: { id: true, name: true } },
          members: {
            select: {
              id: true, name: true, employeeId: true, isActive: true,
              designation: true, profilePicUrl: true, joiningDate: true,
              teamRole: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!me?.salesTeam) return null;

  return {
    ...me.salesTeam,
    members: me.salesTeam.members.map((m) => ({
      id: m.id,
      name: m.name,
      employeeId: m.employeeId,
      isActive: m.isActive,
      designation: m.designation,
      profilePicUrl: m.profilePicUrl,
      joiningDate: m.joiningDate,
      roleName: m.teamRole?.name ?? null,
    })),
  };
}
