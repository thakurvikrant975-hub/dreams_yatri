"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { createLog } from "../lib/logger";

const PAGE_SIZE = 10;

const CreateTeamMemberSchema = z.object({
  name: z.string().min(2).max(255),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  departmentId: z.string().optional().nullable(),
  roleId: z.string().optional().nullable(),
  joiningDate: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial().extend({
  id: z.string(),
  password: z.string().min(8).max(72).optional(),
});

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type TeamMember = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  joiningDate: Date | null;
  createdAt: Date;
  department: { id: string; name: string } | null;
  role: { id: string; name: string } | null;
};

export type PaginatedMembers = {
  members: TeamMember[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ── Reads — NO logs needed ────────────────────────────────────────────────────

export async function getTeamMembersPaginated(page = 1): Promise<PaginatedMembers> {
  const skip = (page - 1) * PAGE_SIZE;

  const [raw, total] = await Promise.all([
    db.teamMember.findMany({
      skip,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      include: {
        department: { select: { id: true, name: true } },
        teamRole: { select: { id: true, name: true } },
      },
    }),
    db.teamMember.count(),
  ]);

  const members: TeamMember[] = raw.map(({ teamRole, ...m }) => ({
    ...m,
    role: teamRole,
  }));

  return { members, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
}

export async function getDepartmentsForSelect() {
  return db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function getMemberPassword(memberId: string): Promise<Result<{ password: string }>> {
  try {
    const member = await db.teamMember.findUnique({
      where: { id: memberId },
      select: { password: true },
    });
    if (!member) return { success: false, error: "Member not found" };
    return { success: true, data: { password: member.password ?? "" } };
  } catch {
    return { success: false, error: "Failed to fetch password" };
  }
}

export async function getRolesForSelect() {
  return db.teamRole.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// ── Mutations — logs on every DB write ────────────────────────────────────────

export async function createTeamMember(
  input: z.infer<typeof CreateTeamMemberSchema>
): Promise<Result<{ id: string }>> {
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (err) {
    return { success: false, error: "Auth check failed: " + String(err) };
  }
  if (!user) return { success: false, error: "Not authenticated" };

  const parsed = CreateTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return { success: false, error: "Validation failed: " + messages };
  }

  const { password, joiningDate, email, departmentId, roleId, ...rest } = parsed.data;

  const existing = await db.teamMember.findUnique({ where: { email } });
  if (existing) return { success: false, error: `Email '${email}' is already registered` };

  const hashed = await hash(password, 12);

  try {
    const created = await db.teamMember.create({
      data: {
        name: rest.name,
        isActive: rest.isActive ?? true,
        email,
        password: hashed,
        joiningDate: joiningDate ? new Date(joiningDate) : null,
        createdById: user.id,
        ...(departmentId ? { department: { connect: { id: departmentId } } } : {}),
        ...(roleId ? { teamRole: { connect: { id: roleId } } } : {}),
      },
      select: { id: true },
    });

    // ✅ LOG: new member created
    await createLog({
      action:    "CREATE",
      entity:    "TeamMember",
      entityId:  created.id,
      newData:   { name: rest.name, email, departmentId, roleId },
      severity:  "LOW",
    });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: { id: created.id } };

  } catch (err: unknown) {
    // ✅ LOG: creation failed
    await createLog({
      action:       "CREATE",
      entity:       "TeamMember",
      status:       "FAILED",
      errorMessage: String(err),
      severity:     "HIGH",
    });

    if (err && typeof err === "object" && "code" in err) {
      const e = err as { code: string; message: string; meta?: { target?: string[] } };
      switch (e.code) {
        case "P2002": return { success: false, error: `Duplicate field: ${e.meta?.target?.join(", ")}` };
        case "P2003": return { success: false, error: "Invalid foreign key — check departmentId or roleId" };
        case "P2025": return { success: false, error: "Related record not found" };
        default:      return { success: false, error: `DB error [${e.code}]: ${e.message}` };
      }
    }
    return { success: false, error: "Unexpected error: " + String(err) };
  }
}

export async function updateTeamMember(
  input: z.infer<typeof UpdateTeamMemberSchema>
): Promise<Result<null>> {
  const user = await getAuthenticatedUser();

  const parsed = UpdateTeamMemberSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0].message };

  const { id, password, joiningDate, departmentId, roleId, ...rest } = parsed.data;

  // Capture previous state for the diff
  const previous = await db.teamMember.findUnique({
    where: { id },
    select: { name: true, email: true, isActive: true, joiningDate: true },
  });

  const data: Record<string, unknown> = {
    ...rest,
    ...(joiningDate !== undefined && { joiningDate: joiningDate ? new Date(joiningDate) : null }),
    ...(departmentId !== undefined && (
      departmentId ? { department: { connect: { id: departmentId } } } : { department: { disconnect: true } }
    )),
    ...(roleId !== undefined && (
      roleId ? { teamRole: { connect: { id: roleId } } } : { teamRole: { disconnect: true } }
    )),
  };
  if (password) data.password = await hash(password, 12);

  try {
    await db.teamMember.update({ where: { id }, data });

    // ✅ LOG: member updated with before/after diff
    await createLog({
      action:       "UPDATE",
      entity:       "TeamMember",
      entityId:     id,
      previousData: previous ?? undefined,
      newData:      { ...rest, departmentId, roleId },
      severity:     "LOW",
    });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };

  } catch (err) {
    // ✅ LOG: update failed
    await createLog({
      action:       "UPDATE",
      entity:       "TeamMember",
      entityId:     id,
      status:       "FAILED",
      errorMessage: String(err),
      severity:     "HIGH",
    });

    return { success: false, error: "Failed to update team member" };
  }
}

export async function updateMemberPassword(
  id: string,
  plainPassword: string
): Promise<Result<null>> {
  const user = await getAuthenticatedUser();

  if (plainPassword.length < 8) return { success: false, error: "Password must be at least 8 characters" };

  const hashed = await hash(plainPassword, 12);

  try {
    await db.teamMember.update({ where: { id }, data: { password: hashed } });

    // ✅ LOG: password changed — never log the actual password, only the event
    await createLog({
      action:    "PASSWORD_CHANGE",
      entity:    "TeamMember",
      entityId:  id,
      metadata:  { type: "manual_set" },
      severity:  "HIGH",             // password changes are always HIGH
    });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };

  } catch (err) {
    await createLog({
      action:       "PASSWORD_CHANGE",
      entity:       "TeamMember",
      entityId:     id,
      status:       "FAILED",
      errorMessage: String(err),
      severity:     "HIGH",
    });

    return { success: false, error: "Failed to update password" };
  }
}

export async function resetMemberPassword(id: string): Promise<Result<{ plainPassword: string }>> {
  const user = await getAuthenticatedUser();

  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let plainPassword = "";
  for (let i = 0; i < 14; i++) plainPassword += chars[Math.floor(Math.random() * chars.length)];

  const hashed = await hash(plainPassword, 12);

  try {
    await db.teamMember.update({ where: { id }, data: { password: hashed } });

    // ✅ LOG: password reset — note it's a system reset vs manual set
    await createLog({
      action:    "PASSWORD_CHANGE",
      entity:    "TeamMember",
      entityId:  id,
      metadata:  {type: "system_reset" },
      severity:  "HIGH",
    });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: { plainPassword } };

  } catch (err) {
    await createLog({
      action:       "PASSWORD_CHANGE",
      entity:       "TeamMember",
      entityId:     id,
      status:       "FAILED",
      errorMessage: String(err),
      severity:     "HIGH",
    });

    return { success: false, error: "Failed to reset password" };
  }
}

export async function deleteTeamMember(id: string): Promise<Result<null>> {
  const user = await getAuthenticatedUser();
  if (user && user.id === id) return { success: false, error: "Cannot delete yourself" };

  // Capture state BEFORE delete — after delete it's gone
  const target = await db.teamMember.findUnique({
    where: { id },
    select: { name: true, email: true, isActive: true },
  });

  try {
    await db.teamMember.delete({ where: { id } });

    // ✅ LOG: deletion — always HIGH, store what was deleted in previousData
    await createLog({
      action:       "DELETE",
      entity:       "TeamMember",
      entityId:     id,
      previousData: target ?? undefined,
      severity:     "HIGH",
    });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };

  } catch (err) {
    await createLog({
      action:       "DELETE",
      entity:       "TeamMember",
      entityId:     id,
      status:       "FAILED",
      errorMessage: String(err),
      severity:     "HIGH",
    });

    return { success: false, error: "Failed to delete team member" };
  }
}

export async function toggleActive(id: string): Promise<Result<null>> {
  const user = await getAuthenticatedUser();

  const current = await db.teamMember.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!current) return { success: false, error: "Not found" };

  try {
    await db.teamMember.update({
      where: { id },
      data: { isActive: !current.isActive },
    });

    // ✅ LOG: status toggled — show exact before/after
    await createLog({
      action:       "UPDATE",
      entity:       "TeamMember",
      entityId:     id,
      previousData: { isActive: current.isActive },
      newData:      { isActive: !current.isActive },
      metadata:     { operation: "toggle_active" },
      severity:     "MEDIUM",
    });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };

  } catch (err) {
    await createLog({
      action:       "UPDATE",
      entity:       "TeamMember",
      entityId:     id,
      status:       "FAILED",
      errorMessage: String(err),
      severity:     "HIGH",
      metadata:     { operation: "toggle_active" },
    });

    return { success: false, error: "Failed to toggle status" };
  }
}