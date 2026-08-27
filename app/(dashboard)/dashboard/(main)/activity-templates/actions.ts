"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { getLeaderScope } from "@/app/lib/sales-teams/leader-scope";
import { notifyMember } from "@/app/services/notifications/notify";
import type { TemplateApprovalStatus } from "@/app/generated/prisma";

export type ActivityTemplateRow = {
  id: string;
  title: string;
  description: string | null;
  photo: string | null;
  photos: string[];
  photoLabels: string[];
  day: number;
  destination: string | null;
  packageTemplateId: string;
  packageTemplateTitle: string;
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
  canManage: boolean;
};

export async function getActivityTemplatesForReview(): Promise<{
  rows: ActivityTemplateRow[];
  ledTeamId: string | null;
} | null> {
  const scope = await getLeaderScope();
  if (!scope) return null;

  const activities = await db.activityTemplate.findMany({
    orderBy: { submittedAt: "desc" },
    include: { packageTemplate: { select: { title: true } } },
  });

  return {
    ledTeamId: scope.ledTeamId,
    rows: activities.map((a) => ({
      id: a.id,
      title: a.title,
      description: a.description,
      photo: a.photo,
      photos: a.photos,
      photoLabels: a.photoLabels,
      day: a.day,
      destination: a.destination,
      packageTemplateId: a.packageTemplateId,
      packageTemplateTitle: a.packageTemplate.title,
      submittedById: a.submittedById,
      submittedByName: a.submittedByName,
      submittedByTeamId: a.submittedByTeamId,
      submittedByTeamName: a.submittedByTeamName,
      submittedAt: a.submittedAt,
      status: a.status,
      approvedByName: a.approvedByName,
      approvedAt: a.approvedAt,
      rejectedByName: a.rejectedByName,
      rejectedAt: a.rejectedAt,
      rejectionNote: a.rejectionNote,
      canManage: !!scope.ledTeamId && scope.ledTeamId === a.submittedByTeamId,
    })),
  };
}

async function assertCanManage(id: string): Promise<{ ok: true; actorId: string; actorName: string } | { ok: false; error: string }> {
  const scope = await getLeaderScope();
  if (!scope) return { ok: false, error: "Unauthorized" };

  const activity = await db.activityTemplate.findUnique({ where: { id }, select: { submittedByTeamId: true } });
  if (!activity) return { ok: false, error: "Activity not found" };
  if (!scope.ledTeamId || scope.ledTeamId !== activity.submittedByTeamId) {
    return { ok: false, error: "Only the submitter's own team leader can act on this" };
  }
  return { ok: true, actorId: scope.actorId, actorName: scope.actorName };
}

export async function approveActivityTemplate(id: string): Promise<{ success: boolean; error?: string }> {
  const auth = await assertCanManage(id);
  if (!auth.ok) return { success: false, error: auth.error };

  const activity = await db.activityTemplate.update({
    where: { id },
    data: {
      status: "APPROVED",
      approvedById: auth.actorId, approvedByName: auth.actorName, approvedAt: new Date(),
      rejectedById: null, rejectedByName: null, rejectedAt: null, rejectionNote: null,
    },
    select: { title: true, submittedById: true },
  });

  await notifyMember({
    recipientId: activity.submittedById,
    type: "LIBRARY_ACTIVITY_APPROVED",
    title: `"${activity.title}" approved for the activity library`,
  });

  revalidatePath("/dashboard/activity-templates");
  return { success: true };
}

export async function rejectActivityTemplate(id: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = reason.trim();
  if (!trimmed) return { success: false, error: "A reason is required to reject" };

  const auth = await assertCanManage(id);
  if (!auth.ok) return { success: false, error: auth.error };

  const activity = await db.activityTemplate.update({
    where: { id },
    data: {
      status: "REJECTED",
      rejectedById: auth.actorId, rejectedByName: auth.actorName, rejectedAt: new Date(), rejectionNote: trimmed,
      approvedById: null, approvedByName: null, approvedAt: null,
    },
    select: { title: true, submittedById: true },
  });

  await notifyMember({
    recipientId: activity.submittedById,
    type: "LIBRARY_ACTIVITY_REJECTED",
    title: `"${activity.title}" was not approved for the activity library`,
    body: trimmed,
  });

  revalidatePath("/dashboard/activity-templates");
  return { success: true };
}

export async function updateActivityTemplate(
  id: string,
  fields: { title: string; description: string },
): Promise<{ success: boolean; error?: string }> {
  const auth = await assertCanManage(id);
  if (!auth.ok) return { success: false, error: auth.error };

  await db.activityTemplate.update({
    where: { id },
    data: {
      title: fields.title.trim(),
      description: fields.description.trim() || null,
    },
  });

  revalidatePath("/dashboard/activity-templates");
  return { success: true };
}
