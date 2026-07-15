"use server";

import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

export type OwnerNotification = {
  id: number;
  type: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function listOwnerNotifications(): Promise<OwnerNotification[]> {
  const session = await hotelConnectAuth();
  if (!session) return [];

  const rows = await db.hotelOwnerNotification.findMany({
    where: { owner_id: session.user.id },
    orderBy: { created_at: "desc" },
    take: 20,
  });

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    link: r.link,
    readAt: r.read_at ? r.read_at.toISOString() : null,
    createdAt: r.created_at.toISOString(),
  }));
}

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await hotelConnectAuth();
  if (!session) return 0;
  return db.hotelOwnerNotification.count({
    where: { owner_id: session.user.id, read_at: null },
  });
}

export async function markNotificationRead(id: number): Promise<void> {
  const session = await hotelConnectAuth();
  if (!session) return;
  await db.hotelOwnerNotification.updateMany({
    where: { id, owner_id: session.user.id, read_at: null },
    data: { read_at: new Date() },
  });
}

export async function markAllNotificationsRead(): Promise<void> {
  const session = await hotelConnectAuth();
  if (!session) return;
  await db.hotelOwnerNotification.updateMany({
    where: { owner_id: session.user.id, read_at: null },
    data: { read_at: new Date() },
  });
}
