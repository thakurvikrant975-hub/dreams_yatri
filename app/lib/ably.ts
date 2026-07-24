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
