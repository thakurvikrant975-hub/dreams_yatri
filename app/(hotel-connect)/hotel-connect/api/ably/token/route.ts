import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getAblyRest, conversationChannelName } from "@/app/lib/ably";
import { authorizeConversationAccess } from "@/app/lib/messaging";

/**
 * Mints a short-lived Ably token scoped to exactly one conversation channel,
 * with subscribe-only capability — clients never publish directly to Ably.
 * A message only ever becomes "real" by going through sendHostMessage /
 * sendGuestMessage (persist to Postgres, then publish server-side), so a
 * client with just this token can't fabricate a message or read anyone
 * else's conversation.
 *
 * Lives under /hotel-connect/api/... (not /api/...) on purpose: the
 * hotel-connect session cookie is scoped to Path=/hotel-connect
 * (auth-hotel-connect.ts), so a route outside that path never sees it. The
 * guest session cookie has no such restriction, so it still reaches this
 * route fine from the main site.
 */
export async function POST(req: NextRequest) {
  let body: { bookingId?: string; hotelId?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { bookingId, hotelId } = body;
  if (!bookingId || typeof hotelId !== "number") {
    return NextResponse.json({ error: "bookingId and hotelId are required." }, { status: 400 });
  }

  const auth = await authorizeConversationAccess(bookingId, hotelId);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: 403 });
  }

  const rest = getAblyRest();
  if (!rest) {
    return NextResponse.json({ error: "Live chat is temporarily unavailable." }, { status: 503 });
  }

  const channel = conversationChannelName(bookingId, hotelId);
  const tokenRequest = await rest.auth.createTokenRequest({
    clientId: `${auth.role.toLowerCase()}:${auth.actorId}`,
    capability: { [channel]: ["subscribe"] },
    ttl: 60 * 60 * 1000, // 1 hour — the client SDK re-requests on expiry
  });

  return NextResponse.json(tokenRequest);
}
