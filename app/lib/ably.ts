import "server-only";
import Ably from "ably";

/**
 * Server-side Ably REST client — used to (1) mint scoped token requests for
 * browser clients and (2) publish messages after they're persisted to
 * Postgres. Never expose ABLY_API_KEY to the browser; clients only ever get
 * a short-lived, channel-scoped token via /api/ably/token.
 *
 * Resolved lazily (not at import time) and tolerant of a missing key — chat
 * is realtime *delivery* on top of already-persisted messages, so a missing/
 * misconfigured ABLY_API_KEY should disable realtime, not break sending or
 * reading messages at all (mirrors app/lib/redis.ts's "app still works if
 * the addon is down" stance).
 */
const globalForAbly = globalThis as unknown as { ablyRest: Ably.Rest | null | undefined };

function createAblyRest(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY;
  if (!key) {
    console.error("[ably] ABLY_API_KEY is not set — realtime chat delivery is disabled.");
    return null;
  }
  return new Ably.Rest({ key });
}

export function getAblyRest(): Ably.Rest | null {
  if (globalForAbly.ablyRest === undefined) {
    globalForAbly.ablyRest = createAblyRest();
  }
  return globalForAbly.ablyRest;
}

/** One channel per (booking, hotel) conversation — matches the DB's own compound key. */
export function conversationChannelName(bookingId: string, hotelId: number): string {
  return `conversation:${bookingId}:${hotelId}`;
}

/** Best-effort publish — never throws; callers just log and move on since
 * the message is already durably persisted before this runs. */
export async function publishConversationMessage(
  bookingId: string,
  hotelId: number,
  message: unknown,
): Promise<void> {
  const rest = getAblyRest();
  if (!rest) return;
  await rest.channels.get(conversationChannelName(bookingId, hotelId)).publish("message", message);
}

/** Single shared channel — dashboard team members watching Verify Hotels /
 * Verify Cabs subscribe here for live pending-count updates. */
export function verificationCountsChannelName(): string {
  return "dashboard:verification-counts";
}

export type VerificationCounts = { hotelsPending: number; cabsPending: number; bookingsUnconfirmed: number; packagesPending: number; hotelRequestsPending: number; leadRequestsPending: number };

/** Best-effort publish — never throws; the count is a live-refresh nicety on
 * top of the always-correct server-rendered page, so a missing/misconfigured
 * ABLY_API_KEY should never break the mutation that triggered it. */
export async function publishVerificationCounts(counts: VerificationCounts): Promise<void> {
  const rest = getAblyRest();
  if (!rest) return;
  await rest.channels.get(verificationCountsChannelName()).publish("counts", counts);
}

/** One channel per sales exec — private to them, so the token endpoint can
 * scope a browser client to its own member id and nobody watches another
 * exec's sales landing. */
export function salesAgentChannelName(memberId: string): string {
  return `sales-agent:${memberId}`;
}

export type BookingWon = {
  bookingId: string;
  bookingNumber: string;
  /** What they sold, already resolved server-side — the client toast should
   * not have to know how a custom package differs from a catalogue one. */
  packageTitle: string;
  clientName: string | null;
  amountPaise: number;
  currency: string;
};

/** Best-effort publish — never throws. The booking is already confirmed and
 * durable by the time this runs; the toast is a moment of recognition on top
 * of it, and losing one must never fail a payment confirmation. */
export async function publishBookingWon(memberId: string, won: BookingWon): Promise<void> {
  const rest = getAblyRest();
  if (!rest) return;
  await rest.channels.get(salesAgentChannelName(memberId)).publish("booking-won", won);
}

/** One private channel per team member — unlike verification-counts (one
 * shared channel everyone reads the same numbers on), a notification is
 * addressed to exactly one recipient, so each gets their own channel rather
 * than everyone subscribing to one feed and filtering client-side. The
 * token route below is the only place allowed to grant subscribe access to
 * a given member's own channel. */
export function memberNotificationsChannelName(memberId: string): string {
  return `member:${memberId}:notifications`;
}

export type NotificationPayload = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
};

/** Best-effort publish — the row is already durably persisted (see
 * notify.ts), so a missing/misconfigured ABLY_API_KEY only costs the live
 * push; the bell still picks it up on its next server-rendered load. */
export async function publishNotification(recipientId: string, notification: NotificationPayload): Promise<void> {
  const rest = getAblyRest();
  if (!rest) return;
  await rest.channels.get(memberNotificationsChannelName(recipientId)).publish("notification", notification);
}
