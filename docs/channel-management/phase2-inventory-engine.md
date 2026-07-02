# Channel Management — Phase 2: Inventory Engine

**Status:** 🟡 CORE COMPLETE (atomic engine shipped + verified). Reservation record +
booking-flow wiring pending (needs a direct-booking flow; see "Remaining").

## Context

`BookingHotel` is a **package component** (part of a trip `Booking`, ops-confirmed via
fulfillment) — there is no existing flow that sells a room against per-date inventory. So the
engine is built as a **reusable core** that any future caller (direct booking, package,
Channex webhook) invokes.

## Delivered — `app/lib/hotel-inventory/availability.ts`

Atomic, overbooking-proof operations over the Phase 1 `hotel_room_availability` ledger:

| Function | Purpose |
|---|---|
| `stayNights(checkIn, checkOut)` | nights of a stay = dates in `[checkIn, checkOut)` |
| `ensureAvailability(roomId, nights)` | lazily create rows, seeding `total_units` from `hotel_rooms.num_rooms` (idempotent, `ON CONFLICT DO NOTHING`) |
| `getRoomAvailability(roomId, in, out)` | per-night `{ available, stopSell, priceOverride, restrictions }` |
| `evaluateStay(nights, units)` | pure check: units on every night + LOS + CTA/CTD |
| `checkStayAvailable(...)` | read-only convenience (ensure + get + evaluate) |
| `holdInventory(roomId, in, out, units)` | **atomic** all-or-nothing hold |
| `releaseInventory(roomId, in, out, units)` | release on cancel; clamps at 0 |

**Overbooking safety:** each night's hold is one guarded SQL UPDATE —
`SET booked_units = booked_units + n WHERE ... AND booked_units + n <= total_units AND NOT stop_sell`.
Postgres updates each row atomically, so concurrent holds cannot oversell. Multi-night holds run
in one transaction; if any night fails, the whole hold rolls back (no partial reservations).

## Verified (real concurrency, dev DB)

Drove the guarded UPDATE with `pg` against room #59 (`total_units = 2`), far-future sandbox
date, then cleaned up:

```
5 concurrent holds for 2 rooms:
  succeeded: 2   rejected: 3   booked_units now: 2
  OVERBOOKING PREVENTED: PASS ✅
release (2x over-release): booked_units = 0  PASS ✅ (clamped)
```

## Remaining (Phase 2 continuation)

- **Reservation record + source attribution** — a booking row carrying `source/channel`,
  external ref, commission, net/gross, and a **hold key** so release is exactly-once
  (idempotent) on webhook retries.
- **Booking-flow wiring** — a real direct-booking path (connects to the hotel detail page)
  that calls `holdInventory` on confirm and `releaseInventory` on cancel; and hooking the
  package/ops flow to decrement too.
- **ARI price resolver** — combine `price_override` with the existing season/weekend/occupancy
  engine into a single `(room, date) → { available, price, restrictions }`. Deferred to avoid
  re-implementing (and diverging from) the existing pricing logic.

Pricing is intentionally NOT resolved in the engine — only `price_override` is surfaced.
