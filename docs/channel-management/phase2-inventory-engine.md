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

## ARI resolver — `app/lib/hotel-inventory/rates.ts` ✅

Read path combining availability + pricing into `(room, date) → { available, price, restrictions }`:

| Function | Purpose |
|---|---|
| `getRoomARI(roomId, in, out, occupancy?)` | per-night `DailyRate` = availability + resolved price + `priceSource` |
| `getStayQuote(roomId, in, out, occupancy?)` | `{ nights, total, allAvailable }` for a stay |

Price precedence per night: **`price_override` → season (weekend/base) → base rate plan → none.**
Season resolution **mirrors** `app/services/package-pricing.service.ts` (`resolveHotelSeasonPricing`):
year-agnostic month/day match (wrap-around supported), weekend = Sat/Sun `weekend_price_per_night`,
occupancy overrides from season else base. Resolves the room's **lead** plan (lowest `sort_order`)
at `occupancy ?? base_adults`. Per-rate-plan channel pricing is refined in Phase 5.

**Verified** on real data (room 59, fresh client): model accessor resolves, availability
rows create/merge (`avail=1/1`), price resolves to base ₹3698 for out-of-season nights, cleanup ok.

> ⚠️ The already-running dev server caches the **old** Prisma client (started before
> `prisma generate`). Restart `next dev` to pick up the `hotel_room_availability` model — until
> then routes/pages that touch it will 500 with `... reading 'findMany'`.

## Reservation engine — `app/lib/hotel-inventory/reservations.ts` ✅

Model `hotel_reservation` (migration `20260702010000_add_hotel_reservation`): stay + `units` +
`source` (channel) + `external_ref` + money (`gross`/`net`/`commission`) + `hold_key` (unique
idempotency) + `released_at` (exactly-once guard) + `status` (`HELD`/`CONFIRMED`/`CANCELLED`).

| Function | Guarantee |
|---|---|
| `createReservation(input)` | holds inventory **and** writes the row in one transaction; idempotent on `holdKey` (repeat → existing, no double-hold); `P2002` race → dedupe |
| `confirmReservation(id)` | HELD → CONFIRMED (idempotent) |
| `cancelReservation(id)` | releases inventory + marks CANCELLED **exactly once** (`released_at` guard) |

Atomicity: a failed hold (sell-out) rolls back the whole transaction → **no orphan reservation**;
a failed insert rolls back the hold.

**Verified** on the dev DB (room 59, `total=1`, 2 nights):

```
A create K1:       booked=[1,1]  reservation ✓                         PASS
B re-create K1:    deduped, booked=[1,1]  (no double-hold)             PASS
C create K2:       HOLD_CONFLICT, booked=[1,1], no orphan reservation  PASS
D cancel K1:       booked=[0,0]  (released)                            PASS
E cancel K1 again: alreadyReleased, booked=[0,0]  (exactly-once)       PASS
```

Engine refactor: `holdNightsTx` / `releaseNightsTx` extracted from `availability.ts` so the
hold and the reservation row share one transaction.

## Phase 2 status: ✅ CORE COMPLETE

Engine + resolver + reservation record all shipped & verified. The only remaining item is a
**consumer**: wiring a real direct-booking UX (hotel detail page → `createReservation`) and
hooking the package/ops flow to decrement — a product-flow task for when the hotel detail page
gets real data (it currently uses dummy data), and a natural companion to Phase 3.
