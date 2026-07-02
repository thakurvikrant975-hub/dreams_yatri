# Dreams Yatri — Channel Management System (Phased Plan)

The roadmap for turning the current flat-pricing hotel setup into a proper channel-ready
platform, culminating in **Channex.io** integration for live multi-OTA sync. Built in
independent phases — each ships value on its own and is a prerequisite for the next.

Channex is deliberately the **last** step. Phases 1–6 give us a real-time calendar and an
overbooking-proof booking engine *of our own*, in the exact shape Channex later syncs to —
so nothing is wasted work.

---

## Guiding principles (apply to every phase)

1. **Date-indexed source of truth.** Availability, rates, and restrictions live per
   `room_type × date` (and rate plan). No more single static counts / windows.
2. **Server-authoritative & atomic.** Inventory only moves inside transactions with locking.
   A booking never oversells. Retries/double-webhooks are idempotent no-ops.
3. **Channel-agnostic core.** The inventory + reservation engine knows nothing about Channex
   or any OTA. Channels are an adapter layer on top.
4. **Snapshot immutably.** A confirmed reservation freezes its price/policy; later rate edits
   never change past bookings (same rule as the booking system).
5. **Everything observable.** Every sync push/pull is logged, retryable, and surfaced to the
   owner ("Agoda rejected this rate").

---

## Current state (baseline)

- ✅ Hotels, room types (`hotelRooms`), tagged images, amenities JSON, location, policies.
- ✅ Booking engine (quote → checkout → Razorpay, Phases 1–9) — but coupled to our own payment.
- 🟡 Flat per-property pricing (`prop_base_rate`, meal prices), single `cancellation_policy`.
- ❌ No per-date inventory, no rate plans, no restrictions, no channel/sync concept.

---

## Phase 1 — Per-date Inventory & Restrictions  *(foundation)* ✅ COMPLETE

**Scope correction:** a **season-based pricing engine already exists** (`hotel_room_pricing`
= rate plans, `hotel_room_pricing_season` = date-range + weekend, occupancy tiers, meal/addon
pricing, child policies). So Phase 1 did **not** rebuild rate plans/pricing — only the genuinely
missing per-date **availability + restrictions** layer. Details: `phase1-inventory.md`.

**Delivered:** `hotel_room_availability` — one ARI row per `room × date`:
- Availability: `total_units`, `booked_units`, `stop_sell` (`available = stop_sell ? 0 : max(0, total-booked)`).
- Rate override: optional `price_override` (base price still from the season engine).
- Restrictions: `min_los`, `max_los`, `closed_to_arrival`, `closed_to_departure`.

Deferred (already exist or later phases): rate plans/pricing (exist), structured GST slabs &
per-rate-plan cancellation (Phase 4).

⚠️ **Migration drift:** local `prisma/migrations` is out of sync with the Neon DB, so
`migrate dev` wants to reset. Table was shipped via hand-written SQL + `db execute` +
`migrate resolve --applied`. History needs reconciling before normal `migrate dev` works.

**Depends on:** nothing. **Unblocks:** everything.

---

## Phase 2 — Booking ↔ Inventory engine  *(overbooking-proof core)*  ✅ CORE COMPLETE

**Delivered & verified** (details: `phase2-inventory-engine.md`):
- `availability.ts` — atomic hold/release + read/evaluate over the Phase 1 ledger. Guarded SQL
  UPDATE (`booked + n <= total AND NOT stop_sell`), multi-night all-or-nothing. Verified under
  real concurrency (5 holds/2 rooms → 2 ok, 3 rejected; release clamps at 0).
- `rates.ts` — ARI resolver `getRoomARI`/`getStayQuote`; price precedence
  `override → season(weekend/base) → base → none`, mirroring the existing season engine.
- `reservations.ts` + `hotel_reservation` — atomic hold+record, **source attribution**, money
  (gross/net/commission), `hold_key` idempotency, exactly-once release via `released_at`.
  Verified: idempotent create, oversell-with-no-orphan, exactly-once cancel.

**Remaining (a consumer, not core):** wire a real **direct-booking flow**
(hotel detail page → `createReservation`) and hook the package/ops flow to decrement — a
product-flow task for when the hotel detail page has real data; natural companion to Phase 3.

**Note:** `BookingHotel` is a package component (ops-confirmed), so no sell-against-inventory
flow existed — the engine is a reusable core for direct/package/Channex callers.

**Depends on:** Phase 1.

---

## Phase 3 — Owner dashboard: Rates & Availability Calendar  ✅ COMPLETE

**Delivered:** `/hotel-connect/properties/[id]/calendar` — month grid per room (price +
available/total per day, stop-sell + override markers), room switcher, month nav, past-date
lockout, and **range bulk-edit** (price override / clear, total units, open/close, Min LOS,
CTA, CTD) via `saveAvailabilityRange`. Reads via `getRoomARI`. Properties card links to it.
Details: `phase3-calendar.md`.

**Verified:** read path (Phase 2) + write path (fresh-client: `ensure` + `updateMany` patches a
4-night range on all fields). UI type-checked; render needs a `next dev` restart (stale client).

**Follow-ups:** v1 is a single-room month view (rooms×dates matrix = possible v2); contiguous-range
selection only.

**Depends on:** Phases 1–2.

---

## Phase 4 — Structured cancellation (content standardization → P5)  ✅ CANCELLATION DONE

**Delivered:** per-rate-plan cancellation — `hotel_room_pricing.cancellation_policy` (falls back
to hotel-level) + a **pure resolver** `app/lib/hotel-inventory/cancellation.ts`
(`resolveCancellation`, `effectivePolicy`, `cancellationLabel`). Verified 11/11 via `tsx`.
Details: `phase4-cancellation.md`.

**Deferred to Phase 5:** amenity/facility/bed-type/geo **content standardization** — it's only
needed once a channel's target taxonomy is known (doing it now would be speculative). Photo
categories already strong (enforced tagging).

**Follow-ups (consumers):** surface cancellation in `getRoomARI`/calendar/hotel-detail; owner UI
to set a rate plan's policy; use `resolveCancellation` in `cancelReservation` refund math.

**Depends on:** Phase 1 (rate plans exist).

---

## Phase 5 — Channel mapping & connection model  ✅ DATA LAYER COMPLETE

**Delivered:** `hotel_channel_connection` (per hotel+channel: provider/external_id/status/
last_synced/last_error; no OTA secrets) + `hotel_channel_room_mapping` (room+rate ↔ channel codes)
— migration `20260702030000`. Service `app/lib/hotel-inventory/channels.ts`: `upsertConnection`,
`setConnectionStatus`, `upsertRoomMapping` (nullable-pricing safe), `getPushTargets` (what a sync
job iterates). Verified 8/8 (fresh client). Details: `phase5-channel-mapping.md`.

**Deferred to Phase 7 (need a real provider):** the **Channels tab UI** and **content
standardization** (amenity/bed/geo → channel taxonomy). The service is UI-ready.

**Depends on:** Phases 1, 4.

---

## Phase 6 — Sync reliability infrastructure  ✅ COMPLETE

**Delivered:** `hotel_sync_event` outbox + `hotel_channel_webhook` inbound dedup (migration
`20260702040000`); service `app/lib/hotel-inventory/sync.ts` — `enqueueSyncEvent`/`enqueueAriPush`
(idempotent), `claimDueEvents` (atomic `FOR UPDATE SKIP LOCKED`), `markEventDone`/`markEventFailed`
(exponential backoff → DEAD), `processOutbox(handler)`, `recordInboundWebhook`/`markWebhookProcessed`.
Verified 7/7 incl. concurrent-claim-no-overlap, backoff→DEAD, dedup. Details: `phase6-sync-infra.md`.

**Consumers wired + loop proven (mock):** producers (`saveAvailabilityRange`,
`createReservation`/`cancelReservation` → `enqueueAriPushIfConnected`), `enqueueFullResync`,
drain worker `POST /api/channels/sync` (`processOutbox(mockHandler)`), webhook receiver
`POST /api/channels/webhook/[provider]`. Verified end-to-end 5/5.

**Remaining → Phase 7:** swap `mockHandler` for the real Channex push; webhook signature +
booking→reservation routing; cron scheduling.

**Depends on:** Phases 2, 5.

---

## Phase 7 — Channex.io integration

**Goal:** wire the real provider into the layers above.

- Channex account + sandbox; map our mapping/connection model to Channex properties/rooms/rates.
- Push ARI from Phase 1 calendars via Phase 6 outbox → Channex → OTAs.
- Consume Channex booking **webhooks** → Phase 2 reservation path → inventory decrement.
- White-label so owners see "DreamsYatri," not Channex.

**Done when:** a rate/availability change in our dashboard reaches an OTA, and an OTA booking
appears in our calendar with inventory decremented — end to end in sandbox.

**Depends on:** Phases 1–6.

---

## Phase 8 — Multi-channel pricing, parity & go-live

**Goal:** production hardening + commercial layer.

- **Channel-specific pricing** (markup/commission per channel), rate-parity handling.
- Overbooking incident handling, monitoring/alerts, load testing.
- Onboarding flow (help hotels connect their OTA accounts); ops runbook.
- India compliance: GST invoicing on channel bookings, C-form/FRRO for foreign guests.

**Done when:** live with real hotels on ≥1 OTA, with parity + monitoring + an ops process.

**Depends on:** Phase 7.

---

## Dependency map

```
P1 ─┬─► P2 ─┬─► P3
    │       └─► P6 ──► P7 ──► P8
    └─► P4 ─────► P5 ─┘
```

Build order: **P1 → P2 → P3 → P4 → P5 → P6 → P7 → P8.**
(P3 can run in parallel with P4/P5 once P2 lands, since it only needs the calendar model.)
