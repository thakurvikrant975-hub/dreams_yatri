import "server-only";
import { db } from "@/app/lib/db";
import { publishNotification } from "@/app/lib/ably";

/**
 * The single write path for the dashboard header's notification bell — every
 * event that used to only fire a client-side toast (package approved/
 * rejected by costing, a hotel request filled/rejected, …) now also creates
 * one of these, so it survives a page reload and shows up for the recipient
 * even if they weren't looking at the screen when it happened.
 *
 * Persists first, publishes second — the Ably push is a live-refresh nicety
 * on top of the always-correct row (mirrors publishVerificationCounts' own
 * stance); a missing/misconfigured ABLY_API_KEY only costs the live update,
 * never the notification itself, and the bell's own next server-rendered
 * load picks it up regardless.
 */
export async function notifyMember(params: {
  recipientId: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}): Promise<void> {
  try {
    const notification = await db.notification.create({
      data: {
        recipientId: params.recipientId,
        type: params.type,
        title: params.title,
        body: params.body ?? null,
        link: params.link ?? null,
      },
    });

    await publishNotification(params.recipientId, {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      createdAt: notification.createdAt.toISOString(),
    });
  } catch (e) {
    console.error("[notifyMember]", params.type, e);
  }
}
