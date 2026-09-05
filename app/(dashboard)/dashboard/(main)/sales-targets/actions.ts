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
  memberCount: number;
  target: TargetValues;
};

export type SalesTargetsPageData = {
  year: number;
  month: number;
  teams: TeamTargetRow[];
  /** Every active sales-side member — team leaders included, since a leader
   * is also a normal member of their own team (see SalesTeam's doc comment)
   * — so a Sales Manager can set an individual target for anyone, whether
   * or not they're on a team yet. */
  members: MemberTargetRow[];
};

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Rosters + this month's (or a chosen month's) existing targets, for the
 * Sales Manager's set-targets page. Only "sales-ish" members are listed —
 * Sales Executive, Team Leader, and anyone already on a SalesTeam — the same
 * population Sales Teams/analytics already treat as the sales org, so this
 * page doesn't ask a manager to set a target for e.g. an Ops or Hotel
 * Department member who happens to have no team. */
export async function getSalesTargetsPageData(year: number, month: number): Promise<SalesTargetsPageData> {
  const [teams, members, memberTargets, teamTargets] = await Promise.all([
    db.salesTeam.findMany({
      include: {
        leader: { select: { id: true, name: true } },
        members: { select: { id: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.teamMember.findMany({
      where: {
        isActive: true,
        OR: [
          { salesTeamId: { not: null } },
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

  return {
    year,
    month,
    teams: teams.map((t) => {
      const target = teamTargetById.get(t.id);
      return {
        id: t.id,
        name: t.name,
        leaderName: t.leader?.name ?? null,
        memberCount: t.members.length,
        target: { revenueTarget: target?.revenueTarget ?? null, conversionTarget: target?.conversionTarget ?? null },
      };
    }),
    members: members.map((m) => {
      const target = memberTargetById.get(m.id);
      return {
        id: m.id,
        name: m.name,
        employeeId: m.employeeId,
        roleName: m.teamRole?.name ?? null,
        target: { revenueTarget: target?.revenueTarget ?? null, conversionTarget: target?.conversionTarget ?? null },
      };
    }),
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
    await db.salesTarget.upsert({
      where: { teamMemberId_year_month: { teamMemberId, year, month } },
      create: { teamMemberId, year, month, revenueTarget, conversionTarget, setById: user.id, setByName: user.name ?? null },
      update: { revenueTarget, conversionTarget, setById: user.id, setByName: user.name ?? null },
    });

    await createLog({
      action: "UPDATE", entity: "SalesTarget", entityId: teamMemberId,
      newData: { year, month, revenueTarget, conversionTarget },
      metadata: { operation: "set_member_target" }, severity: "LOW",
    });

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
    await db.salesTarget.upsert({
      where: { salesTeamId_year_month: { salesTeamId, year, month } },
      create: { salesTeamId, year, month, revenueTarget, conversionTarget, setById: user.id, setByName: user.name ?? null },
      update: { revenueTarget, conversionTarget, setById: user.id, setByName: user.name ?? null },
    });

    await createLog({
      action: "UPDATE", entity: "SalesTarget", entityId: salesTeamId,
      newData: { year, month, revenueTarget, conversionTarget },
      metadata: { operation: "set_team_target" }, severity: "LOW",
    });

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
