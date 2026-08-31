import "server-only";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";

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

export async function getLeaderScope(): Promise<LeaderScope | null> {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;

  const me = await db.teamMember.findUnique({
    where: { email: session.user.email },
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
