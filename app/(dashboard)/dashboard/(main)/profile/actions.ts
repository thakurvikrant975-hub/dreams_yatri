"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";
import { actionError } from "@/app/lib/action-error";
import {
  PersonalDetailsSchema, FamilyDetailsSchema, IdentityDocumentsSchema, ChangePasswordSchema,
} from "@/app/lib/validators/profile";

export type ProfileFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

// Always resolves to the REAL logged-in member (never an impersonated "view
// as" target) — this is a self-service page, so it must only ever touch the
// account actually signed in, regardless of FSD impersonation state.
async function requireSelf() {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;
  return db.teamMember.findUnique({ where: { email: session.user.email } });
}

const PROFILE_SELECT = {
  id: true, name: true, email: true, isActive: true, joiningDate: true, lastLoginAt: true,
  designation: true, employeeId: true,
  personalEmail: true, personalMobile: true, alternativeMobile: true,
  fatherName: true, fatherMobile: true, motherName: true, motherMobile: true,
  aadhaarNumber: true, aadhaarFileKey: true, aadhaarFileUrl: true,
  panNumber: true, panFileKey: true, panFileUrl: true,
  profilePicKey: true, profilePicUrl: true,
  department: { select: { id: true, name: true } },
  teamRole: { select: { id: true, name: true } },
} as const;

export async function getMyProfile() {
  const self = await requireSelf();
  if (!self) return null;
  return db.teamMember.findUnique({ where: { id: self.id }, select: PROFILE_SELECT });
}

// ── Avatar ────────────────────────────────────────────────────────────────────

export async function updateAvatar(key: string, url: string): Promise<ProfileFormState> {
  const self = await requireSelf();
  if (!self) return { success: false, message: "Unauthorized" };

  try {
    await db.teamMember.update({ where: { id: self.id }, data: { profilePicKey: key, profilePicUrl: url } });
    await createLog({
      action: "UPDATE", entity: "TeamMember", entityId: self.id, entitySlug: self.name,
      newData: { profilePicKey: key }, metadata: { operation: "update_avatar", scope: "self_service" },
    });
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");
    return { success: true, message: "Profile photo updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Personal details ────────────────────────────────────────────────────────

export async function updatePersonalDetails(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const self = await requireSelf();
  if (!self) return { success: false, message: "Unauthorized" };

  const parsed = PersonalDetailsSchema.safeParse({
    personalEmail: (formData.get("personalEmail") as string) || "",
    personalMobile: (formData.get("personalMobile") as string) || undefined,
    alternativeMobile: (formData.get("alternativeMobile") as string) || undefined,
  });
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await db.teamMember.update({ where: { id: self.id }, data: parsed.data });
    await createLog({
      action: "UPDATE", entity: "TeamMember", entityId: self.id, entitySlug: self.name,
      newData: parsed.data, metadata: { operation: "update_personal_details", scope: "self_service" },
    });
    revalidatePath("/dashboard/profile");
    return { success: true, message: "Personal details updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Family details ──────────────────────────────────────────────────────────

export async function updateFamilyDetails(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const self = await requireSelf();
  if (!self) return { success: false, message: "Unauthorized" };

  const parsed = FamilyDetailsSchema.safeParse({
    fatherName: (formData.get("fatherName") as string) || undefined,
    fatherMobile: (formData.get("fatherMobile") as string) || undefined,
    motherName: (formData.get("motherName") as string) || undefined,
    motherMobile: (formData.get("motherMobile") as string) || undefined,
  });
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    await db.teamMember.update({ where: { id: self.id }, data: parsed.data });
    await createLog({
      action: "UPDATE", entity: "TeamMember", entityId: self.id, entitySlug: self.name,
      newData: parsed.data, metadata: { operation: "update_family_details", scope: "self_service" },
    });
    revalidatePath("/dashboard/profile");
    return { success: true, message: "Family details updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Identity documents ──────────────────────────────────────────────────────

export async function updateIdentityDocuments(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const self = await requireSelf();
  if (!self) return { success: false, message: "Unauthorized" };

  const parsed = IdentityDocumentsSchema.safeParse({
    aadhaarNumber: (formData.get("aadhaarNumber") as string) || undefined,
    aadhaarFileKey: (formData.get("aadhaarFileKey") as string) || undefined,
    aadhaarFileUrl: (formData.get("aadhaarFileUrl") as string) || undefined,
    panNumber: (formData.get("panNumber") as string) || undefined,
    panFileKey: (formData.get("panFileKey") as string) || undefined,
    panFileUrl: (formData.get("panFileUrl") as string) || undefined,
  });
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    // Keep existing file unless a new one was uploaded in this submission.
    const current = await db.teamMember.findUnique({
      where: { id: self.id },
      select: { aadhaarFileKey: true, aadhaarFileUrl: true, panFileKey: true, panFileUrl: true },
    });

    await db.teamMember.update({
      where: { id: self.id },
      data: {
        aadhaarNumber: parsed.data.aadhaarNumber,
        panNumber: parsed.data.panNumber,
        aadhaarFileKey: parsed.data.aadhaarFileKey ?? current?.aadhaarFileKey ?? null,
        aadhaarFileUrl: parsed.data.aadhaarFileUrl ?? current?.aadhaarFileUrl ?? null,
        panFileKey: parsed.data.panFileKey ?? current?.panFileKey ?? null,
        panFileUrl: parsed.data.panFileUrl ?? current?.panFileUrl ?? null,
      },
    });
    await createLog({
      action: "UPDATE", entity: "TeamMember", entityId: self.id, entitySlug: self.name,
      newData: { aadhaarNumber: parsed.data.aadhaarNumber, panNumber: parsed.data.panNumber },
      metadata: { operation: "update_identity_documents", scope: "self_service" }, severity: "MEDIUM",
    });
    revalidatePath("/dashboard/profile");
    return { success: true, message: "Identity documents updated" };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Change own password ─────────────────────────────────────────────────────

export async function changeMyPassword(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const self = await requireSelf();
  if (!self) return { success: false, message: "Unauthorized" };

  const parsed = ChangePasswordSchema.safeParse({
    currentPassword: (formData.get("currentPassword") as string) || "",
    newPassword: (formData.get("newPassword") as string) || "",
    confirmPassword: (formData.get("confirmPassword") as string) || "",
  });
  if (!parsed.success) {
    return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
  }

  if (!self.password) {
    return { success: false, message: "No password set on this account — contact your administrator" };
  }

  const valid = await compare(parsed.data.currentPassword, self.password);
  if (!valid) {
    await createLog({
      action: "PASSWORD_CHANGE", entity: "TeamMember", entityId: self.id, entitySlug: self.name,
      status: "FAILED", errorMessage: "Incorrect current password",
      metadata: { type: "self_service" }, severity: "HIGH",
    });
    return { success: false, message: "Current password is incorrect", errors: { currentPassword: ["Incorrect password"] } };
  }

  try {
    const hashed = await hash(parsed.data.newPassword, 12);
    await db.teamMember.update({ where: { id: self.id }, data: { password: hashed } });
    await createLog({
      action: "PASSWORD_CHANGE", entity: "TeamMember", entityId: self.id, entitySlug: self.name,
      metadata: { type: "self_service" }, severity: "HIGH",
    });
    return { success: true, message: "Password changed successfully" };
  } catch (e) {
    console.error(e);
    await createLog({
      action: "PASSWORD_CHANGE", entity: "TeamMember", entityId: self.id, entitySlug: self.name,
      status: "FAILED", errorMessage: String(e), metadata: { type: "self_service" }, severity: "HIGH",
    });
    return actionError(e);
  }
}
