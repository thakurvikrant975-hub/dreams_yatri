"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { createLog } from "../lib/logger";
import { actionError } from "@/app/lib/action-error";
import {
  PersonalDetailsSchema, FamilyDetailsSchema, IdentityDocumentsSchema, ChangePasswordSchema,
  OnboardingPersonalSchema,
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
  designation: true, employeeId: true, gender: true, officialMobile: true, joiningDateUnknown: true,
  personalEmail: true, personalMobile: true, alternativeMobile: true,
  fatherName: true, fatherMobile: true, motherName: true, motherMobile: true,
  aadhaarNumber: true, aadhaarFileKey: true, aadhaarFileUrl: true,
  aadhaarBackFileKey: true, aadhaarBackFileUrl: true,
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
    officialMobile: (formData.get("officialMobile") as string) || undefined,
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
    aadhaarBackFileKey: (formData.get("aadhaarBackFileKey") as string) || undefined,
    aadhaarBackFileUrl: (formData.get("aadhaarBackFileUrl") as string) || undefined,
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
      select: {
        aadhaarFileKey: true, aadhaarFileUrl: true,
        aadhaarBackFileKey: true, aadhaarBackFileUrl: true,
        panFileKey: true, panFileUrl: true,
      },
    });

    await db.teamMember.update({
      where: { id: self.id },
      data: {
        aadhaarNumber: parsed.data.aadhaarNumber,
        panNumber: parsed.data.panNumber,
        aadhaarFileKey: parsed.data.aadhaarFileKey ?? current?.aadhaarFileKey ?? null,
        aadhaarFileUrl: parsed.data.aadhaarFileUrl ?? current?.aadhaarFileUrl ?? null,
        aadhaarBackFileKey: parsed.data.aadhaarBackFileKey ?? current?.aadhaarBackFileKey ?? null,
        aadhaarBackFileUrl: parsed.data.aadhaarBackFileUrl ?? current?.aadhaarBackFileUrl ?? null,
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

// ── Onboarding popup ("May I know you 🥰") ──────────────────────────────────
// One combined submit across both tabs, rather than the personal/family/
// identity split above — the popup is a single flow, so there's no reason to
// make someone save twice. Reuses the same validators as the ordinary
// profile-edit dialogs, tightened for the fields that are actually required
// to dismiss the popup (see OnboardingPersonalSchema); family/identity stay
// fully optional here, same as everywhere else.

export async function completeOnboardingProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const self = await requireSelf();
  if (!self) return { success: false, message: "Unauthorized" };

  const personal = OnboardingPersonalSchema.safeParse({
    gender: (formData.get("gender") as string) || undefined,
    personalEmail: (formData.get("personalEmail") as string) || "",
    personalMobile: (formData.get("personalMobile") as string) || "",
    alternativeMobile: (formData.get("alternativeMobile") as string) || "",
    officialMobile: (formData.get("officialMobile") as string) || undefined,
    joiningDate: (formData.get("joiningDate") as string) || undefined,
    joiningDateUnknown: formData.get("joiningDateUnknown") === "true",
  });
  if (!personal.success) {
    return { success: false, message: "A few required fields still need filling in", errors: personal.error.flatten().fieldErrors };
  }

  const family = FamilyDetailsSchema.safeParse({
    fatherName: (formData.get("fatherName") as string) || undefined,
    fatherMobile: (formData.get("fatherMobile") as string) || undefined,
    motherName: (formData.get("motherName") as string) || undefined,
    motherMobile: (formData.get("motherMobile") as string) || undefined,
  });
  if (!family.success) {
    return { success: false, message: "Validation failed", errors: family.error.flatten().fieldErrors };
  }

  const identity = IdentityDocumentsSchema.safeParse({
    aadhaarNumber: (formData.get("aadhaarNumber") as string) || undefined,
    aadhaarFileKey: (formData.get("aadhaarFileKey") as string) || undefined,
    aadhaarFileUrl: (formData.get("aadhaarFileUrl") as string) || undefined,
    aadhaarBackFileKey: (formData.get("aadhaarBackFileKey") as string) || undefined,
    aadhaarBackFileUrl: (formData.get("aadhaarBackFileUrl") as string) || undefined,
    panNumber: (formData.get("panNumber") as string) || undefined,
    panFileKey: (formData.get("panFileKey") as string) || undefined,
    panFileUrl: (formData.get("panFileUrl") as string) || undefined,
  });
  if (!identity.success) {
    return { success: false, message: "Validation failed", errors: identity.error.flatten().fieldErrors };
  }

  try {
    // Same "keep existing file unless a new one was uploaded" rule as
    // updateIdentityDocuments — this popup can be dismissed and reopened
    // across several visits, so a resubmission must not clobber a file
    // uploaded on an earlier pass with an empty one from this pass.
    const current = await db.teamMember.findUnique({
      where: { id: self.id },
      select: {
        aadhaarFileKey: true, aadhaarFileUrl: true,
        aadhaarBackFileKey: true, aadhaarBackFileUrl: true,
        panFileKey: true, panFileUrl: true,
      },
    });

    await db.teamMember.update({
      where: { id: self.id },
      data: {
        gender: personal.data.gender,
        personalEmail: personal.data.personalEmail,
        personalMobile: personal.data.personalMobile,
        alternativeMobile: personal.data.alternativeMobile,
        officialMobile: personal.data.officialMobile,
        // undefined (not null) when unset — leaves the column untouched
        // rather than wiping a date that was already there.
        joiningDate: personal.data.joiningDate ? new Date(personal.data.joiningDate) : undefined,
        joiningDateUnknown: personal.data.joiningDateUnknown,
        fatherName: family.data.fatherName,
        fatherMobile: family.data.fatherMobile,
        motherName: family.data.motherName,
        motherMobile: family.data.motherMobile,
        aadhaarNumber: identity.data.aadhaarNumber,
        panNumber: identity.data.panNumber,
        aadhaarFileKey: identity.data.aadhaarFileKey ?? current?.aadhaarFileKey ?? null,
        aadhaarFileUrl: identity.data.aadhaarFileUrl ?? current?.aadhaarFileUrl ?? null,
        aadhaarBackFileKey: identity.data.aadhaarBackFileKey ?? current?.aadhaarBackFileKey ?? null,
        aadhaarBackFileUrl: identity.data.aadhaarBackFileUrl ?? current?.aadhaarBackFileUrl ?? null,
        panFileKey: identity.data.panFileKey ?? current?.panFileKey ?? null,
        panFileUrl: identity.data.panFileUrl ?? current?.panFileUrl ?? null,
      },
    });
    await createLog({
      action: "UPDATE", entity: "TeamMember", entityId: self.id, entitySlug: self.name,
      newData: { gender: personal.data.gender, joiningDateUnknown: personal.data.joiningDateUnknown },
      metadata: { operation: "complete_onboarding_profile", scope: "self_service" },
    });
    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");
    return { success: true, message: "Thanks for sharing — all set! 🎉" };
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
