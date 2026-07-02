# Channel Management — Phase 6: Sync Reliability Infrastructure

**Status:** ✅ COMPLETE (provider-agnostic backbone, verified). Handler + cron wiring = Phase 7.

## Delivered — schema (migration `20260702040000_add_sync_infra`)

- **`hotel_sync_event`** (outbox) — `type`, `payload`, `status`
  (`PENDING`/`PROCESSING`/`DONE`/`FAILED`/`DEAD`), `attempts`/`max_attempts`,
  `next_attempt_at` (backoff), `last_error`, unique `idempotency_key`.
  Indexed `(status, next_attempt_at)` for the claim query.
- **`hotel_channel_webhook`** (inbound) — dedup on `(provider, event_id)`, `processed` flag.

## Delivered — service `app/lib/hotel-inventory/sync.ts`

| Function | Purpose |
|---|---|
| `enqueueSyncEvent` / `enqueueAriPush` | producers; idempotent when a key is given |
| `claimDueEvents(limit)` | **atomic** claim via `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` → PROCESSING |
| `markEventDone` / `markEventFailed` | DONE, or retry with exponential backoff (cap 1h) → **DEAD** at `max_attempts` |
| `processOutbox(handler, limit)` | claim a batch, run the injected handler, mark done/failed; returns `{claimed, done, failed}` |
| `recordInboundWebhook` / `markWebhookProcessed` | store + dedupe inbound webhooks exactly once |

## Verified (fresh client, dev DB) — 7/7

- enqueue idempotency: duplicate key rejected, one row.
- **concurrent claim: no overlap** — two `claimDueEvents(3)` in parallel returned disjoint sets,
  all 6 events claimed exactly once (SKIP LOCKED).
- fail #1 → FAILED (attempts=1, `next_attempt_at` in the future); fail #2 (≥max) → DEAD.
- webhook dedup: duplicate `(provider, event_id)` rejected.

## Consumers wired + full loop proven (mock handler)

The whole outbound loop now runs against a stub — Channex drops in as the handler later.

- **Producers:** `saveAvailabilityRange` (calendar) and `createReservation`/`cancelReservation`
  call `enqueueAriPushIfConnected` (best-effort, wrapped so a sync hiccup never breaks the save).
  Added `enqueueAriPushIfConnected` (skips hotels with no CONNECTED channel) and `enqueueFullResync`.
- **Drain worker:** `POST /api/channels/sync` → `processOutbox(mockHandler)` (optional
  `x-cron-secret`). The mock logs "would push"; **Phase 7 swaps in the real Channex handler.**
- **Webhook receiver:** `POST /api/channels/webhook/[provider]` → `recordInboundWebhook` (dedup) → 200.

**Verified end-to-end (fresh client, 5/5):** producer skips with no channel; enqueues when
CONNECTED; drain success → DONE; `enqueueFullResync` enqueues one event per mapping; drain failure
→ FAILED with backoff.

## Remaining for Phase 7 (needs the real provider)

- The **Channex push handler** (replace `mockHandler`) + **webhook signature verification** +
  routing booking webhooks into the reservation engine.
- **Cron** to hit `/api/channels/sync` and nightly `enqueueFullResync`.
- Channels-tab UI + content standardization (from P5).
