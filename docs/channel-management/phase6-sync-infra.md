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

## Follow-ups (Phase 7)

- Inject the **Channex handler** into `processOutbox` (turn `ari.push` events into real API calls).
- **Producers:** call `enqueueAriPush` from `saveAvailabilityRange` / reservation changes for
  hotels with CONNECTED connections (best-effort).
- **Reconciliation:** a thin `enqueueFullResync(hotelId)` over `getPushTargets` × horizon.
- **Cron/worker:** schedule `processOutbox` + a webhook route that calls `recordInboundWebhook`
  then routes to the reservation engine.
