"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { getLeaderScope, getSubmitterTeam } from "@/app/lib/sales-teams/leader-scope";
import { notifyMember } from "@/app/services/notifications/notify";
import type { TemplateApprovalStatus } from "@/app/generated/prisma";

export type PackageTemplateSnapshotDay = {
  day: number;
  title: string;
  description: string | null;
  meals: string[];
  extraMeals: string[];
  accommodation: string | null;
  accommodationLocation: string | null;
  accommodationStarRating: string | null;
  accommodationRoomSpecs: string | null;
  transport: string | null;
  transportVehicleType: string | null;
  transportSeats: number | null;
  notes: string | null;
  notesTitle: string | null;
  notesType: string | null;
  activities: {
    title: string; description: string | null;
    photo: string | null; photos: string[]; photoLabels: string[];
  }[];
};

export type PackageTemplateSnapshot = {
  inclusions: string[];
  exclusions: string[];
  termsNotes: string | null;
  termsConditions: string[];
  paymentPolicy: string[];
  amendmentPolicy: string[];
  pricePerPerson: number | null;
  totalPrice: number | null;
  currency: string;
  days: PackageTemplateSnapshotDay[];
};

async function getAuthenticatedMember() {
  const session = await dashboardAuth();
  if (!session?.user?.email) return null;
  return db.teamMember.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  });
}

// ── Save to Library ──────────────────────────────────────────────────────────

/** Counts templates already in the library for a destination — not the trip's
 * own booked packages. Shown in the Save to Library dialog so whoever is
 * submitting can see, before they commit, whether this destination already
 * has coverage or would be the first. Excludes rejected submissions, same as
 * the duplicate-source check below, since a rejected template isn't really
 * "in the library". Case/whitespace-insensitive: destinations are free text
 * ("Goa" vs "goa " vs "GOA") rather than a fixed list. */
export async function getLibraryDestinationCount(destination: string): Promise<number> {
  const actor = await getAuthenticatedMember();
  if (!actor) return 0;

  const trimmed = destination.trim();
  if (!trimmed) return 0;

  return db.packageTemplate.count({
    where: { status: { not: "REJECTED" }, destination: { equals: trimmed, mode: "insensitive" } },
  });
}

export async function saveCustomPackageToLibrary(
  customPackageId: string,
  /** Lets the Save to Library dialog submit an edited title/description/
   * destination without first writing them back onto the source package —
   * the template is its own record, and a team's library-facing name for a
   * stay ("Goa Beach Escape") is often not the internal booking title
   * ("Sharma Family — 4N Goa"). Falls back to the package's own fields when
   * omitted, so a bare call behaves exactly as it always has. */
  overrides?: { title?: string; description?: string; destination?: string },
): Promise<{ success: true; packageTemplateId: string; activityCount: number } | { success: false; error: string }> {
  const actor = await getAuthenticatedMember();
  if (!actor) return { success: false, error: "Unauthorized" };

  const pkg = await db.custom_packages.findUnique({
    where: { id: customPackageId },
    select: {
      id: true, title: true, description: true, coverImage: true, destination: true,
      totalDays: true, totalNights: true, verified: true,
      inclusions: true, exclusions: true, termsNotes: true, termsConditions: true,
      paymentPolicy: true, amendmentPolicy: true, pricePerPerson: true, totalPrice: true, currency: true,
      itineraries: {
        orderBy: { day: "asc" },
        select: {
          day: true, title: true, description: true, meals: true, extraMeals: true,
          accommodation: true, accommodationLocation: true, accommodationStarRating: true, accommodationRoomSpecs: true,
          transport: true, transportVehicleType: true, transportSeats: true,
          notes: true, notesTitle: true, notesType: true,
          activities: {
            orderBy: { sortOrder: "asc" },
            select: { title: true, description: true, photo: true, photos: true, photoLabels: true },
          },
        },
      },
    },
  });
  if (!pkg) return { success: false, error: "Package not found" };
  if (!pkg.verified) return { success: false, error: "Only a costing-approved package can be saved to the library" };

  const existing = await db.packageTemplate.findFirst({
    where: { sourcePackageId: customPackageId, status: { not: "REJECTED" } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "This package has already been saved to the library" };

  const { teamId, teamName } = await getSubmitterTeam(actor.id);

  const snapshot: PackageTemplateSnapshot = {
    inclusions: pkg.inclusions,
    exclusions: pkg.exclusions,
    termsNotes: pkg.termsNotes,
    termsConditions: pkg.termsConditions,
    paymentPolicy: pkg.paymentPolicy,
    amendmentPolicy: pkg.amendmentPolicy,
    pricePerPerson: pkg.pricePerPerson,
    totalPrice: pkg.totalPrice,
    currency: pkg.currency,
    days: pkg.itineraries.map((it) => ({
      day: it.day,
      title: it.title,
      description: it.description,
      meals: it.meals,
      extraMeals: it.extraMeals,
      accommodation: it.accommodation,
      accommodationLocation: it.accommodationLocation,
      accommodationStarRating: it.accommodationStarRating,
      accommodationRoomSpecs: it.accommodationRoomSpecs,
      transport: it.transport,
      transportVehicleType: it.transportVehicleType,
      transportSeats: it.transportSeats,
      notes: it.notes,
      notesTitle: it.notesTitle,
      notesType: it.notesType,
      activities: it.activities,
    })),
  };

  const flattenedActivities = pkg.itineraries.flatMap((it) =>
    it.activities
      .filter((a) => a.title.trim())
      .map((a) => ({ ...a, day: it.day })),
  );

  const resolvedTitle = overrides?.title?.trim() || pkg.title;
  const resolvedDescription = overrides?.description?.trim() || pkg.description;
  const resolvedDestination = overrides?.destination?.trim() || pkg.destination;

  const created = await db.$transaction(async (tx) => {
    const template = await tx.packageTemplate.create({
      data: {
        title: resolvedTitle,
        description: resolvedDescription,
        destination: resolvedDestination,
        coverImage: pkg.coverImage,
        totalDays: pkg.totalDays,
        totalNights: pkg.totalNights,
        snapshot: snapshot as object,
        sourcePackageId: pkg.id,
        sourcePackageTitle: pkg.title,
        submittedById: actor.id,
        submittedByName: actor.name,
        submittedByTeamId: teamId,
        submittedByTeamName: teamName,
      },
    });

    if (flattenedActivities.length > 0) {
      await tx.activityTemplate.createMany({
        data: flattenedActivities.map((a) => ({
          title: a.title,
          description: a.description,
          photo: a.photo,
          photos: a.photos,
          photoLabels: a.photoLabels,
          day: a.day,
          destination: resolvedDestination,
          packageTemplateId: template.id,
          submittedById: actor.id,
          submittedByName: actor.name,
          submittedByTeamId: teamId,
          submittedByTeamName: teamName,
        })),
      });
    }

    return template;
  });

  if (teamId) {
    const leader = await db.salesTeam.findUnique({ where: { id: teamId }, select: { leaderId: true } });
    if (leader?.leaderId) {
      await notifyMember({
        recipientId: leader.leaderId,
        type: "LIBRARY_PACKAGE_SUBMITTED",
        title: `${actor.name} saved "${resolvedTitle}" to the library`,
        body: `${flattenedActivities.length} activit${flattenedActivities.length === 1 ? "y" : "ies"} included — awaiting your review.`,
        link: "/dashboard/package-templates",
      });
    }
  }

  revalidatePath("/dashboard/package-templates");
  revalidatePath("/dashboard/activity-templates");
  return { success: true, packageTemplateId: created.id, activityCount: flattenedActivities.length };
}

// ── Review queue ──────────────────────────────────────────────────────────────

export type PackageTemplateRow = {
  id: string;
  title: string;
  description: string | null;
  destination: string | null;
  coverImage: string | null;
  totalDays: number;
  totalNights: number;
  sourcePackageId: string | null;
  submittedById: string;
  submittedByName: string;
  submittedByTeamId: string | null;
  submittedByTeamName: string | null;
  submittedAt: Date;
  status: TemplateApprovalStatus;
  approvedByName: string | null;
  approvedAt: Date | null;
  rejectedByName: string | null;
  rejectedAt: Date | null;
  rejectionNote: string | null;
  activityCount: number;
  canManage: boolean;
};

export async function getPackageTemplatesForReview(): Promise<{
  rows: PackageTemplateRow[];
  ledTeamId: string | null;
} | null> {
  const scope = await getLeaderScope();
  if (!scope) return null;

  const templates = await db.packageTemplate.findMany({
    orderBy: { submittedAt: "desc" },
    include: { _count: { select: { activities: true } } },
  });

  return {
    ledTeamId: scope.ledTeamId,
    rows: templates.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      destination: t.destination,
      coverImage: t.coverImage,
      totalDays: t.totalDays,
      totalNights: t.totalNights,
      sourcePackageId: t.sourcePackageId,
      submittedById: t.submittedById,
      submittedByName: t.submittedByName,
      submittedByTeamId: t.submittedByTeamId,
      submittedByTeamName: t.submittedByTeamName,
      submittedAt: t.submittedAt,
      status: t.status,
      approvedByName: t.approvedByName,
      approvedAt: t.approvedAt,
      rejectedByName: t.rejectedByName,
      rejectedAt: t.rejectedAt,
      rejectionNote: t.rejectionNote,
      activityCount: t._count.activities,
      canManage: !!scope.ledTeamId && scope.ledTeamId === t.submittedByTeamId,
    })),
  };
}

export async function getPackageTemplateSnapshot(id: string): Promise<PackageTemplateSnapshot | null> {
  const row = await db.packageTemplate.findUnique({ where: { id }, select: { snapshot: true } });
  return (row?.snapshot as unknown as PackageTemplateSnapshot) ?? null;
}

async function assertCanManage(id: string): Promise<{ ok: true; actorId: string; actorName: string } | { ok: false; error: string }> {
  const scope = await getLeaderScope();
  if (!scope) return { ok: false, error: "Unauthorized" };

  const template = await db.packageTemplate.findUnique({ where: { id }, select: { submittedByTeamId: true } });
  if (!template) return { ok: false, error: "Template not found" };
  if (!scope.ledTeamId || scope.ledTeamId !== template.submittedByTeamId) {
    return { ok: false, error: "Only the submitter's own team leader can act on this" };
  }
  return { ok: true, actorId: scope.actorId, actorName: scope.actorName };
}

export async function approvePackageTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  const auth = await assertCanManage(id);
  if (!auth.ok) return { success: false, error: auth.error };

  const template = await db.packageTemplate.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: auth.actorId, approvedByName: auth.actorName, approvedAt: new Date(),
      rejectedById: null, rejectedByName: null, rejectedAt: null, rejectionNote: null,
    },
    select: { title: true, submittedById: true, sourcePackageId: true },
  });

  await notifyMember({
    recipientId: template.submittedById,
    type: "LIBRARY_PACKAGE_APPROVED",
    title: `"${template.title}" approved for the library`,
    link: template.sourcePackageId ? `/dashboard/package-builder/${template.sourcePackageId}` : null,
  });

  revalidatePath("/dashboard/package-templates");
  return { success: true };
}

export async function rejectPackageTemplate(id: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = reason.trim();
  if (!trimmed) return { success: false, error: "A reason is required to reject" };

  const auth = await assertCanManage(id);
  if (!auth.ok) return { success: false, error: auth.error };

  const template = await db.packageTemplate.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectedById: auth.actorId, rejectedByName: auth.actorName, rejectedAt: new Date(), rejectionNote: trimmed,
      approvedById: null, approvedByName: null, approvedAt: null,
    },
    select: { title: true, submittedById: true, sourcePackageId: true },
  });

  await notifyMember({
    recipientId: template.submittedById,
    type: "LIBRARY_PACKAGE_REJECTED",
    title: `"${template.title}" was not approved for the library`,
    body: trimmed,
    link: template.sourcePackageId ? `/dashboard/package-builder/${template.sourcePackageId}` : null,
  });

  revalidatePath("/dashboard/package-templates");
  return { success: true };
}

export async function updatePackageTemplate(
  id: string,
  fields: { title: string; description: string; destination: string },
): Promise<{ success: boolean; error?: string }> {
  const auth = await assertCanManage(id);
  if (!auth.ok) return { success: false, error: auth.error };

  await db.packageTemplate.update({
    where: { id },
    data: {
      title: fields.title.trim(),
      description: fields.description.trim() || null,
      destination: fields.destination.trim() || null,
    },
  });

  revalidatePath("/dashboard/package-templates");
  return { success: true };
}
