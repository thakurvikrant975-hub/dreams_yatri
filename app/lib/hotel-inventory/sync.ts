import "server-only";
import { db } from "@/app/lib/db";
import { Prisma } from "@/app/generated/prisma/client";

/**
 * Channel-management Phase 6 — sync reliability backbone (provider-agnostic).
 *
 * Outbound: an outbox (`hotel_sync_event`). Producers `enqueue…`; a worker
 * `processOutbox(handler)` claims due rows atomically (FOR UPDATE SKIP LOCKED),
 * runs the injected handler, and marks DONE or retries with exponential backoff,
 * going DEAD after `max_attempts`.
 *
 * Inbound: `recordInboundWebhook` dedupes on (provider, event_id) so a
 * re-delivered channel webhook is processed exactly once.
 *
 * The actual provider calls (Channex) are the injected handler — Phase 7.
 */

// ── Outbox: producers ─────────────────────────────────────────────────────────

export type EnqueueInput = {
  hotelId: number;
  type: string; // 'ari.push' | 'availability.push' | 'rate.push' | ...
  payload: Prisma.InputJsonValue;
  connectionId?: string | null;
  roomId?: number | null;
  idempotencyKey?: string | null;
  maxAttempts?: number;
};

export async function enqueueSyncEvent(input: EnqueueInput) {
  const data = {
    hotel_id: input.hotelId,
    type: input.type,
    payload: input.payload,
    connection_id: input.connectionId ?? null,
    room_id: input.roomId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    max_attempts: input.maxAttempts ?? 8,
  };
  if (!input.idempotencyKey) return db.hotel_sync_event.create({ data });
  try {
    return await db.hotel_sync_event.create({ data });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.hotel_sync_event.findUnique({ where: { idempotency_key: input.idempotencyKey } });
      if (existing) return existing;
    }
    throw err;
  }
}

/** Convenience: enqueue an ARI push for a room over a date range. */
export function enqueueAriPush(
  hotelId: number,
  roomId: number,
  fromISO: string,
  toISO: string,
  connectionId?: string | null,
) {
  return enqueueSyncEvent({
    hotelId,
    roomId,
    connectionId,
    type: "ari.push",
    payload: { from: fromISO, to: toISO },
  });
}

// ── Outbox: worker ────────────────────────────────────────────────────────────

export type ClaimedEvent = {
  id: string;
  hotel_id: number;
  connection_id: string | null;
  room_id: number | null;
  type: string;
  payload: unknown;
  attempts: number;
  max_attempts: number;
};

/**
 * Atomically claim up to `limit` due events (PENDING or FAILED past their
 * backoff), marking them PROCESSING. FOR UPDATE SKIP LOCKED lets multiple
 * workers run without ever claiming the same row.
 */
export async function claimDueEvents(limit = 20): Promise<ClaimedEvent[]> {
  return db.$queryRaw<ClaimedEvent[]>`
    UPDATE "hotel_sync_event"
    SET "status" = 'PROCESSING', "updated_at" = now()
    WHERE "id" IN (
      SELECT "id" FROM "hotel_sync_event"
      WHERE "status" IN ('PENDING', 'FAILED') AND "next_attempt_at" <= now()
      ORDER BY "next_attempt_at" ASC
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING "id", "hotel_id", "connection_id", "room_id", "type", "payload", "attempts", "max_attempts"
  `;
}

export function markEventDone(id: string) {
  return db.hotel_sync_event.update({
    where: { id },
    data: { status: "DONE", processed_at: new Date(), last_error: null },
  });
}

/** Fail an event: increment attempts, back off exponentially, or go DEAD. */
export async function markEventFailed(id: string, error: string) {
  const ev = await db.hotel_sync_event.findUnique({ where: { id }, select: { attempts: true, max_attempts: true } });
  if (!ev) return;
  const attempts = ev.attempts + 1;
  const dead = attempts >= ev.max_attempts;
  const delaySec = Math.min(2 ** attempts, 3600); // cap at 1h
  return db.hotel_sync_event.update({
    where: { id },
    data: {
      attempts,
      status: dead ? "DEAD" : "FAILED",
      last_error: error.slice(0, 1000),
      next_attempt_at: new Date(Date.now() + delaySec * 1000),
      processed_at: dead ? new Date() : null,
    },
  });
}

/**
 * Claim and process a batch. `handler` performs the real provider call; throwing
 * schedules a retry. Returns a summary. Call from a cron/worker (Phase 7 wires
 * the Channex handler).
 */
export async function processOutbox(
  handler: (event: ClaimedEvent) => Promise<void>,
  limit = 20,
): Promise<{ claimed: number; done: number; failed: number }> {
  const events = await claimDueEvents(limit);
  let done = 0, failed = 0;
  for (const ev of events) {
    try {
      await handler(ev);
      await markEventDone(ev.id);
      done++;
    } catch (e) {
      await markEventFailed(ev.id, e instanceof Error ? e.message : String(e));
      failed++;
    }
  }
  return { claimed: events.length, done, failed };
}

// ── Inbound webhooks ──────────────────────────────────────────────────────────

/** Store an inbound webhook, deduped on (provider, event_id). */
export async function recordInboundWebhook(input: {
  provider: string;
  eventId: string;
  eventType?: string | null;
  payload: Prisma.InputJsonValue;
}): Promise<{ id: string; duplicate: boolean }> {
  try {
    const row = await db.hotel_channel_webhook.create({
      data: {
        provider: input.provider,
        event_id: input.eventId,
        event_type: input.eventType ?? null,
        payload: input.payload,
      },
      select: { id: true },
    });
    return { id: row.id, duplicate: false };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.hotel_channel_webhook.findUnique({
        where: { provider_event_id: { provider: input.provider, event_id: input.eventId } },
        select: { id: true },
      });
      if (existing) return { id: existing.id, duplicate: true };
    }
    throw err;
  }
}

export function markWebhookProcessed(id: string, error?: string | null) {
  return db.hotel_channel_webhook.update({
    where: { id },
    data: { processed: !error, error: error ?? null, processed_at: new Date() },
  });
}
