# Package Status Tracking — Build Plan

Post-booking, customer-facing **fulfilment status** for every customised item in a
package (each day's hotel, transfer/cab, activity). After a paid booking the
customer watches each item move `Pending → In process → Confirmed`, downloads
vouchers/tickets for confirmed items, and — when an item can't be fulfilled —
picks an ops-proposed alternative.

This builds on the existing pieces:
- **Plan** = the immutable `Booking.priceSnapshot` (per-day hotel `room_pricing_id`,
  transfer vehicle, activity `variant_id` + paid/optional flags).
- **Fulfilment** = `BookingHotel` / `BookingCab` (already exist; created lazily by
  the Verify-Hotels/Cabs admin desks today) + a new `BookingActivity`.
- **Audit** = `BookingTimeline`; **files** = `TripDocument`; **comms** = the
  `NOTIFICATIONS_ENABLED` layer.

---

## Locked decisions (defaults — change here before building if needed)

1. **Replacement model:** ops-proposed. When an item is unavailable, the desk
   proposes 2–3 equivalent options; the customer approves one. **v1 = equal-or-
   cheaper / no price change** (paid upgrades + settlement deferred to Phase 4.3).
2. **Payment gating:** fulfilment starts once the booking is **paid** —
   `paymentStatus ∈ {ADVANCE_PAID, FULLY_PAID}` (deposit is enough to begin).
   `PENDING` payment → status page shows "Awaiting payment", no items in process.
3. **Status granularity:** add a `FulfillmentStatus` enum on each item table
   (don't rely on the `isConfirmed` boolean).
4. **Vouchers:** supplier files **uploaded by ops** as `TripDocument`
   (`HOTEL_VOUCHER` / `ACTIVITY_TICKET` / `CAB_SLIP`). The overall trip voucher
   stays system-generated (existing `/bookings/[id]/voucher`).
5. **Activities desk:** add a **Verify-Activities** admin flow (none exists today).
6. **Free vs paid activity:** derived from the snapshot — `total > 0 && !is_optional`
   ⇒ paid/ticketed (needs voucher); otherwise free (confirmation tick only).
   `is_optional` (unpaid) activities are **not** part of the fulfilment checklist.

---

## Status model

`FulfillmentStatus`: `PENDING → IN_PROCESS → CONFIRMED`, branches
`→ UNAVAILABLE → (replacement) → IN_PROCESS → CONFIRMED`, plus `CANCELLED` and
`REPLACED` (superseded item, kept for history).

Booking-level rollup (page header / `BookingStatus`): derived from item statuses —
"Awaiting payment" → "Confirming (x/y)" → "All set" when every tracked item is
`CONFIRMED`.

---

## Phases & steps

### Phase 1 — Fulfilment data model & materialisation  ⬜
- **1.1** Schema: add `FulfillmentStatus` enum; add `status` (+ voucher link, +
  `final*` fields for replacements) to `BookingHotel` & `BookingCab`; add
  `BookingActivity` model; add `DocumentType` values (`HOTEL_VOUCHER`,
  `ACTIVITY_TICKET`, `CAB_SLIP`). Migration on Neon.
- **1.2** Materialise at booking: in `createBooking`, create `BookingHotel` /
  `BookingCab` / `BookingActivity` rows in `PENDING` from the snapshot. Backfill
  script for existing paid bookings.
- **1.3** Reconcile the lazy create paths (Verify-Hotels `upsert`, Verify-Cabs)
  so they update the pre-materialised rows instead of duplicating; switch their
  "confirmed" writes to set `status = CONFIRMED`.

### Phase 2 — Customer status page (read-only)  ⬜
- **2.1** Route `/bookings/[id]/status` (owner-scoped) + loader joining snapshot
  (plan) × fulfilment rows (status) into a per-day view model.
- **2.2** UI: per-day checklist (reuse the itinerary-preview look) — status chips,
  overall progress bar, voucher view/download, driver details (cab), paid-vs-free
  activity, "Awaiting payment" gate.
- **2.3** Link from the confirmation page + booking emails ("Track your trip").

### Phase 3 — Admin fulfilment actions  ⬜
- **3.1** Extend Verify-Hotels / Verify-Cabs: set `IN_PROCESS` / `CONFIRMED` /
  `UNAVAILABLE`, upload the supplier voucher (`TripDocument`), timeline entry.
- **3.2** New **Verify-Activities** desk (list + confirm/upload-ticket).
- **3.3** Booking-level rollup recompute + status-change notifications hook.

### Phase 4 — Replacement flow  ⬜
- **4.1** Mark item `UNAVAILABLE`; ops proposes alternatives (catalog query —
  `hotel_room_pricing` for the city + stay category; activity variants; cabs).
- **4.2** Customer approves/selects → old row `REPLACED`, new `IN_PROCESS`;
  snapshot/booking "as-fulfilled" view updated; timeline.
- **4.3** *(optional)* paid-upgrade settlement — reuse the date-change top-up/
  refund machinery, behind a flag.

### Phase 5 — Notifications & live refresh  ⬜
- **5.1** Email/WhatsApp on each status change (gated by `NOTIFICATIONS_ENABLED`).
- **5.2** Polling/auto-refresh on the status page + "what happens next" hints.

---

## Status

| Phase | Step | State |
|-------|------|-------|
| 1 | 1.1 schema + migration | ✅ DONE (migration 20260606120000_status_tracking_phase1) |
| 1 | 1.2 materialise at booking | NOT STARTED |
| 1 | 1.3 reconcile admin upserts | NOT STARTED |
| 2 | 2.1 loader | NOT STARTED |
| 2 | 2.2 checklist UI | NOT STARTED |
| 2 | 2.3 links/emails | NOT STARTED |
| 3 | 3.1 verify hotels/cabs status+voucher | NOT STARTED |
| 3 | 3.2 verify-activities desk | NOT STARTED |
| 3 | 3.3 rollup + notify hook | NOT STARTED |
| 4 | 4.1 unavailable + options | NOT STARTED |
| 4 | 4.2 customer approve/swap | NOT STARTED |
| 4 | 4.3 paid-upgrade settlement (opt) | NOT STARTED |
| 5 | 5.1 notifications | NOT STARTED |
| 5 | 5.2 live refresh | NOT STARTED |
