import { NextRequest, NextResponse } from "next/server";
import { recordInboundWebhook } from "@/app/lib/hotel-inventory/sync";

/**
 * Inbound channel webhook receiver (e.g. Channex booking notifications).
 * Records + dedupes on (provider, event_id) so re-deliveries are safe. Booking
 * events will route to the reservation engine in Phase 7 (needs the real payload
 * schema + signature verification).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;

  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    payload = {};
  }

  // TODO(Phase 7): verify the provider's signature header before trusting payload.
  const eventId =
    (payload.event_id as string) ??
    (payload.id as string) ??
    req.headers.get("x-event-id") ??
    globalThis.crypto.randomUUID();
  const eventType = (payload.event_type as string) ?? (payload.type as string) ?? null;

  const res = await recordInboundWebhook({ provider, eventId, eventType, payload });

  // TODO(Phase 7): if !res.duplicate and this is a booking event, create/cancel a
  // reservation via the reservation engine, then markWebhookProcessed(res.id).

  return NextResponse.json({ received: true, duplicate: res.duplicate, id: res.id });
}
