"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";

// ── Auth helper ───────────────────────────────────────────────────────────────
// Mirrors team-members/actions.ts — the current actor is the logged-in
// TeamMember (dashboardAuth), not the public-site User session.

async function getAuthenticatedUser() {
  const session = await dashboardAuth();
  if (!session?.user?.id) return null;
  return session.user;
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateSalesTeamSchema = z.object({
  name: z.string().min(2).max(100),
});

const RenameSalesTeamSchema = z.object({
  id: z.string(),
  name: z.string().min(2).max(100),
});

const SetLeaderSchema = z.object({
  teamId: z.string(),
  leaderId: z.string().nullable(),
});

const SetMembersSchema = z.object({
  teamId: z.string(),
  memberIds: z.array(z.string()),
});

// ── Public types ──────────────────────────────────────────────────────────────

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type SalesTeamMemberSummary = {
  id: string;
  name: string;
  employeeId: string;
  isActive: boolean;
};

export type SalesTeamOverview = {
  id: string;
  name: string;
  leader: { id: string; name: string; employeeId: string } | null;
  members: SalesTeamMemberSummary[];
  memberCount: number;
};

export type EligibleMember = {
  id: string;
  name: string;
  employeeId: string;
  roleName: string | null;
  currentTeam: { id: string; name: string } | null;
};

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getSalesTeamsOverview(): Promise<SalesTeamOverview[]> {
  const teams = await db.salesTeam.findMany({
    include: {
      leader: { select: { id: true, name: true, employeeId: true } },
      members: { select: { id: true, name: true, employeeId: true, isActive: true } },
    },
    orderBy: { name: "asc" },
  });

  return teams.map((t) => ({
    id: t.id,
    name: t.name,
    leader: t.leader,
    members: t.members,
    memberCount: t.members.length,
  }));
}

export async function getEligibleMembersForSelect(): Promise<EligibleMember[]> {
  const members = await db.teamMember.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      employeeId: true,
      teamRole: { select: { name: true } },
      salesTeam: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  return members.map((m) => ({
    id: m.id,
    name: m.name,
    employeeId: m.employeeId,
    roleName: m.teamRole?.name ?? null,
    currentTeam: m.salesTeam,
  }));
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createSalesTeam(
  input: z.infer<typeof CreateSalesTeamSchema>
): Promise<Result<{ id: string }>> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = CreateSalesTeamSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  try {
    const created = await db.salesTeam.create({
      data: { name: parsed.data.name, createdById: user.id },
      select: { id: true },
    });

    await createLog({ action: "CREATE", entity: "SalesTeam", entityId: created.id, newData: { name: parsed.data.name }, severity: "LOW" });

    revalidatePath("/dashboard/sales-teams");
    return { success: true, data: { id: created.id } };
  } catch (err: unknown) {
    await createLog({ action: "CREATE", entity: "SalesTeam", status: "FAILED", errorMessage: String(err), severity: "MEDIUM" });

    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return { success: false, error: `Team name '${parsed.data.name}' is already taken` };
    }
    return { success: false, error: "Failed to create team" };
  }
}

export async function renameSalesTeam(
  input: z.infer<typeof RenameSalesTeamSchema>
): Promise<Result<null>> {
  await getAuthenticatedUser();

  const parsed = RenameSalesTeamSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, name } = parsed.data;
  const previous = await db.salesTeam.findUnique({ where: { id }, select: { name: true } });

  try {
    await db.salesTeam.update({ where: { id }, data: { name } });

    await createLog({ action: "UPDATE", entity: "SalesTeam", entityId: id, previousData: previous ?? undefined, newData: { name }, metadata: { operation: "rename" }, severity: "LOW" });

    revalidatePath("/dashboard/sales-teams");
    return { success: true, data: null };
  } catch (err: unknown) {
    await createLog({ action: "UPDATE", entity: "SalesTeam", entityId: id, status: "FAILED", errorMessage: String(err), severity: "MEDIUM", metadata: { operation: "rename" } });

    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return { success: false, error: `Team name '${name}' is already taken` };
    }
    return { success: false, error: "Failed to rename team" };
  }
}

export async function setTeamLeader(
  input: z.infer<typeof SetLeaderSchema>
): Promise<Result<null>> {
  await getAuthenticatedUser();

  const parsed = SetLeaderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { teamId, leaderId } = parsed.data;
  const previous = await db.salesTeam.findUnique({ where: { id: teamId }, select: { leaderId: true } });

  try {
    await db.$transaction(async (tx) => {
      await tx.salesTeam.update({ where: { id: teamId }, data: { leaderId } });
      // Auto-include the leader as a member of their own team (and move them
      // off any other team they were on) so analytics can always treat
      // `team.members` as the complete roster, with no leader special-casing.
      if (leaderId) {
        await tx.teamMember.update({ where: { id: leaderId }, data: { salesTeamId: teamId } });
      }
    });

    await createLog({ action: "UPDATE", entity: "SalesTeam", entityId: teamId, previousData: previous ?? undefined, newData: { leaderId }, metadata: { operation: "set_leader" }, severity: "LOW" });

    revalidatePath("/dashboard/sales-teams");
    return { success: true, data: null };
  } catch (err: unknown) {
    await createLog({ action: "UPDATE", entity: "SalesTeam", entityId: teamId, status: "FAILED", errorMessage: String(err), severity: "MEDIUM", metadata: { operation: "set_leader" } });
    return { success: false, error: "Failed to set team leader" };
  }
}

export async function setTeamMembers(
  input: z.infer<typeof SetMembersSchema>
): Promise<Result<null>> {
  await getAuthenticatedUser();

  const parsed = SetMembersSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { teamId, memberIds } = parsed.data;

  const team = await db.salesTeam.findUnique({ where: { id: teamId }, select: { leaderId: true } });
  if (!team) return { success: false, error: "Team not found" };
  if (team.leaderId && !memberIds.includes(team.leaderId)) {
    return { success: false, error: "Remove the leader first before dropping them from the team" };
  }

  try {
    await db.$transaction([
      db.teamMember.updateMany({
        where: { salesTeamId: teamId, id: { notIn: memberIds } },
        data: { salesTeamId: null },
      }),
      db.teamMember.updateMany({
        where: { id: { in: memberIds } },
        data: { salesTeamId: teamId },
      }),
    ]);

    await createLog({ action: "UPDATE", entity: "SalesTeam", entityId: teamId, newData: { memberIds }, metadata: { operation: "set_members" }, severity: "LOW" });

    revalidatePath("/dashboard/sales-teams");
    return { success: true, data: null };
  } catch (err: unknown) {
    await createLog({ action: "UPDATE", entity: "SalesTeam", entityId: teamId, status: "FAILED", errorMessage: String(err), severity: "MEDIUM", metadata: { operation: "set_members" } });
    return { success: false, error: "Failed to update team members" };
  }
}

export async function removeMember(teamId: string, memberId: string): Promise<Result<null>> {
  await getAuthenticatedUser();

  const team = await db.salesTeam.findUnique({ where: { id: teamId }, select: { leaderId: true } });
  if (!team) return { success: false, error: "Team not found" };
  if (team.leaderId === memberId) {
    return { success: false, error: "Remove the leader first before dropping them from the team" };
  }

  try {
    await db.teamMember.update({ where: { id: memberId }, data: { salesTeamId: null } });

    await createLog({ action: "UPDATE", entity: "SalesTeam", entityId: teamId, newData: { removedMemberId: memberId }, metadata: { operation: "remove_member" }, severity: "LOW" });

    revalidatePath("/dashboard/sales-teams");
    return { success: true, data: null };
  } catch (err: unknown) {
    await createLog({ action: "UPDATE", entity: "SalesTeam", entityId: teamId, status: "FAILED", errorMessage: String(err), severity: "MEDIUM", metadata: { operation: "remove_member" } });
    return { success: false, error: "Failed to remove member" };
  }
}

export async function deleteSalesTeam(id: string): Promise<Result<null>> {
  const target = await db.salesTeam.findUnique({ where: { id }, select: { name: true } });

  try {
    await db.$transaction([
      db.teamMember.updateMany({ where: { salesTeamId: id }, data: { salesTeamId: null } }),
      db.salesTeam.delete({ where: { id } }),
    ]);

    await createLog({ action: "DELETE", entity: "SalesTeam", entityId: id, previousData: target ?? undefined, severity: "MEDIUM" });

    revalidatePath("/dashboard/sales-teams");
    return { success: true, data: null };
  } catch (err: unknown) {
    await createLog({ action: "DELETE", entity: "SalesTeam", entityId: id, status: "FAILED", errorMessage: String(err), severity: "MEDIUM" });
    return { success: false, error: "Failed to delete team" };
  }
}
