"use server";

import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

const MAX_MESSAGE_LENGTH = 4000;

export async function submitDashboardFeedback(
  message: string,
  pagePath: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) return { ok: false, error: "You must be signed in to send feedback." };

  const trimmed = message.trim();
  if (!trimmed) return { ok: false, error: "Please enter some feedback before sending." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { ok: false, error: `Feedback is too long (max ${MAX_MESSAGE_LENGTH} characters).` };
  }

  try {
    await db.hotelOwnerFeedback.create({
      data: {
        owner_id: session.user.id,
        message: trimmed,
        page_path: pagePath,
      },
    });
    return { ok: true };
  } catch (err) {
    console.error("[submitDashboardFeedback]", err);
    return { ok: false, error: "Failed to send feedback. Please try again." };
  }
}
