"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { publishConversationMessage } from "@/app/lib/ably";
import { isPaidStatus, uploadConversationAttachment } from "@/app/lib/messaging";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConversationSummary = {
  bookingId: string;
  hotelId: number;
  bookingNumber: string;
  guestName: string;
  hotelName: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
};

export type ConversationMessage = {
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

function toHostMessage(m: {
  id: number; sender: string; body: string; created_at: Date;
  attachment_url: string | null; attachment_name: string | null; attachment_type: string | null; attachment_size: number | null;
  is_deleted: boolean;
}): ConversationMessage {
  return {
    id: m.id,
    sender: m.sender as ConversationMessage["sender"],
    body: m.is_deleted ? "" : m.body,
    createdAt: m.created_at,
    attachmentUrl: m.is_deleted ? null : m.attachment_url,
    attachmentName: m.is_deleted ? null : m.attachment_name,
    attachmentType: m.is_deleted ? null : m.attachment_type,
    attachmentSize: m.is_deleted ? null : m.attachment_size,
    isDeleted: m.is_deleted,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ownsHotel(hotelId: number, ownerId: string): Promise<boolean> {
  const hotel = await db.hotels.findFirst({ where: { id: hotelId, owner_id: ownerId }, select: { id: true } });
  return !!hotel;
}

/** Messaging only opens once the booking has actually been paid for — same
 * paid-status allow-list used elsewhere (verify-hotels, etc.), so a booking
 * that's later refunded closes the thread back down too. */
async function ownsPaidBookingHotelPair(bookingId: string, hotelId: number, ownerId: string): Promise<boolean> {
  const link = await db.bookingHotel.findFirst({
    where: { bookingId, hotelId, hotel: { owner_id: ownerId } },
    select: { booking: { select: { paymentStatus: true } } },
  });
  return !!link && isPaidStatus(link.booking.paymentStatus);
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getOwnerConversations(): Promise<ConversationSummary[]> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  const ownerId = session.user.id;

  const ownerHotels = await db.hotels.findMany({ where: { owner_id: ownerId }, select: { id: true } });
  const hotelIds = ownerHotels.map((h) => h.id);
  if (!hotelIds.length) return [];

  // Every (booking, hotel) pair this owner's properties are part of — the
  // full universe of possible conversations, whether or not a guest (or
  // host) has actually sent a message yet. Capped to the most recent
  // bookings so an owner with years of history doesn't load their entire
  // booking log just to open the inbox; the client's own search/filter
  // then operates over this recent window.
  const CONVERSATION_WINDOW = 200;
  const links = await db.bookingHotel.findMany({
    where: { hotelId: { in: hotelIds }, booking: { paymentStatus: { in: ["ADVANCE_PAID", "FULLY_PAID"] } } },
    select: {
      bookingId: true,
      hotelId: true,
      hotel: { select: { name: true } },
      booking: {
        select: {
          bookingNumber: true,
          contactEmail: true,
          createdAt: true,
          travellersList: { where: { isLead: true }, take: 1, select: { fullName: true, firstName: true } },
        },
      },
    },
    distinct: ["bookingId", "hotelId"],
    orderBy: { booking: { createdAt: "desc" } },
    take: CONVERSATION_WINDOW,
  });
  if (!links.length) return [];

  const conversations = await db.conversation.findMany({
    where: {
      hotel_id: { in: hotelIds },
      booking_id: { in: links.map((l) => l.bookingId) },
    },
    select: {
      id: true,
      booking_id: true,
      hotel_id: true,
      messages: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: { body: true, created_at: true },
      },
      _count: { select: { messages: { where: { sender: "GUEST", read_by_host: false } } } },
    },
  });
  const convoByKey = new Map(conversations.map((c) => [`${c.booking_id}:${c.hotel_id}`, c]));

  return links
    .map((l) => {
      const convo = convoByKey.get(`${l.bookingId}:${l.hotelId}`);
      const lead = l.booking.travellersList[0];
      return {
        bookingId: l.bookingId,
        hotelId: l.hotelId,
        bookingNumber: l.booking.bookingNumber,
        guestName: lead?.fullName ?? lead?.firstName ?? l.booking.contactEmail ?? "Guest",
        hotelName: l.hotel.name,
        lastMessage: convo?.messages[0]?.body ?? null,
        lastMessageAt: convo?.messages[0]?.created_at ?? null,
        unreadCount: convo?._count.messages ?? 0,
      };
    })
    .sort((a, b) => {
      // Conversations with activity float to the top, most recent first;
      // untouched threads sort after, alphabetically by guest so the list
      // is stable across reloads.
      if (a.lastMessageAt && b.lastMessageAt) return b.lastMessageAt.getTime() - a.lastMessageAt.getTime();
      if (a.lastMessageAt) return -1;
      if (b.lastMessageAt) return 1;
      return a.guestName.localeCompare(b.guestName);
    });
}

export async function getConversationMessages(
  bookingId: string,
  hotelId: number,
): Promise<{ error?: string; messages?: ConversationMessage[] }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsPaidBookingHotelPair(bookingId, hotelId, session.user.id))) return { error: "Conversation not found." };

  const conversation = await db.conversation.findUnique({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: hotelId } },
    select: { id: true, messages: { orderBy: { created_at: "asc" }, select: MESSAGE_SELECT } },
  });
  if (!conversation) return { messages: [] };

  // Mark every unread guest message as read now that the host has opened the thread.
  await db.conversation_message.updateMany({
    where: { conversation_id: conversation.id, sender: "GUEST", read_by_host: false },
    data: { read_by_host: true },
  });

  return { messages: conversation.messages.map(toHostMessage) };
}

/** Marks unread guest messages read while the host is actively viewing the
 * thread — called on a live-arriving message, same effect as re-opening it. */
export async function markConversationRead(bookingId: string, hotelId: number): Promise<void> {
  const session = await hotelConnectAuth();
  if (!session) return;
  if (!(await ownsPaidBookingHotelPair(bookingId, hotelId, session.user.id))) return;

  const conversation = await db.conversation.findUnique({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: hotelId } },
    select: { id: true },
  });
  if (!conversation) return;

  await db.conversation_message.updateMany({
    where: { conversation_id: conversation.id, sender: "GUEST", read_by_host: false },
    data: { read_by_host: true },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 4000;

export async function sendHostMessage(
  bookingId: string,
  hotelId: number,
  body: string,
): Promise<{ error?: string; message?: ConversationMessage }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsPaidBookingHotelPair(bookingId, hotelId, session.user.id))) return { error: "Conversation not found." };

  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) return { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };

  const conversation = await db.conversation.upsert({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: hotelId } },
    create: { booking_id: bookingId, hotel_id: hotelId },
    update: {},
    select: { id: true },
  });

  const owner = await db.hotelOwner.findUnique({ where: { id: session.user.id }, select: { name: true } });

  const message = await db.conversation_message.create({
    data: {
      conversation_id: conversation.id,
      sender: "HOST",
      sender_id: session.user.id,
      sender_name: owner?.name,
      body: trimmed,
    },
    select: MESSAGE_SELECT,
  });

  const result = toHostMessage(message);
  try {
    await publishConversationMessage(bookingId, hotelId, result);
  } catch (e) {
    console.error("[sendHostMessage] ably publish failed", e);
  }

  revalidatePath("/hotel-connect/inbox");
  return { message: result };
}

const MAX_ATTACHMENT_NAME_LENGTH = 255;

/** Sends a single-file attachment as its own message (no caption in v1). */
export async function sendHostAttachment(bookingId: string, hotelId: number, formData: FormData): Promise<{ error?: string; message?: ConversationMessage }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsPaidBookingHotelPair(bookingId, hotelId, session.user.id))) return { error: "Conversation not found." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file selected." };

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.slice(0, MAX_ATTACHMENT_NAME_LENGTH);
  const uploaded = await uploadConversationAttachment(buffer, fileName, file.type || "application/octet-stream");
  if (!uploaded.ok) return { error: uploaded.error };

  const conversation = await db.conversation.upsert({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: hotelId } },
    create: { booking_id: bookingId, hotel_id: hotelId },
    update: {},
    select: { id: true },
  });

  const owner = await db.hotelOwner.findUnique({ where: { id: session.user.id }, select: { name: true } });

  const message = await db.conversation_message.create({
    data: {
      conversation_id: conversation.id, sender: "HOST", sender_id: session.user.id, sender_name: owner?.name, body: "",
      attachment_url: uploaded.attachment.url, attachment_name: uploaded.attachment.name,
      attachment_type: uploaded.attachment.type, attachment_size: uploaded.attachment.size,
    },
    select: MESSAGE_SELECT,
  });

  const result = toHostMessage(message);
  try {
    await publishConversationMessage(bookingId, hotelId, result);
  } catch (e) {
    console.error("[sendHostAttachment] ably publish failed", e);
  }

  revalidatePath("/hotel-connect/inbox");
  return { message: result };
}

/** Soft-delete — "delete for everyone". A host can only delete their own
 * (HOST-sent) messages, never the guest's. */
export async function deleteHostMessage(bookingId: string, hotelId: number, messageId: number): Promise<{ error?: string; message?: ConversationMessage }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  if (!(await ownsPaidBookingHotelPair(bookingId, hotelId, session.user.id))) return { error: "Conversation not found." };

  const existing = await db.conversation_message.findUnique({
    where: { id: messageId },
    select: { sender: true, conversation: { select: { booking_id: true, hotel_id: true } } },
  });
  if (!existing || existing.conversation.booking_id !== bookingId || existing.conversation.hotel_id !== hotelId) {
    return { error: "Message not found." };
  }
  if (existing.sender !== "HOST") return { error: "You can only delete your own messages." };

  const message = await db.conversation_message.update({
    where: { id: messageId },
    data: { is_deleted: true, deleted_at: new Date(), deleted_by: session.user.id },
    select: MESSAGE_SELECT,
  });

  const result = toHostMessage(message);
  try {
    await publishConversationMessage(bookingId, hotelId, result);
  } catch (e) {
    console.error("[deleteHostMessage] ably publish failed", e);
  }

  revalidatePath("/hotel-connect/inbox");
  return { message: result };
}
