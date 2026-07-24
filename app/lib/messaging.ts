import "server-only";
import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { uploadToR2 } from "@/app/lib/r2/r2upload";

/**
 * A booking is "paid" for messaging purposes once real money has moved —
 * matches the existing convention used by verify-hotels/verify-cabs/
 * assign-driver (an allow-list, not "anything but PENDING/FAILED"), so a
 * REFUNDED/PARTIALLY_REFUNDED booking is treated as unpaid here too: chat
 * closes back down once a booking is no longer a live, paid stay.
 */
const PAID_STATUSES = new Set(["ADVANCE_PAID", "FULLY_PAID"]);
export function isPaidStatus(status: string): boolean {
  return PAID_STATUSES.has(status);
}

export type ConversationAuth =
  | { ok: true; role: "HOST" | "GUEST"; actorId: string }
  | { ok: false; reason: string };

/**
 * Authorize access to a (bookingId, hotelId) conversation for whichever
 * session is present — the guest who made the booking, or the owner of that
 * hotel — gated on the booking actually having been paid for. Used by the
 * Ably token endpoint (which doesn't know in advance which side is asking)
 * and reusable anywhere else both sides need the same check.
 */
export async function authorizeConversationAccess(bookingId: string, hotelId: number): Promise<ConversationAuth> {
  const link = await db.bookingHotel.findFirst({
    where: { bookingId, hotelId },
    select: {
      booking: { select: { userId: true, paymentStatus: true } },
      hotel: { select: { owner_id: true } },
    },
  });
  if (!link) return { ok: false, reason: "Conversation not found." };
  if (!isPaidStatus(link.booking.paymentStatus)) {
    return { ok: false, reason: "This booking hasn't been paid for yet." };
  }

  const guest = await getAuthenticatedUser();
  if (guest?.id && guest.id === link.booking.userId) {
    return { ok: true, role: "GUEST", actorId: guest.id };
  }

  const owner = await hotelConnectAuth();
  if (owner?.user?.id && owner.user.id === link.hotel.owner_id) {
    return { ok: true, role: "HOST", actorId: owner.user.id };
  }

  return { ok: false, reason: "You don't have access to this conversation." };
}

// ── Attachments ──────────────────────────────────────────────────────────────

/** One file per message (send another message for another file) — matches
 * how WhatsApp/Slack/Intercom actually work, and keeps the schema/UI simple
 * (a few nullable columns on the message row, no attachments join table). */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_ATTACHMENT_TYPE_PREFIXES = ["image/"];
const ALLOWED_ATTACHMENT_EXACT_TYPES = ["application/pdf"];

export function isAllowedAttachmentType(contentType: string): boolean {
  return (
    ALLOWED_ATTACHMENT_TYPE_PREFIXES.some((p) => contentType.startsWith(p)) ||
    ALLOWED_ATTACHMENT_EXACT_TYPES.includes(contentType)
  );
}

export type ConversationAttachment = {
  url: string;
  name: string;
  type: string;
  size: number;
};

/** Validates then uploads a chat attachment to R2 — shared by both the guest
 * and host send-paths so validation can never drift between the two sides. */
export async function uploadConversationAttachment(
  file: Buffer,
  fileName: string,
  contentType: string,
): Promise<{ ok: true; attachment: ConversationAttachment } | { ok: false; error: string }> {
  if (file.byteLength === 0) return { ok: false, error: "The selected file is empty." };
  if (file.byteLength > MAX_ATTACHMENT_BYTES) {
    return { ok: false, error: `File is too large (max ${MAX_ATTACHMENT_BYTES / (1024 * 1024)}MB).` };
  }
  if (!isAllowedAttachmentType(contentType)) {
    return { ok: false, error: "Unsupported file type — only images and PDFs are allowed." };
  }

  const { url } = await uploadToR2({ file, folder: "chat-attachments", fileName, contentType });
  return { ok: true, attachment: { url, name: fileName, type: contentType, size: file.byteLength } };
}
