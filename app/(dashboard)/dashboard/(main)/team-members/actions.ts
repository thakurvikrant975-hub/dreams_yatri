// actions.ts
"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";

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

// ── Reads ─────────────────────────────────────────────────────────────────

export async function getTeamMembersPaginated(page = 1): Promise<PaginatedMembers> {
  const skip = (page - 1) * PAGE_SIZE;

  const [raw, total] = await Promise.all([
    db.teamMember.findMany({
      skip,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      include: {
        department: { select: { id: true, name: true } },
        // ← KEY FIX: alias teamRole → role in the select shape below
        teamRole: { select: { id: true, name: true } },
      },
    }),
    db.teamMember.count(),
  ]);

  // Normalize teamRole → role so the client type stays clean
  const members: TeamMember[] = raw.map(({ teamRole, ...m }) => ({
    ...m,
    role: teamRole,
  }));

  return {
    members,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getDepartmentsForSelect() {
  return db.department.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function getRolesForSelect() {
  return db.teamRole.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────

export async function createTeamMember(
  input: z.infer<typeof CreateTeamMemberSchema>
): Promise<Result<{ id: string }>> {
  // ── Auth check ────────────────────────────────────────────────────────
  let user;
  try {
    user = await getAuthenticatedUser();
  } catch (err) {
    console.error("[createTeamMember] getAuthenticatedUser threw:", err);
    return { success: false, error: "Auth check failed: " + String(err) };
  }

  if (!user) {
    return { success: false, error: "Not authenticated — user is null" };
  }
//   if (user.role !== "ADMIN") {
//     return { success: false, error: `Unauthorized — your role is '${user.role}', expected ADMIN` };
//   }

  // ── Validation ────────────────────────────────────────────────────────
  const parsed = CreateTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(", ");
    return { success: false, error: "Validation failed: " + messages };
  }

  const { password, joiningDate, email, departmentId, roleId, ...rest } = parsed.data;

  // ── Duplicate check ───────────────────────────────────────────────────
  try {
    const existing = await db.teamMember.findUnique({ where: { email } });
    if (existing) {
      return { success: false, error: `Email '${email}' is already registered` };
    }
  } catch (err) {
    console.error("[createTeamMember] duplicate check failed:", err);
    return { success: false, error: "DB lookup failed: " + String(err) };
  }

  // ── Hash ──────────────────────────────────────────────────────────────
  let hashed: string;
  try {
    hashed = await hash(password, 12);
  } catch (err) {
    console.error("[createTeamMember] bcrypt failed:", err);
    return { success: false, error: "Password hashing failed: " + String(err) };
  }

  // ── Insert ────────────────────────────────────────────────────────────
  try {
// createTeamMember — replace the Insert section
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

    revalidatePath("/dashboard/team-members");
    return { success: true, data: { id: created.id } };
  } catch (err: unknown) {
    console.error("[createTeamMember] db.create failed:", err);

    // Prisma-specific error codes
    if (err && typeof err === "object" && "code" in err) {
      const prismaErr = err as { code: string; message: string; meta?: { target?: string[] } };
      
      switch (prismaErr.code) {
        case "P2002":
          return { success: false, error: `Duplicate field: ${prismaErr.meta?.target?.join(", ") ?? "unknown"}` };
        case "P2003":
          return { success: false, error: `Invalid foreign key — check departmentId or roleId exists in DB` };
        case "P2025":
          return { success: false, error: "Related record not found" };
        default:
          return { success: false, error: `DB error [${prismaErr.code}]: ${prismaErr.message}` };
      }
    }

    return { success: false, error: "Unexpected error: " + String(err) };
  }
}

export async function updateMemberPassword(
  id: string,
  plainPassword: string
): Promise<Result<null>> {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  if (plainPassword.length < 8) {
    return { success: false, error: "Password must be at least 8 characters" };
  }

  let hashed: string;
  try {
    hashed = await hash(plainPassword, 12);
  } catch (err) {
    return { success: false, error: "Hashing failed: " + String(err) };
  }

  try {
    await db.teamMember.update({ where: { id }, data: { password: hashed } });
    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };
  } catch (err) {
    console.error("updateMemberPassword failed:", err);
    return { success: false, error: "Failed to update password" };
  }
}

export async function updateTeamMember(
  input: z.infer<typeof UpdateTeamMemberSchema>
): Promise<Result<null>> {
  const user = await getAuthenticatedUser();
//   if (!user || user.role !== "ADMIN") {
//     return { success: false, error: "Unauthorized" };
//   }

  const parsed = UpdateTeamMemberSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

// updateTeamMember — replace the data build block
const { id, password, joiningDate, departmentId, roleId, ...rest } = parsed.data;

const data: Record<string, unknown> = {
  ...rest,
  ...(joiningDate !== undefined && {
    joiningDate: joiningDate ? new Date(joiningDate) : null,
  }),
  ...(departmentId !== undefined && (
    departmentId
      ? { department: { connect: { id: departmentId } } }
      : { department: { disconnect: true } }
  )),
  ...(roleId !== undefined && (
    roleId
      ? { teamRole: { connect: { id: roleId } } }
      : { teamRole: { disconnect: true } }
  )),
};

if (password) {
  data.password = await hash(password, 12);
}

  try {
    await db.teamMember.update({ where: { id }, data });
    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };
  } catch (err) {
    console.error("updateTeamMember failed:", err);
    return { success: false, error: "Failed to update team member" };
  }
}

export async function resetMemberPassword(id: string): Promise<Result<{ plainPassword: string }>> {
  const user = await getAuthenticatedUser();
  if (!user || user.role !== "ADMIN") {
    return { success: false, error: "Unauthorized" };
  }

  // Generate a secure random password
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let plainPassword = "";
  for (let i = 0; i < 14; i++) {
    plainPassword += chars[Math.floor(Math.random() * chars.length)];
  }

  let hashed: string;
  try {
    hashed = await hash(plainPassword, 12);
  } catch (err) {
    return { success: false, error: "Hashing failed: " + String(err) };
  }

  try {
    await db.teamMember.update({
      where: { id },
      data: { password: hashed },
    });
    revalidatePath("/dashboard/team-members");
    return { success: true, data: { plainPassword } };
  } catch (err) {
    console.error("resetMemberPassword failed:", err);
    return { success: false, error: "Failed to reset password" };
  }
}

export async function deleteTeamMember(id: string): Promise<Result<null>> {
  const user = await getAuthenticatedUser();
//   if (!user || user.role !== "ADMIN") {
//     return { success: false, error: "Unauthorized" };
//   }

  if (user.id === id) {
    return { success: false, error: "Cannot delete yourself" };
  }

  try {
    await db.teamMember.delete({ where: { id } });
    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };
  } catch (err) {
    console.error("deleteTeamMember failed:", err);
    return { success: false, error: "Failed to delete team member" };
  }
}

export async function toggleActive(id: string): Promise<Result<null>> {
  const user = await getAuthenticatedUser();
//   if (!user || user.role !== "ADMIN") {
//     return { success: false, error: "Unauthorized" };
//   }

  try {
    const current = await db.teamMember.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!current) return { success: false, error: "Not found" };

    await db.teamMember.update({
      where: { id },
      data: { isActive: !current.isActive },
    });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };
  } catch (err) {
    console.error("toggleActive failed:", err);
    return { success: false, error: "Failed to toggle status" };
  }
}