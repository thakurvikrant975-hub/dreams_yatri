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

## Remaining (Phase 2 continuation)

- **Reservation record + source attribution** — a booking row carrying `source/channel`,
  external ref, commission, net/gross, and a **hold key** so release is exactly-once
  (idempotent) on webhook retries.
- **Booking-flow wiring** — a real direct-booking path (connects to the hotel detail page)
  that calls `holdInventory` on confirm and `releaseInventory` on cancel; and hooking the
  package/ops flow to decrement too.
