"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";
import { istYearMonth } from "@/app/lib/ist-window";

// ── Auth helper ───────────────────────────────────────────────────────────────
// Mirrors sales-teams/actions.ts — the current actor is the logged-in
// TeamMember (dashboardAuth), not the public-site User session.

async function getAuthenticatedUser() {
  const session = await dashboardAuth();
  if (!session?.user?.id) return null;
  return session.user;
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// ── Types ─────────────────────────────────────────────────────────────────────

export type TargetValues = { revenueTarget: number | null; conversionTarget: number | null };

export type MemberTargetRow = {
  id: string;
  name: string;
  employeeId: string;
  roleName: string | null;
  target: TargetValues;
};

export type TeamTargetRow = {
  id: string;
  name: string;
  leaderName: string | null;
  target: TargetValues;
  /** This team's own roster, grouped here rather than in a separate flat
   * list — the leader is included (a SalesTeam leader is also a normal
   * member of their own team, see the model's doc comment). */
  members: MemberTargetRow[];
};

export type SalesTargetsPageData = {
  year: number;
  month: number;
  teams: TeamTargetRow[];
  /** Sales-ish members (Sales Executive / Team Leader by role, or already
   * assigned once) who aren't currently on any SalesTeam — kept as its own
   * group rather than folded into a team so a manager can still set their
   * individual target before they're placed on a team. */
  unassigned: MemberTargetRow[];
};

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Rosters + this month's (or a chosen month's) existing targets, for the
 * Sales Manager's set-targets page — grouped team-wise, each team's own
 * executives nested under it, so the page reads the same way the org does
 * rather than as one flat list of names. Only "sales-ish" members show up —
 * Sales Executive, Team Leader, and anyone already on a SalesTeam — the same
 * population Sales Teams/analytics already treat as the sales org. */
export async function getSalesTargetsPageData(year: number, month: number): Promise<SalesTargetsPageData> {
  const [teams, unassignedMembers, memberTargets, teamTargets] = await Promise.all([
    db.salesTeam.findMany({
      include: {
        leader: { select: { id: true, name: true } },
        members: { select: { id: true, name: true, employeeId: true, teamRole: { select: { name: true } } } },
      },
      orderBy: { name: "asc" },
    }),
    db.teamMember.findMany({
      where: {
        isActive: true,
        salesTeamId: null,
        OR: [
          { teamRole: { name: { contains: "sales", mode: "insensitive" } } },
          { teamRole: { name: { contains: "team leader", mode: "insensitive" } } },
        ],
      },
      select: { id: true, name: true, employeeId: true, teamRole: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
    db.salesTarget.findMany({ where: { year, month, teamMemberId: { not: null } } }),
    db.salesTarget.findMany({ where: { year, month, salesTeamId: { not: null } } }),
  ]);

  const memberTargetById = new Map(memberTargets.map((t) => [t.teamMemberId as string, t]));
  const teamTargetById = new Map(teamTargets.map((t) => [t.salesTeamId as string, t]));

  const toMemberRow = (m: { id: string; name: string; employeeId: string; teamRole: { name: string } | null }): MemberTargetRow => {
    const target = memberTargetById.get(m.id);
    return {
      id: m.id,
      name: m.name,
      employeeId: m.employeeId,
      roleName: m.teamRole?.name ?? null,
      target: { revenueTarget: target?.revenueTarget ?? null, conversionTarget: target?.conversionTarget ?? null },
    };
  };

  return {
    year,
    month,
    teams: teams.map((t) => {
      const target = teamTargetById.get(t.id);
      return {
        id: t.id,
        name: t.name,
        leaderName: t.leader?.name ?? null,
        target: { revenueTarget: target?.revenueTarget ?? null, conversionTarget: target?.conversionTarget ?? null },
        members: t.members.map(toMemberRow),
      };
    }),
    unassigned: unassignedMembers.map(toMemberRow),
  };
}

/** A member's own target for the current IST month, plus the team target if
 * they're on a SalesTeam — read side for "everyone sees their own target",
 * used by the individual dashboard/badge rather than the manager's page. */
export async function getOwnSalesTarget(memberId: string): Promise<{
  member: TargetValues;
  team: (TargetValues & { teamName: string }) | null;
}> {
  const { year, month } = istYearMonth();

  const member = await db.teamMember.findUnique({
    where: { id: memberId },
    select: { salesTeamId: true, salesTeam: { select: { name: true } } },
  });

  const [memberTarget, teamTarget] = await Promise.all([
    db.salesTarget.findUnique({
      where: { teamMemberId_year_month: { teamMemberId: memberId, year, month } },
    }),
    member?.salesTeamId
      ? db.salesTarget.findUnique({
          where: { salesTeamId_year_month: { salesTeamId: member.salesTeamId, year, month } },
        })
      : Promise.resolve(null),
  ]);

  return {
    member: { revenueTarget: memberTarget?.revenueTarget ?? null, conversionTarget: memberTarget?.conversionTarget ?? null },
    team: member?.salesTeam
      ? {
          teamName: member.salesTeam.name,
          revenueTarget: teamTarget?.revenueTarget ?? null,
          conversionTarget: teamTarget?.conversionTarget ?? null,
        }
      : null,
  };
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const TargetSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  revenueTarget: z.number().min(0).nullable(),
  conversionTarget: z.number().int().min(0).nullable(),
});

export async function setMemberTarget(
  teamMemberId: string,
  input: z.infer<typeof TargetSchema>,
): Promise<Result<null>> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = TargetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { year, month, revenueTarget, conversionTarget } = parsed.data;

  try {
    const existing = await db.salesTarget.findUnique({
      where: { teamMemberId_year_month: { teamMemberId, year, month } },
      select: { revenueTarget: true, conversionTarget: true },
    });

    await db.salesTarget.upsert({
      where: { teamMemberId_year_month: { teamMemberId, year, month } },
      create: { teamMemberId, year, month, revenueTarget, conversionTarget, setById: user.id, setByName: user.name ?? null },
      update: { revenueTarget, conversionTarget, setById: user.id, setByName: user.name ?? null },
    });

    // Only worth a history entry when a value actually moved — every field
    // blur calls save(), including one where nothing was typed, and a "12
    // -> 12" line would be noise in the timeline rather than history.
    if (!existing || existing.revenueTarget !== revenueTarget || existing.conversionTarget !== conversionTarget) {
      const member = await db.teamMember.findUnique({ where: { id: teamMemberId }, select: { name: true } });
      await createLog({
        action: "UPDATE", entity: "SalesTarget", entityId: teamMemberId, entitySlug: member?.name ?? undefined,
        previousData: { revenueTarget: existing?.revenueTarget ?? null, conversionTarget: existing?.conversionTarget ?? null },
        newData: { revenueTarget, conversionTarget },
        metadata: { operation: "set_member_target", year, month, subjectName: member?.name ?? null },
        severity: "LOW",
      });
    }

    revalidatePath("/dashboard/sales-targets");
    revalidatePath("/dashboard/analytics");
    revalidatePath("/dashboard");
    return { success: true, data: null };
  } catch (err: unknown) {
    await createLog({
      action: "UPDATE", entity: "SalesTarget", entityId: teamMemberId, status: "FAILED",
      errorMessage: String(err), severity: "MEDIUM", metadata: { operation: "set_member_target" },
    });
    return { success: false, error: "Failed to set target" };
  }
}

export async function setTeamTarget(
  salesTeamId: string,
  input: z.infer<typeof TargetSchema>,
): Promise<Result<null>> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = TargetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };
  const { year, month, revenueTarget, conversionTarget } = parsed.data;

  try {
    const existing = await db.salesTarget.findUnique({
      where: { salesTeamId_year_month: { salesTeamId, year, month } },
      select: { revenueTarget: true, conversionTarget: true },
    });

    await db.salesTarget.upsert({
      where: { salesTeamId_year_month: { salesTeamId, year, month } },
      create: { salesTeamId, year, month, revenueTarget, conversionTarget, setById: user.id, setByName: user.name ?? null },
      update: { revenueTarget, conversionTarget, setById: user.id, setByName: user.name ?? null },
    });

    if (!existing || existing.revenueTarget !== revenueTarget || existing.conversionTarget !== conversionTarget) {
      const team = await db.salesTeam.findUnique({ where: { id: salesTeamId }, select: { name: true } });
      await createLog({
        action: "UPDATE", entity: "SalesTarget", entityId: salesTeamId, entitySlug: team?.name ?? undefined,
        previousData: { revenueTarget: existing?.revenueTarget ?? null, conversionTarget: existing?.conversionTarget ?? null },
        newData: { revenueTarget, conversionTarget },
        metadata: { operation: "set_team_target", year, month, subjectName: team?.name ?? null },
        severity: "LOW",
      });
    }

    revalidatePath("/dashboard/sales-targets");
    revalidatePath("/dashboard/analytics");
    return { success: true, data: null };
  } catch (err: unknown) {
    await createLog({
      action: "UPDATE", entity: "SalesTarget", entityId: salesTeamId, status: "FAILED",
      errorMessage: String(err), severity: "MEDIUM", metadata: { operation: "set_team_target" },
    });
    return { success: false, error: "Failed to set team target" };
  }
}

// ── History ───────────────────────────────────────────────────────────────────

export type TargetHistoryEntry = {
  id: string;
  changedByName: string | null;
  changedAt: Date;
  previousRevenueTarget: number | null;
  newRevenueTarget: number | null;
  previousConversionTarget: number | null;
  newConversionTarget: number | null;
};

/** Every change to one subject's (member or team) target for one month, most
 * recent first — reuses the same ActivityLog every other mutation in this
 * app already writes to, rather than a bespoke history table, since it
 * already captures who/when and a before/after diff. */
export async function getTargetHistory(subjectId: string, year: number, month: number): Promise<TargetHistoryEntry[]> {
  const logs = await db.activityLog.findMany({
    where: { entity: "SalesTarget", entityId: subjectId, status: "SUCCESS" },
    orderBy: { actionAt: "desc" },
    take: 50,
    select: { id: true, userName: true, actionAt: true, previousData: true, newData: true, metadata: true },
  });

  return logs
    .filter((l) => {
      const meta = l.metadata as { year?: number; month?: number } | null;
      return meta?.year === year && meta?.month === month;
    })
    .map((l) => {
      const prev = (l.previousData as { revenueTarget?: number | null; conversionTarget?: number | null } | null) ?? {};
      const next = (l.newData as { revenueTarget?: number | null; conversionTarget?: number | null } | null) ?? {};
      return {
        id: l.id,
        changedByName: l.userName,
        changedAt: l.actionAt,
        previousRevenueTarget: prev.revenueTarget ?? null,
        newRevenueTarget: next.revenueTarget ?? null,
        previousConversionTarget: prev.conversionTarget ?? null,
        newConversionTarget: next.conversionTarget ?? null,
      };
    });
}
