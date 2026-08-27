"use server";

import { db } from "@/app/lib/db";
import { getCurrentMember } from "./get-current-member";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const PAGE_SIZE = 20;

/** Cursor pagination (not skip/take) — the list keeps growing as new
 * notifications land, so an offset-based "page 2" would drift and repeat or
 * skip rows exactly when someone has the panel open long enough to load
 * more. `cursor` is the last id already shown. */
export async function listMyNotifications(cursor?: string): Promise<{ rows: NotificationRow[]; hasMore: boolean }> {
  const member = await getCurrentMember();
  if (!member) return { rows: [], hasMore: false };

  const rows = await db.notification.findMany({
    where: { recipientId: member.id },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = rows.length > PAGE_SIZE;
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  return {
    rows: page.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      body: r.body,
      link: r.link,
      readAt: r.readAt ? r.readAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
    })),
    hasMore,
  };
}

export async function getUnreadNotificationCount(): Promise<number> {
  const member = await getCurrentMember();
  if (!member) return 0;
  return db.notification.count({ where: { recipientId: member.id, readAt: null } });
}

export async function markNotificationRead(id: string): Promise<void> {
  const member = await getCurrentMember();
  if (!member) return;
  await db.notification.updateMany({
    where: { id, recipientId: member.id, readAt: null },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const member = await getCurrentMember();
  if (!member) return;
  await db.notification.updateMany({
    where: { recipientId: member.id, readAt: null },
    data: { readAt: new Date() },
  });
}
