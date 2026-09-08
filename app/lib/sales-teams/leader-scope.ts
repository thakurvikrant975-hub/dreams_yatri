import "server-only";
import { db } from "@/app/lib/db";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";

export type LeaderScope = {
  actorId: string;
  actorName: string;
  /** The id of the SalesTeam this member leads, or null if they don't lead
   * one. The single source of truth for "can this Team Leader act on this
   * submission" across the Package Templates and Activity Templates review
   * queues — a leader may only approve/reject/edit a submission whose
   * submittedByTeamId matches this; everything else is read-only to them. */
  ledTeamId: string | null;
};

/** Resolves against the effective member (the FSD's "View As" target, if any)
 * rather than the raw session — so an FSD viewing as a Team Leader sees that
 * leader's own scope instead of their own (real) one. See getEffectiveMember. */
export async function getLeaderScope(): Promise<LeaderScope | null> {
  const effective = await getEffectiveMember();
  if (!effective) return null;

  const me = await db.teamMember.findUnique({
    where: { id: effective.member.id },
    select: { id: true, name: true, ledSalesTeam: { select: { id: true } } },
  });
  if (!me) return null;

  return { actorId: me.id, actorName: me.name, ledTeamId: me.ledSalesTeam?.id ?? null };
}

/** The submitter's own current team — snapshotted onto the template at
 * submit time so review-queue authorization survives the submitter later
 * being moved to a different team. */
export async function getSubmitterTeam(memberId: string): Promise<{ teamId: string | null; teamName: string | null }> {
  const member = await db.teamMember.findUnique({
    where: { id: memberId },
    select: { salesTeamId: true, salesTeam: { select: { name: true } } },
  });
  return { teamId: member?.salesTeamId ?? null, teamName: member?.salesTeam?.name ?? null };
}

/** Who gets to see what in the Team Packages / Team Hotel Requests queues —
 * "team" (a Team Leader, scoped to the SalesTeam they lead), "company" (a
 * Sales Manager, no scoping — same "see everyone's" access they already
 * have inside workspace-caps.ts, just extended to these two list pages), or
 * "none" (role doesn't match either, or a Team Leader not currently leading
 * a team). Role is matched the same case-insensitive substring way as
 * workspace-caps.ts's workspaceRoleOf, so this stays in sync with who
 * actually gets costing-grade edit rights once they open a package. */
export type PackageReviewScope =
  | { kind: "team"; teamId: string; teamName: string; memberIds: string[] }
  | { kind: "company" }
  | { kind: "none" };

/** True when the signed-in member's role name contains "sales manager" —
 * same case-insensitive substring match getPackageReviewScope already uses
 * for its own "company" scope, so a role rename or new "Senior Sales
 * Manager"-style variant stays in sync across every feature that checks
 * for this role instead of drifting between separate exact-match lists. */
export async function isSalesManagerRole(): Promise<boolean> {
  const effective = await getEffectiveMember();
  return (effective?.member.teamRole?.name ?? "").trim().toLowerCase().includes("sales manager");
}

export async function getPackageReviewScope(): Promise<PackageReviewScope> {
  const effective = await getEffectiveMember();
  if (!effective) return { kind: "none" };

  const roleName = (effective.member.teamRole?.name ?? "").trim().toLowerCase();

  if (roleName.includes("sales manager")) return { kind: "company" };

  if (roleName.includes("team leader")) {
    const scope = await getLeaderScope();
    if (!scope?.ledTeamId) return { kind: "none" };
    const team = await db.salesTeam.findUnique({
      where: { id: scope.ledTeamId },
      select: { id: true, name: true, members: { select: { id: true } } },
    });
    if (!team) return { kind: "none" };
    return { kind: "team", teamId: team.id, teamName: team.name, memberIds: team.members.map((m) => m.id) };
  }

  return { kind: "none" };
}
