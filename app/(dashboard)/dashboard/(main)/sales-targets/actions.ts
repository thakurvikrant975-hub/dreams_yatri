"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";
import { istYearMonth, istMonthBounds } from "@/app/lib/ist-window";

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

/** What actually landed this month — bookings CONFIRMED and their revenue,
 * scoped to the same (year, month) the target is set for, so the two numbers
 * sit side by side rather than the target page showing goals in a vacuum. */
export type AchievedValues = { bookings: number; revenue: number };

export type MemberTargetRow = {
  id: string;
  name: string;
  employeeId: string;
  roleName: string | null;
  target: TargetValues;
  achieved: AchievedValues;
};

export type TeamTargetRow = {
  id: string;
  name: string;
  leaderName: string | null;
  target: TargetValues;
  /** Sum of this team's own members' achieved figures — the team's target is
   * independent (see the member comment below), but what it actually booked
   * is only ever the roster's own numbers added up. */
  achieved: AchievedValues;
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
  /** Company-wide targets are the sum of each team's own target plus every
   * unassigned member's target — never a member sum inside a team, since a
   * team's target is set independently of its roster's individual ones. */
  companyTotals: { target: TargetValues; achieved: AchievedValues };
};

// ── Reads ─────────────────────────────────────────────────────────────────────

/** Rosters + this month's (or a chosen month's) existing targets, for the
 * Sales Manager's set-targets page — grouped team-wise, each team's own
 * executives nested under it, so the page reads the same way the org does
 * rather than as one flat list of names. Only "sales-ish" members show up —
 * Sales Executive, Team Leader, and anyone already on a SalesTeam — the same
 * population Sales Teams/analytics already treat as the sales org. */
export async function getSalesTargetsPageData(year: number, month: number): Promise<SalesTargetsPageData> {
  // Bookings are scoped to the calendar month being viewed, not necessarily
  // the current one — a manager reviewing last month's targets should see
  // last month's actual bookings, not this month's. Noon UTC keeps the probe
  // instant safely inside the IST calendar month regardless of date-line edge
  // cases at either boundary.
  const { start: monthStart, end: monthEnd } = istMonthBounds(new Date(Date.UTC(year, month - 1, 15, 12)));

  const [teams, unassignedMembers, memberTargets, teamTargets, bookingsGrouped] = await Promise.all([
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
    db.booking.groupBy({
      by: ["currentAssigneeId"],
      where: {
        status: "CONFIRMED",
        createdAt: { gte: monthStart, lte: monthEnd },
        currentAssigneeId: { not: null },
      },
      _count: { _all: true },
      _sum: { totalAmount: true },
    }),
  ]);

  const memberTargetById = new Map(memberTargets.map((t) => [t.teamMemberId as string, t]));
  const teamTargetById = new Map(teamTargets.map((t) => [t.salesTeamId as string, t]));
  const achievedByMember = new Map(bookingsGrouped.map((g) => [g.currentAssigneeId as string, g]));

  const toMemberRow = (m: { id: string; name: string; employeeId: string; teamRole: { name: string } | null }): MemberTargetRow => {
    const target = memberTargetById.get(m.id);
    const booking = achievedByMember.get(m.id);
    return {
      id: m.id,
      name: m.name,
      employeeId: m.employeeId,
      roleName: m.teamRole?.name ?? null,
      target: { revenueTarget: target?.revenueTarget ?? null, conversionTarget: target?.conversionTarget ?? null },
      achieved: { bookings: booking?._count._all ?? 0, revenue: Number(booking?._sum.totalAmount ?? 0) },
    };
  };

  const sumTarget = (rows: { target: TargetValues }[], key: keyof TargetValues) =>
    rows.reduce((s, r) => s + (r.target[key] ?? 0), 0);
  const sumAchieved = (rows: { achieved: AchievedValues }[], key: keyof AchievedValues) =>
    rows.reduce((s, r) => s + r.achieved[key], 0);

  const teamRows: TeamTargetRow[] = teams.map((t) => {
    const target = teamTargetById.get(t.id);
    const members = t.members.map(toMemberRow);
    return {
      id: t.id,
      name: t.name,
      leaderName: t.leader?.name ?? null,
      target: { revenueTarget: target?.revenueTarget ?? null, conversionTarget: target?.conversionTarget ?? null },
      achieved: { bookings: sumAchieved(members, "bookings"), revenue: sumAchieved(members, "revenue") },
      members,
    };
  });
  const unassignedRows = unassignedMembers.map(toMemberRow);

  return {
    year,
    month,
    teams: teamRows,
    unassigned: unassignedRows,
    companyTotals: {
      target: {
        revenueTarget: sumTarget(teamRows, "revenueTarget") + sumTarget(unassignedRows, "revenueTarget"),
        conversionTarget: sumTarget(teamRows, "conversionTarget") + sumTarget(unassignedRows, "conversionTarget"),
      },
      achieved: {
        revenue: sumAchieved(teamRows, "revenue") + sumAchieved(unassignedRows, "revenue"),
        bookings: sumAchieved(teamRows, "bookings") + sumAchieved(unassignedRows, "bookings"),
      },
    },
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
