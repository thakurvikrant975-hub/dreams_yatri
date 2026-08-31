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

/** Shared by every path that turns a real `custom_packages` row into
 * template-shaped data: the original Save to Library create, and Save to
 * Template's write-back from a working copy (see getOrCreateTemplateWorkingCopy
 * below). Kept as one function so the day/activity field mapping can't drift
 * between the two — a field added to the snapshot shape only needs updating
 * here. */
async function buildSnapshotFromPackage(customPackageId: string) {
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
  if (!pkg) return null;

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

  return { pkg, snapshot, flattenedActivities };
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

  const built = await buildSnapshotFromPackage(customPackageId);
  if (!built) return { success: false, error: "Package not found" };
  const { pkg, snapshot, flattenedActivities } = built;
  if (!pkg.verified) return { success: false, error: "Only a costing-approved package can be saved to the library" };

  const existing = await db.packageTemplate.findFirst({
    where: { sourcePackageId: customPackageId, status: { not: "REJECTED" } },
    select: { id: true },
  });
  if (existing) return { success: false, error: "This package has already been saved to the library" };

  const { teamId, teamName } = await getSubmitterTeam(actor.id);

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

// ── Edit in Builder ──────────────────────────────────────────────────────────
//
// A PackageTemplate's `snapshot` is flat, catalog-free text — nothing like
// the real custom_packages/custom_itineraries rows the package builder is
// built around (live hotel/cab search, pricing, a client, dates). So editing
// a template's content with the full builder means cloning the snapshot into
// a hidden, disposable custom_packages row (a "working copy", linked back via
// custom_packages' own templateId field) and opening the builder against
// THAT row's id — the real source package is never touched. Save to Template
// (below) writes the working copy's current state back into the snapshot.
//
// The working copy never needs excluding from any real dashboard/report: it's
// created DRAFT with no queryId, and this flow never marks it READY, sends
// it, or requests a hotel for it — every queue that matters (costing review,
// hotel requests, the follow-up cron) is already gated on
// readyAt/status/hotelPending/sentAt, none of which this row ever gets.

/** Team-leader-only (same assertCanManage rule as approve/reject). Returns
 * the working-copy package id for this template, creating one on first use
 * and reusing it on every later "Edit in Builder" click — edits accumulate on
 * the working copy across sessions and only reach the template when Save to
 * Template is explicitly clicked. */
export async function getOrCreateTemplateWorkingCopy(
  templateId: string,
): Promise<{ success: true; packageId: string } | { success: false; error: string }> {
  const auth = await assertCanManage(templateId);
  if (!auth.ok) return { success: false, error: auth.error };

  const existing = await db.custom_packages.findFirst({ where: { templateId }, select: { id: true } });
  if (existing) return { success: true, packageId: existing.id };

  const template = await db.packageTemplate.findUnique({
    where: { id: templateId },
    select: {
      title: true, description: true, destination: true, coverImage: true,
      totalDays: true, totalNights: true, snapshot: true,
    },
  });
  if (!template) return { success: false, error: "Template not found" };
  const snapshot = template.snapshot as unknown as PackageTemplateSnapshot;

  const created = await db.custom_packages.create({
    data: {
      title: template.title,
      description: template.description,
      coverImage: template.coverImage,
      destination: template.destination ?? "",
      totalDays: template.totalDays,
      totalNights: template.totalNights,
      builtBy: auth.actorId,
      builtByName: auth.actorName,
      templateId,
      inclusions: snapshot.inclusions,
      exclusions: snapshot.exclusions,
      termsNotes: snapshot.termsNotes,
      termsConditions: snapshot.termsConditions,
      paymentPolicy: snapshot.paymentPolicy,
      amendmentPolicy: snapshot.amendmentPolicy,
      // Not part of PackageTemplateSnapshot — Save to Library never captured
      // it either, so there's nothing to restore. The column has no DB
      // default, so it needs an explicit value; the builder's own autosave
      // reseeds it from itinerary_settings on the working copy's first save,
      // same as any other blank package.
      travelBenefits: [],
      pricePerPerson: snapshot.pricePerPerson,
      totalPrice: snapshot.totalPrice,
      currency: snapshot.currency,
      itineraries: {
        create: snapshot.days.map((d) => ({
          day: d.day,
          title: d.title,
          description: d.description,
          meals: d.meals,
          extraMeals: d.extraMeals,
          accommodation: d.accommodation,
          accommodationLocation: d.accommodationLocation,
          accommodationStarRating: d.accommodationStarRating,
          accommodationRoomSpecs: d.accommodationRoomSpecs,
          transport: d.transport,
          transportVehicleType: d.transportVehicleType,
          transportSeats: d.transportSeats,
          notes: d.notes,
          notesTitle: d.notesTitle,
          notesType: d.notesType,
          activities: {
            create: d.activities
              .filter((a) => a.title.trim())
              .map((a) => ({
                title: a.title, description: a.description,
                photo: a.photo, photos: a.photos, photoLabels: a.photoLabels,
              })),
          },
        })),
      },
    },
    select: { id: true },
  });

  return { success: true, packageId: created.id };
}

/** Team-leader-only. Writes the working copy's current state back into the
 * template's snapshot + top-level fields, and refreshes the template's
 * ActivityTemplate rows to match — the reverse of getOrCreateTemplateWorkingCopy,
 * sharing the same snapshot-building logic Save to Library uses. */
export async function saveTemplateWorkingCopy(
  templateId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  const auth = await assertCanManage(templateId);
  if (!auth.ok) return { success: false, error: auth.error };

  const workingCopy = await db.custom_packages.findFirst({ where: { templateId }, select: { id: true } });
  if (!workingCopy) return { success: false, error: "No working copy found — open it from Edit in Builder first" };

  const built = await buildSnapshotFromPackage(workingCopy.id);
  if (!built) return { success: false, error: "Working copy package not found" };
  const { pkg, snapshot, flattenedActivities } = built;

  const { teamId, teamName } = await getSubmitterTeam(auth.actorId);

  await db.$transaction(async (tx) => {
    await tx.packageTemplate.update({
      where: { id: templateId },
      data: {
        title: pkg.title,
        description: pkg.description,
        destination: pkg.destination,
        coverImage: pkg.coverImage,
        totalDays: pkg.totalDays,
        totalNights: pkg.totalNights,
        snapshot: snapshot as object,
      },
    });

    // Replaced wholesale rather than diffed — simpler, and cheap enough for
    // a per-template activity list (the create path does the same on first
    // save, just with nothing to delete yet).
    await tx.activityTemplate.deleteMany({ where: { packageTemplateId: templateId } });
    if (flattenedActivities.length > 0) {
      await tx.activityTemplate.createMany({
        data: flattenedActivities.map((a) => ({
          title: a.title,
          description: a.description,
          photo: a.photo,
          photos: a.photos,
          photoLabels: a.photoLabels,
          day: a.day,
          destination: pkg.destination,
          packageTemplateId: templateId,
          submittedById: auth.actorId,
          submittedByName: auth.actorName,
          submittedByTeamId: teamId,
          submittedByTeamName: teamName,
        })),
      });
    }
  });

  revalidatePath("/dashboard/package-templates");
  revalidatePath("/dashboard/activity-templates");
  return { success: true };
}
