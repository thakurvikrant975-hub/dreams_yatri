"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

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
  sender: "HOST" | "GUEST" | "SYSTEM";
  body: string;
  createdAt: Date;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function ownsHotel(hotelId: number, ownerId: string): Promise<boolean> {
  const hotel = await db.hotels.findFirst({ where: { id: hotelId, owner_id: ownerId }, select: { id: true } });
  return !!hotel;
}

/** A guest can message about a booking as soon as it touches the hotel — not
 * gated on payment/confirmation status, since pre-arrival questions are the
 * most common reason to message at all. */
async function ownsBookingHotelPair(bookingId: string, hotelId: number, ownerId: string): Promise<boolean> {
  const link = await db.bookingHotel.findFirst({
    where: { bookingId, hotelId, hotel: { owner_id: ownerId } },
    select: { id: true },
  });
  return !!link;
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getOwnerConversations(): Promise<ConversationSummary[]> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");
  const ownerId = session.user.id;

  const ownerHotels = await db.hotels.findMany({ where: { owner_id: ownerId }, select: { id: true } });
  const hotelIds = ownerHotels.map((h) => h.id);
  if (!hotelIds.length) return [];

  // Every (booking, hotel) pair this owner's properties are part of —
  // this is the full universe of possible conversations, whether or not a
  // guest (or host) has actually sent a message yet.
  const links = await db.bookingHotel.findMany({
    where: { hotelId: { in: hotelIds } },
    select: {
      bookingId: true,
      hotelId: true,
      hotel: { select: { name: true } },
      booking: {
        select: {
          bookingNumber: true,
          contactEmail: true,
          travellersList: { where: { isLead: true }, take: 1, select: { fullName: true, firstName: true } },
        },
      },
    },
    distinct: ["bookingId", "hotelId"],
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
  if (!(await ownsBookingHotelPair(bookingId, hotelId, session.user.id))) return { error: "Conversation not found." };

  const conversation = await db.conversation.findUnique({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: hotelId } },
    select: { id: true, messages: { orderBy: { created_at: "asc" }, select: { id: true, sender: true, body: true, created_at: true } } },
  });
  if (!conversation) return { messages: [] };

  // Mark every unread guest message as read now that the host has opened the thread.
  await db.conversation_message.updateMany({
    where: { conversation_id: conversation.id, sender: "GUEST", read_by_host: false },
    data: { read_by_host: true },
  });

  return {
    messages: conversation.messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      body: m.body,
      createdAt: m.created_at,
    })),
  };
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
  if (!(await ownsBookingHotelPair(bookingId, hotelId, session.user.id))) return { error: "Conversation not found." };

  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty." };
  if (trimmed.length > MAX_MESSAGE_LENGTH) return { error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` };

  const conversation = await db.conversation.upsert({
    where: { booking_id_hotel_id: { booking_id: bookingId, hotel_id: hotelId } },
    create: { booking_id: bookingId, hotel_id: hotelId },
    update: {},
    select: { id: true },
  });

  const message = await db.conversation_message.create({
    data: {
      conversation_id: conversation.id,
      sender: "HOST",
      body: trimmed,
    },
    select: { id: true, sender: true, body: true, created_at: true },
  });

  revalidatePath("/hotel-connect/inbox");
  return { message: { id: message.id, sender: message.sender, body: message.body, createdAt: message.created_at } };
}
