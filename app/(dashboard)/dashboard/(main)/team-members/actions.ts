"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { createLog } from "../lib/logger";
import { uploadToR2 } from "@/app/lib/r2/r2upload";
import { deleteFromR2 } from "@/app/lib/r2/r2delete";

const PAGE_SIZE = 10;

// ── Validation helpers ────────────────────────────────────────────────────────

const AADHAAR_RE  = /^\d{12}$/;
const PAN_RE      = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MOBILE_RE   = /^[6-9]\d{9}$/;
const WORK_EMAIL_DOMAIN = "@dreamsyatri.com";

// ── Schemas ───────────────────────────────────────────────────────────────────

const CreateTeamMemberSchema = z.object({
  name:             z.string().min(2).max(255),
  email:            z.string().email().toLowerCase(),           // work email
  password:         z.string().min(8).max(72),
  personalEmail:    z.string().email().toLowerCase().optional().nullable(),
  designation:      z.string().max(255).optional().nullable(),
  departmentId:     z.string().optional().nullable(),
  roleId:           z.string().optional().nullable(),
  joiningDate:      z.string().optional().nullable(),
  isActive:         z.boolean().default(true),
  personalMobile:   z.string().regex(MOBILE_RE, "Invalid mobile number").optional().nullable(),
  alternativeMobile:z.string().regex(MOBILE_RE, "Invalid mobile number").optional().nullable(),
  fatherName:       z.string().max(255).optional().nullable(),
  fatherMobile:     z.string().regex(MOBILE_RE, "Invalid mobile number").optional().nullable(),
  motherName:       z.string().max(255).optional().nullable(),
  motherMobile:     z.string().regex(MOBILE_RE, "Invalid mobile number").optional().nullable(),
  aadhaarNumber:    z.string().regex(AADHAAR_RE, "Aadhaar must be 12 digits").optional().nullable(),
  panNumber:        z.string().regex(PAN_RE,     "Invalid PAN (e.g. ABCDE1234F)").optional().nullable(),
});

const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial().extend({
  id:       z.string(),
  password: z.string().min(8).max(72).optional(),
});

// ── Public types ──────────────────────────────────────────────────────────────

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type TeamMember = {
  id:               string;
  employeeId:       string;
  name:             string;
  email:            string;
  personalEmail:    string | null;
  designation:      string | null;
  isActive:         boolean;
  joiningDate:      Date | null;
  createdAt:        Date;
  profilePicUrl:    string | null;
  profilePicKey:    string | null;
  personalMobile:   string | null;
  alternativeMobile:string | null;
  fatherName:       string | null;
  fatherMobile:     string | null;
  motherName:       string | null;
  motherMobile:     string | null;
  aadhaarNumber:    string | null;
  aadhaarFileUrl:   string | null;
  aadhaarFileKey:   string | null;
  panNumber:        string | null;
  panFileUrl:       string | null;
  panFileKey:       string | null;
  department:       { id: string; name: string } | null;
  role:             { id: string; name: string } | null;
};

export type PaginatedMembers = {
  members:    TeamMember[];
  total:      number;
  page:       number;
  pageSize:   number;
  totalPages: number;
};

// ── Employee ID generator ─────────────────────────────────────────────────────

async function generateEmployeeId(): Promise<string> {
  const count = await db.teamMember.count();
  const num   = 100001 + count;
  return `DY${num}`;
}

// ── Reads ─────────────────────────────────────────────────────────────────────

export async function getTeamMembersPaginated(page = 1): Promise<PaginatedMembers> {
  const skip = (page - 1) * PAGE_SIZE;

  const [raw, total] = await Promise.all([
    db.teamMember.findMany({
      skip,
      take: PAGE_SIZE,
      orderBy: { createdAt: "desc" },
      include: {
        department: { select: { id: true, name: true } },
        teamRole:   { select: { id: true, name: true } },
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

export async function getRolesForSelect() {
  return db.teamRole.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

export async function getMemberPassword(memberId: string): Promise<Result<{ password: string }>> {
  try {
    const member = await db.teamMember.findUnique({ where: { id: memberId }, select: { password: true } });
    if (!member) return { success: false, error: "Member not found" };
    return { success: true, data: { password: member.password ?? "" } };
  } catch {
    return { success: false, error: "Failed to fetch password" };
  }
}

// ── File uploads (profile pic, aadhaar, pan) ──────────────────────────────────

export async function uploadProfilePic(
  memberId: string,
  formData: FormData
): Promise<Result<{ url: string; key: string }>> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) return { success: false, error: "Only JPEG, PNG, WebP images allowed" };
  if (file.size > 2 * 1024 * 1024) return { success: false, error: "Image must be under 2 MB" };

  try {
    // Delete old pic if exists
    const existing = await db.teamMember.findUnique({ where: { id: memberId }, select: { profilePicKey: true } });
    if (existing?.profilePicKey) await deleteFromR2(existing.profilePicKey).catch(() => null);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, url } = await uploadToR2({ file: buffer, folder: "team-members", fileName: `profile-${memberId}`, contentType: file.type });

    await db.teamMember.update({ where: { id: memberId }, data: { profilePicKey: key, profilePicUrl: url } });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: { url, key } };
  } catch (err) {
    return { success: false, error: "Upload failed: " + String(err) };
  }
}

export async function uploadAadhaarFile(
  memberId: string,
  formData: FormData
): Promise<Result<{ url: string; key: string }>> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.type)) return { success: false, error: "Only JPEG, PNG, PDF allowed" };
  if (file.size > 5 * 1024 * 1024) return { success: false, error: "File must be under 5 MB" };

  try {
    const existing = await db.teamMember.findUnique({ where: { id: memberId }, select: { aadhaarFileKey: true } });
    if (existing?.aadhaarFileKey) await deleteFromR2(existing.aadhaarFileKey).catch(() => null);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, url } = await uploadToR2({ file: buffer, folder: "team-members", fileName: `aadhaar-${memberId}`, contentType: file.type });

    await db.teamMember.update({ where: { id: memberId }, data: { aadhaarFileKey: key, aadhaarFileUrl: url } });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: { url, key } };
  } catch (err) {
    return { success: false, error: "Upload failed: " + String(err) };
  }
}

export async function uploadPanFile(
  memberId: string,
  formData: FormData
): Promise<Result<{ url: string; key: string }>> {
  const user = await getAuthenticatedUser();
  if (!user) return { success: false, error: "Not authenticated" };

  const file = formData.get("file") as File | null;
  if (!file) return { success: false, error: "No file provided" };

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.type)) return { success: false, error: "Only JPEG, PNG, PDF allowed" };
  if (file.size > 5 * 1024 * 1024) return { success: false, error: "File must be under 5 MB" };

  try {
    const existing = await db.teamMember.findUnique({ where: { id: memberId }, select: { panFileKey: true } });
    if (existing?.panFileKey) await deleteFromR2(existing.panFileKey).catch(() => null);

    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, url } = await uploadToR2({ file: buffer, folder: "team-members", fileName: `pan-${memberId}`, contentType: file.type });

    await db.teamMember.update({ where: { id: memberId }, data: { panFileKey: key, panFileUrl: url } });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: { url, key } };
  } catch (err) {
    return { success: false, error: "Upload failed: " + String(err) };
  }
}

// ── Mutations ─────────────────────────────────────────────────────────────────

export async function createTeamMember(
  input: z.infer<typeof CreateTeamMemberSchema>
): Promise<Result<{ id: string; employeeId: string }>> {
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

  const hashed    = await hash(password, 12);
  const employeeId = await generateEmployeeId();

  try {
    const created = await db.teamMember.create({
      data: {
        employeeId,
        name:              rest.name,
        email,
        password:          hashed,
        isActive:          rest.isActive ?? true,
        designation:       rest.designation ?? null,
        personalEmail:     rest.personalEmail ?? null,
        personalMobile:    rest.personalMobile ?? null,
        alternativeMobile: rest.alternativeMobile ?? null,
        fatherName:        rest.fatherName ?? null,
        fatherMobile:      rest.fatherMobile ?? null,
        motherName:        rest.motherName ?? null,
        motherMobile:      rest.motherMobile ?? null,
        aadhaarNumber:     rest.aadhaarNumber ?? null,
        panNumber:         rest.panNumber ?? null,
        joiningDate:       joiningDate ? new Date(joiningDate) : null,
        createdById:       user.id,
        ...(departmentId ? { department: { connect: { id: departmentId } } } : {}),
        ...(roleId       ? { teamRole:   { connect: { id: roleId } } }       : {}),
      },
      select: { id: true, employeeId: true },
    });

    await createLog({ action: "CREATE", entity: "TeamMember", entityId: created.id, newData: { employeeId, name: rest.name, email, departmentId, roleId }, severity: "LOW" });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: { id: created.id, employeeId: created.employeeId } };

  } catch (err: unknown) {
    await createLog({ action: "CREATE", entity: "TeamMember", status: "FAILED", errorMessage: String(err), severity: "HIGH" });

    if (err && typeof err === "object" && "code" in err) {
      const e = err as { code: string; message: string; meta?: { target?: string[] } };
      switch (e.code) {
        case "P2002": return { success: false, error: `Duplicate field: ${e.meta?.target?.join(", ")}` };
        case "P2003": return { success: false, error: "Invalid foreign key — check departmentId or roleId" };
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

  const previous = await db.teamMember.findUnique({
    where: { id },
    select: { name: true, email: true, isActive: true, joiningDate: true },
  });

  const data: Record<string, unknown> = {
    ...rest,
    ...(joiningDate !== undefined && { joiningDate: joiningDate ? new Date(joiningDate) : null }),
    ...(departmentId !== undefined && (departmentId ? { department: { connect: { id: departmentId } } } : { department: { disconnect: true } })),
    ...(roleId       !== undefined && (roleId       ? { teamRole:   { connect: { id: roleId } } }       : { teamRole:   { disconnect: true } })),
  };
  if (password) data.password = await hash(password, 12);

  try {
    await db.teamMember.update({ where: { id }, data });

    await createLog({ action: "UPDATE", entity: "TeamMember", entityId: id, previousData: previous ?? undefined, newData: { ...rest, departmentId, roleId }, severity: "LOW" });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };
  } catch (err) {
    await createLog({ action: "UPDATE", entity: "TeamMember", entityId: id, status: "FAILED", errorMessage: String(err), severity: "HIGH" });
    return { success: false, error: "Failed to update team member" };
  }
}

export async function updateMemberPassword(id: string, plainPassword: string): Promise<Result<null>> {
  await getAuthenticatedUser();
  if (plainPassword.length < 8) return { success: false, error: "Password must be at least 8 characters" };

  const hashed = await hash(plainPassword, 12);
  try {
    await db.teamMember.update({ where: { id }, data: { password: hashed } });
    await createLog({ action: "PASSWORD_CHANGE", entity: "TeamMember", entityId: id, metadata: { type: "manual_set" }, severity: "HIGH" });
    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };
  } catch (err) {
    await createLog({ action: "PASSWORD_CHANGE", entity: "TeamMember", entityId: id, status: "FAILED", errorMessage: String(err), severity: "HIGH" });
    return { success: false, error: "Failed to update password" };
  }
}

export async function resetMemberPassword(id: string): Promise<Result<{ plainPassword: string }>> {
  await getAuthenticatedUser();
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let plainPassword = "";
  for (let i = 0; i < 14; i++) plainPassword += chars[Math.floor(Math.random() * chars.length)];

  const hashed = await hash(plainPassword, 12);
  try {
    await db.teamMember.update({ where: { id }, data: { password: hashed } });
    await createLog({ action: "PASSWORD_CHANGE", entity: "TeamMember", entityId: id, metadata: { type: "system_reset" }, severity: "HIGH" });
    revalidatePath("/dashboard/team-members");
    return { success: true, data: { plainPassword } };
  } catch (err) {
    await createLog({ action: "PASSWORD_CHANGE", entity: "TeamMember", entityId: id, status: "FAILED", errorMessage: String(err), severity: "HIGH" });
    return { success: false, error: "Failed to reset password" };
  }
}

export async function deleteTeamMember(id: string): Promise<Result<null>> {
  const user = await getAuthenticatedUser();
  if (user && user.id === id) return { success: false, error: "Cannot delete yourself" };

  const target = await db.teamMember.findUnique({
    where: { id },
    select: { name: true, email: true, isActive: true, profilePicKey: true, aadhaarFileKey: true, panFileKey: true },
  });

  try {
    await db.teamMember.delete({ where: { id } });

    // Clean up R2 files
    const keys = [target?.profilePicKey, target?.aadhaarFileKey, target?.panFileKey].filter(Boolean) as string[];
    await Promise.allSettled(keys.map((k) => deleteFromR2(k)));

    await createLog({ action: "DELETE", entity: "TeamMember", entityId: id, previousData: target ?? undefined, severity: "HIGH" });

    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };
  } catch (err) {
    await createLog({ action: "DELETE", entity: "TeamMember", entityId: id, status: "FAILED", errorMessage: String(err), severity: "HIGH" });
    return { success: false, error: "Failed to delete team member" };
  }
}

export async function toggleActive(id: string): Promise<Result<null>> {
  await getAuthenticatedUser();

  const current = await db.teamMember.findUnique({ where: { id }, select: { isActive: true } });
  if (!current) return { success: false, error: "Not found" };

  try {
    await db.teamMember.update({ where: { id }, data: { isActive: !current.isActive } });
    await createLog({ action: "UPDATE", entity: "TeamMember", entityId: id, previousData: { isActive: current.isActive }, newData: { isActive: !current.isActive }, metadata: { operation: "toggle_active" }, severity: "MEDIUM" });
    revalidatePath("/dashboard/team-members");
    return { success: true, data: null };
  } catch (err) {
    await createLog({ action: "UPDATE", entity: "TeamMember", entityId: id, status: "FAILED", errorMessage: String(err), severity: "HIGH", metadata: { operation: "toggle_active" } });
    return { success: false, error: "Failed to toggle status" };
  }
}