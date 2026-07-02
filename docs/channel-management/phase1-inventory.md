# Channel Management — Phase 1: Per-date Inventory & Restrictions

**Status:** ✅ COMPLETE (schema + migration applied; engine wiring is Phase 2)

## Key finding (corrected scope)

The original plan assumed *flat* pricing. In reality the codebase already has a
**season-based pricing engine**:

- `hotel_room_pricing` — effectively rate plans (plan_name, meal_type, GST, margin, base price).
- `hotel_room_pricing_season` — date-range + **weekend** pricing.
- `hotel_room_pricing_season_occupancy` / `hotel_room_occupancy_prices` — occupancy tiers.
- `hotel_meal_pricing` (+ seasons), `hotel_addons` (+ seasons), `hotel_child_policies`.

So Phase 1 did **not** rebuild rate plans/pricing. The genuine gaps were:

- ❌ No per-date **availability / inventory** ledger (only static `hotel_rooms.num_rooms`
  and a coarse `hotels.prop_avail_from/to` window).
- ❌ No per-date **booking restrictions** (MinLOS/MaxLOS, CTA/CTD, stop-sell).

## What was added

A single per-date **ARI row** per room type — `hotel_room_availability`:

| Field | Purpose |
|---|---|
| `hotel_id`, `room_id`, `date` (`@db.Date`) | keys; `@@unique([room_id, date])` |
| `total_units` | allotment for that date (seed from `hotel_rooms.num_rooms`) |
| `booked_units` | consumed count (Phase 2 writes this atomically) |
| `stop_sell` | hard close-out for the date |
| `price_override` | optional one-off nightly price; base still comes from the season engine |
| `min_los`, `max_los` | length-of-stay restrictions |
| `closed_to_arrival`, `closed_to_departure` | CTA / CTD |
| `note`, `created_at`, `updated_at` | ops metadata |

**Availability rule:** `available = stop_sell ? 0 : max(0, total_units - booked_units)`

**Rate resolution (unchanged base):** `price_override ?? <season/weekend/occupancy engine>`.
So this row is the canonical **A**vailability + **R**ate-override + **I**nventory-restriction
record that Phase 2's engine and (later) Channex sync read/write.

Indexes: `@@unique([room_id, date])`, `@@index([hotel_id, date])`, `@@index([room_id, date])`.
Relations: cascade-delete from both `hotel_rooms` and `hotels`.

## Migration note (⚠️ pre-existing drift)

`prisma migrate dev` could **not** be used: the local `prisma/migrations` folder is out of
sync with the Neon DB (several migrations applied to the DB are missing locally / duplicated),
so `migrate dev` wanted to **reset (drop all data)**. This drift pre-dates this work.

To ship safely without a reset, the table was applied via:
1. Hand-written migration `prisma/migrations/20260702000000_add_hotel_room_availability/migration.sql`
2. `prisma db execute --file …` (additive `CREATE TABLE`, no shadow DB, no reset)
3. `prisma migrate resolve --applied 20260702000000_add_hotel_room_availability` (record in history)
4. `prisma generate`

**Action for the team:** reconcile the migration history vs the Neon DB (baseline the
missing/duplicated migrations) so normal `migrate dev` works again. Until then, use the
`db execute` + `migrate resolve` pattern for new migrations.

## Next (Phase 2)

- Backfill/lazy-create availability rows from `num_rooms` across a rolling horizon.
- Atomic decrement/release engine (transaction + row lock) on booking confirm/cancel.
- Channel-agnostic reservation path (source attribution, external ref) that debits this ledger.
- A daily **ARI resolver** service: `(room, date) → { available, price, restrictions }` combining
  this table with the existing season pricing engine.
