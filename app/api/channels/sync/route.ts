import { NextRequest, NextResponse } from "next/server";
import { processOutbox, type ClaimedEvent } from "@/app/lib/hotel-inventory/sync";

/**
 * Outbox drain worker. A cron hits this (optionally with `x-cron-secret`) to push
 * queued ARI changes to channels. The handler is a MOCK for now — Phase 7 swaps in
 * the real Channex push. Failures are retried with backoff by the outbox.
 */

// TODO(Phase 7): replace with the real Channex ARI push handler.
async function mockHandler(event: ClaimedEvent): Promise<void> {
  console.log(
    `[channels/sync] (mock) push ${event.type} · hotel ${event.hotel_id} · room ${event.room_id}`,
    event.payload,
  );
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 20);
  const summary = await processOutbox(mockHandler, Number.isFinite(limit) ? limit : 20);
  return NextResponse.json(summary);
}
