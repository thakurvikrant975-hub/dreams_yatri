"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Per-element review findings.
//
// Costing pins a finding to the element it is about, so a rejection reads as
// "day 3's cab rate is wrong" on day 3's cab, rather than as a paragraph the
// exec has to map back onto the itinerary themselves.
//
// Every write re-derives the actor's capabilities server-side. The client
// already hides these controls from anyone who shouldn't have them, but hiding
// a button is a courtesy, not a permission — an action that trusted the caller
// would let any signed-in dashboard user annotate or resolve anything.
// ─────────────────────────────────────────────────────────────────────────────

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getCurrentActor, type ActionResult } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { actionError } from "@/app/lib/action-error";
import {
  resolveWorkspaceCaps, workspaceRoleOf, ownsPackage,
  type WorkspaceStage,
} from "./workspace-caps";
import type { ReviewNoteStatus, ReviewSeverity, ReviewTargetKind } from "@/app/generated/prisma";

export type ReviewNote = {
  id: string;
  targetKind: ReviewTargetKind;
  day: number | null;
  index: number | null;
  severity: ReviewSeverity;
  status: ReviewNoteStatus;
  message: string;
  createdByName: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
  resolvedByName: string | null;
};

/** The actor's team role plus the package's stage — everything
 * resolveWorkspaceCaps needs, fetched in one place so each action below reads
 * the same way. Returns null when the package doesn't exist. */
async function loadContext(packageId: string) {
  // Capabilities follow the EFFECTIVE member so "View As" behaves the way the
  // page it was used from behaves — a dev standing in for costing can raise a
  // finding, or the feature is untestable without real credentials.
  //
  // Authorship stays with the real actor: a finding says who actually wrote it,
  // not who they were pretending to be, or the audit trail lies.
  const [{ teamMemberId, teamMemberName }, memberCtx, pkg] = await Promise.all([
    getCurrentActor(),
    getEffectiveMember(),
    db.custom_packages.findUnique({
      where: { id: packageId },
      select: {
        id: true, status: true, verified: true, rejectedAt: true, revisionRequestedAt: true,
        builtBy: true, query: { select: { assignedTo: true } },
      },
    }),
  ]);

  if (!pkg) return null;

  const stage: WorkspaceStage = {
    status: pkg.status,
    verified: pkg.verified,
    rejectedAt: pkg.rejectedAt,
    revisionRequestedAt: pkg.revisionRequestedAt,
  };
  const role = workspaceRoleOf(memberCtx?.member?.teamRole?.name);

  return {
    teamMemberId, teamMemberName,
    caps: resolveWorkspaceCaps(role, stage, {
      isOwner: ownsPackage({
        viewerId: memberCtx?.member?.id,
        viewerRoleName: memberCtx?.member?.teamRole?.name,
        builtBy: pkg.builtBy,
        queryAssignedTo: pkg.query?.assignedTo,
      }),
    }),
  };
}

/** Every note on a package, newest first.
 *
 * Readable by anyone who can open the package — an exec has to see what costing
 * flagged, or the findings serve no purpose. Only WRITING is gated. */
export async function listReviewNotes(packageId: string): Promise<ReviewNote[]> {
  return db.package_review_notes.findMany({
    where: { customPackageId: packageId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true, targetKind: true, day: true, index: true,
      severity: true, status: true, message: true,
      createdByName: true, createdAt: true,
      resolvedAt: true, resolvedByName: true,
    },
  });
}

export async function addReviewNote(input: {
  packageId: string;
  targetKind: ReviewTargetKind;
  day?: number | null;
  index?: number | null;
  severity: ReviewSeverity;
  message: string;
}): Promise<ActionResult> {
  try {
    const ctx = await loadContext(input.packageId);
    if (!ctx) return { success: false, message: "That package no longer exists." };
    if (!ctx.caps.reviewElements) {
      return { success: false, message: "Only costing can raise findings, and only while the package is under review." };
    }

    const message = input.message.trim();
    if (!message) return { success: false, message: "Say what needs changing." };

    await db.package_review_notes.create({
      data: {
        customPackageId: input.packageId,
        targetKind: input.targetKind,
        // Normalised to null rather than left undefined so a PACKAGE-level note
        // can never inherit a stale day from the caller.
        day: input.day ?? null,
        index: input.index ?? null,
        severity: input.severity,
        message,
        createdById: ctx.teamMemberId,
        createdByName: ctx.teamMemberName,
      },
    });

    revalidatePath(`/dashboard/verify-packages/${input.packageId}`);
    revalidatePath(`/dashboard/package-builder/${input.packageId}`);
    revalidatePath(`/dashboard/package-builder-v2/${input.packageId}`);
    return { success: true, data: undefined, message: "Finding added" };
  } catch (e) {
    console.error("[addReviewNote] FAILED:", e);
    return actionError(e);
  }
}

/** Closes a finding.
 *
 * Costing can close its own findings after correcting something itself. The
 * exec cannot: a finding is the reviewer's statement that something is wrong,
 * and letting the person being reviewed mark it resolved would make an approval
 * gate that anyone can open. The exec fixes the element and resubmits; costing
 * closes it on the next pass. */
export async function resolveReviewNote(packageId: string, noteId: string): Promise<ActionResult> {
  try {
    const ctx = await loadContext(packageId);
    if (!ctx) return { success: false, message: "That package no longer exists." };
    if (!ctx.caps.reviewElements) {
      return { success: false, message: "Only costing can close a finding." };
    }

    // Scoped by package as well as id: a note id alone would let a caller close
    // a finding on someone else's package by guessing.
    const { count } = await db.package_review_notes.updateMany({
      where: { id: noteId, customPackageId: packageId },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
        resolvedById: ctx.teamMemberId,
        resolvedByName: ctx.teamMemberName,
      },
    });
    if (count === 0) return { success: false, message: "That finding no longer exists." };

    revalidatePath(`/dashboard/verify-packages/${packageId}`);
    revalidatePath(`/dashboard/package-builder/${packageId}`);
    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return { success: true, data: undefined, message: "Finding closed" };
  } catch (e) {
    console.error("[resolveReviewNote] FAILED:", e);
    return actionError(e);
  }
}

/** Open findings by severity — drives the queue's badge and the approve
 * button's guard, so "approve" can refuse while errors are still open. */
export async function countOpenFindings(packageId: string): Promise<{ errors: number; suggestions: number }> {
  const rows = await db.package_review_notes.groupBy({
    by: ["severity"],
    where: { customPackageId: packageId, status: "OPEN" },
    _count: { _all: true },
  });
  return {
    errors: rows.find((r) => r.severity === "ERROR")?._count._all ?? 0,
    suggestions: rows.find((r) => r.severity === "SUGGESTION")?._count._all ?? 0,
  };
}

/** Strikes a company-wide standard inclusion/exclusion line off this package,
 * or restores one already struck.
 *
 * Costing only — see WorkspaceCaps.editLockedPolicy. The veto is recorded on
 * the package (removedInclusions/removedExclusions) rather than touching the
 * house lists in Itinerary Settings, so one quote dropping "Airport transfers"
 * never silently changes what every other quote promises.
 */
export async function toggleStandardPolicyLine(
  packageId: string,
  list: "inclusions" | "exclusions",
  text: string,
): Promise<ActionResult> {
  try {
    const ctx = await loadContext(packageId);
    if (!ctx) return { success: false, message: "That package no longer exists." };
    if (!ctx.caps.editLockedPolicy) {
      return { success: false, message: "Only costing can change a standard line, and only during review." };
    }

    const value = text.trim();
    if (!value) return { success: false, message: "Nothing to change." };

    const field = list === "inclusions" ? "removedInclusions" : "removedExclusions";
    const pkg = await db.custom_packages.findUnique({
      where: { id: packageId },
      select: { removedInclusions: true, removedExclusions: true },
    });
    if (!pkg) return { success: false, message: "That package no longer exists." };

    const current = list === "inclusions" ? pkg.removedInclusions : pkg.removedExclusions;
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    await db.custom_packages.update({
      where: { id: packageId },
      data: { [field]: next },
    });

    revalidatePath(`/dashboard/package-builder/${packageId}`);

    revalidatePath(`/dashboard/package-builder-v2/${packageId}`);
    return {
      success: true,
      data: undefined,
      message: current.includes(value) ? "Line restored" : "Line removed from this package",
    };
  } catch (e) {
    console.error("[toggleStandardPolicyLine] FAILED:", e);
    return actionError(e);
  }
}

export type RevisionEntry = {
  id: string;
  note: string;
  byName: string | null;
  at: Date;
  /** What the package was pulled back FROM — an approved-but-unsent package and
   * one already with the client are very different things to have recalled. */
  fromStatus: string | null;
  wasVerified: boolean | null;
};

/** Every time this package was pulled back for another look, newest first.
 *
 * custom_packages keeps only the latest revision — each request overwrites the
 * last — so this reads the activity log instead, where each one was recorded
 * separately. A package pulled back three times for the same reason is a
 * different conversation from one pulled back once, and only the series shows
 * that.
 */
export async function getRevisionHistory(packageId: string): Promise<RevisionEntry[]> {
  const rows = await db.activityLog.findMany({
    where: { entity: "CustomPackageRevision", entityId: packageId },
    orderBy: { actionAt: "desc" },
    select: { id: true, description: true, userName: true, actionAt: true, metadata: true },
    take: 50,
  });
  return rows.map((r) => {
    const meta = (r.metadata ?? {}) as { fromStatus?: string; wasVerified?: boolean };
    return {
      id: r.id,
      note: r.description ?? "",
      byName: r.userName,
      at: r.actionAt,
      fromStatus: meta.fromStatus ?? null,
      wasVerified: meta.wasVerified ?? null,
    };
  });
}
