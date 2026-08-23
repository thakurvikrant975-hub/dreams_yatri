"use server";

import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { db } from "@/app/lib/db";

export type TeamNotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  severity: string;
  readAt: string | null;
  createdAt: string;
};

async function currentMemberId(): Promise<string | null> {
  const session = await dashboardAuth();
  const email = session?.user?.email;
  if (!email) return null;
  const member = await db.teamMember.findUnique({ where: { email }, select: { id: true } });
  return member?.id ?? null;
}

export async function listMyNotifications(): Promise<TeamNotificationRow[]> {
  const memberId = await currentMemberId();
  if (!memberId) return [];

  const rows = await db.teamNotification.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    severity: r.severity,
    readAt: r.readAt ? r.readAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getMyUnreadNotificationCount(): Promise<number> {
  const memberId = await currentMemberId();
  if (!memberId) return 0;
  return db.teamNotification.count({ where: { memberId, readAt: null } });
}

export async function markNotificationRead(id: string): Promise<void> {
  const memberId = await currentMemberId();
  if (!memberId) return;
  await db.teamNotification.updateMany({
    where: { id, memberId, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const memberId = await currentMemberId();
  if (!memberId) return;
  await db.teamNotification.updateMany({
    where: { memberId, readAt: null },
    data: { readAt: new Date() },
  });
}
