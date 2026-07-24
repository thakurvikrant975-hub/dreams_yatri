"use server";

import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { db } from "@/app/lib/db";
import { publishConversationMessage } from "@/app/lib/ably";
import { isPaidStatus, uploadConversationAttachment } from "@/app/lib/messaging";

export type GuestConversationMessage = {
  id: number;
  sender: "HOST" | "GUEST" | "SYSTEM" | "AGENT";
  body: string;
  createdAt: Date;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentType?: string | null;
  attachmentSize?: number | null;
  isDeleted?: boolean;
};

const MESSAGE_SELECT = {
  id: true, sender: true, body: true, created_at: true,
  attachment_url: true, attachment_name: true, attachment_type: true, attachment_size: true,
  is_deleted: true,
} as const;

function toGuestMessage(m: {
  id: number; sender: string; body: string; created_at: Date;
  attachment_url: string | null; attachment_name: string | null; attachment_type: string | null; attachment_size: number | null;
  is_deleted: boolean;
}): GuestConversationMessage {
  return {
    id: m.id,
    sender: m.sender as GuestConversationMessage["sender"],
    body: m.is_deleted ? "" : m.body,
    createdAt: m.created_at,
    attachmentUrl: m.is_deleted ? null : m.attachment_url,
    attachmentName: m.is_deleted ? null : m.attachment_name,
    attachmentType: m.is_deleted ? null : m.attachment_type,
    attachmentSize: m.is_deleted ? null : m.attachment_size,
    isDeleted: m.is_deleted,
  };
}

/** Resolves the guest's own hotel for this booking, gated on ownership + payment. */
async function loadGuestHotelLink(bookingId: string, userId: string): Promise<{ hotelId: number; hotelName: string } | null> {
  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    select: {
      userId: true,
      paymentStatus: true,
      hotelBookings: { take: 1, select: { hotelId: true, hotel: { select: { name: true } } } },
    },
  });
  if (!booking || booking.userId !== userId) return null;
  if (!isPaidStatus(booking.paymentStatus)) return null;
  const stay = booking.hotelBookings[0];
  if (!stay) return null;
  return { hotelId: stay.hotelId, hotelName: stay.hotel.name };
}

export async function getGuestConversation(bookingId: string): Promise<{
  error?: string;
  hotelId?: number;
  hotelName?: string;
  messages?: GuestConversationMessage[];
}> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return { error: "Please log in." };
  const link = await loadGuestHotelLink(bookingId, user.id);
  if (!link) return { error: "This booking's chat isn't available yet." };

  const conversation = await db.conversation.findUnique({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: link.hotelId } },
    select: {
      id: true,
      messages: { orderBy: { created_at: "asc" }, select: MESSAGE_SELECT },
    },
  });

  // Mark every unread host message as read now that the guest has opened the thread.
  if (conversation) {
    await db.conversation_message.updateMany({
      where: { conversation_id: conversation.id, sender: "HOST", read_by_guest: false },
      data: { read_by_guest: true },
    });
  }

  return {
    hotelId: link.hotelId,
    hotelName: link.hotelName,
    messages: (conversation?.messages ?? []).map(toGuestMessage),
  };
}

/** Marks unread host messages read while the guest is actively viewing the
 * thread — called on a live-arriving message, same effect as re-opening it. */
export async function markGuestConversationRead(bookingId: string): Promise<void> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return;
  const link = await loadGuestHotelLink(bookingId, user.id);
  if (!link) return;

  const conversation = await db.conversation.findUnique({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: link.hotelId } },
    select: { id: true },
  });
  if (!conversation) return;

  await db.conversation_message.updateMany({
    where: { conversation_id: conversation.id, sender: "HOST", read_by_guest: false },
    data: { read_by_guest: true },
  });
}

const MAX_MESSAGE_LENGTH = 4000;

export async function sendGuestMessage(bookingId: string, body: string): Promise<{ error?: string; message?: GuestConversationMessage }> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return { error: "Please log in." };
  const link = await loadGuestHotelLink(bookingId, user.id);
  if (!link) return { error: "This booking's chat isn't available yet." };

  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) return { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };

  const conversation = await db.conversation.upsert({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: link.hotelId } },
    create: { booking_id: bookingId, hotel_id: link.hotelId },
    update: {},
    select: { id: true },
  });

  const message = await db.conversation_message.create({
    data: { conversation_id: conversation.id, sender: "GUEST", sender_id: user.id, sender_name: user.name, body: trimmed },
    select: MESSAGE_SELECT,
  });

  const result = toGuestMessage(message);
  try {
    await publishConversationMessage(bookingId, link.hotelId, result);
  } catch (e) {
    console.error("[sendGuestMessage] ably publish failed", e);
  }

  return { message: result };
}

const MAX_ATTACHMENT_NAME_LENGTH = 255;

/** Sends a single-file attachment as its own message (no caption in v1 — send
 * a text message separately if a caption is wanted, same as WhatsApp/Slack). */
export async function sendGuestAttachment(bookingId: string, formData: FormData): Promise<{ error?: string; message?: GuestConversationMessage }> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return { error: "Please log in." };
  const link = await loadGuestHotelLink(bookingId, user.id);
  if (!link) return { error: "This booking's chat isn't available yet." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file selected." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.slice(0, MAX_ATTACHMENT_NAME_LENGTH);
  const uploaded = await uploadConversationAttachment(buffer, fileName, file.type || "application/octet-stream");
  if (!uploaded.ok) return { error: uploaded.error };

  const conversation = await db.conversation.upsert({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: link.hotelId } },
    create: { booking_id: bookingId, hotel_id: link.hotelId },
    update: {},
    select: { id: true },
  });

  const message = await db.conversation_message.create({
    data: {
      conversation_id: conversation.id, sender: "GUEST", sender_id: user.id, sender_name: user.name, body: "",
      attachment_url: uploaded.attachment.url, attachment_name: uploaded.attachment.name,
      attachment_type: uploaded.attachment.type, attachment_size: uploaded.attachment.size,
    },
    select: MESSAGE_SELECT,
  });

  const result = toGuestMessage(message);
  try {
    await publishConversationMessage(bookingId, link.hotelId, result);
  } catch (e) {
    console.error("[sendGuestAttachment] ably publish failed", e);
  }

  return { message: result };
}

/** Soft-delete — "delete for everyone": the message stays in the DB (audit /
 * dispute-resolution trail) but renders as a placeholder on both sides once
 * is_deleted is set. A guest can only delete their own (GUEST-sent) messages. */
export async function deleteGuestMessage(bookingId: string, messageId: number): Promise<{ error?: string; message?: GuestConversationMessage }> {
  const user = await getAuthenticatedUser();
  if (!user?.id) return { error: "Please log in." };
  const link = await loadGuestHotelLink(bookingId, user.id);
  if (!link) return { error: "This booking's chat isn't available yet." };

  const existing = await db.conversation_message.findUnique({
    where: { id: messageId },
    select: { sender: true, conversation: { select: { booking_id: true, hotel_id: true } } },
  });
  if (!existing || existing.conversation.booking_id !== bookingId || existing.conversation.hotel_id !== link.hotelId) {
    return { error: "Message not found." };
  }
  if (existing.sender !== "GUEST") return { error: "You can only delete your own messages." };

  const message = await db.conversation_message.update({
    where: { id: messageId },
    data: { is_deleted: true, deleted_at: new Date(), deleted_by: user.id },
    select: MESSAGE_SELECT,
  });

  const result = toGuestMessage(message);
  try {
    await publishConversationMessage(bookingId, link.hotelId, result);
  } catch (e) {
    console.error("[deleteGuestMessage] ably publish failed", e);
  }

  return { message: result };
}
