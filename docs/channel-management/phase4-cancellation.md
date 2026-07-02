# Channel Management — Phase 4: Structured Cancellation (+ content standardization note)

**Status:** ✅ Cancellation COMPLETE (schema + resolver verified). Content standardization
**deferred to Phase 5** (done lazily at channel-mapping time).

## Delivered — per-rate-plan cancellation

- **Schema:** `hotel_room_pricing.cancellation_policy` (`HotelCancellationPolicy?`,
  migration `20260702020000_rate_plan_cancellation_policy`). A rate plan can now be
  refundable/non-refundable independently; falls back to the hotel-level policy when null.
- **Resolver:** `app/lib/hotel-inventory/cancellation.ts` — **pure** (no DB / no server-only),
  usable server + client + channel adapters:
  - `resolveCancellation(policy, checkInISO, nowISO?)` → `{ refundable, penaltyPercent,
    freeUntilISO, label }` (free-until-deadline, else 100% — the shape these enum tiers imply).
  - `effectivePolicy(ratePolicy, hotelPolicy)` → rate wins, else hotel, else `NON_REFUNDABLE`.
  - `cancellationLabel(policy)`.
  - Deadlines: `FREE_TILL_24H/48H/72H/7D` = N hours before check-in; `FREE_TILL_CHECKIN` = at
    check-in; `NON_REFUNDABLE` = never.

## Verified

Ran the real resolver via `tsx` — **11/11 pass**: non-refundable, >deadline refundable,
exact-deadline still free, within-deadline non-refundable, check-in boundary, 7-day deadline
math, and all three `effectivePolicy` fallbacks.

## Deferred: content standardization

Standardizing amenity/facility codes, bed types, occupancy definitions, and geo to OTA
taxonomies is **only needed when mapping to a channel**, and each channel/Channex has its own
code lists. Doing it now would be speculative. It moves into **Phase 5 (channel mapping)** where
the target taxonomy is known. Photo categories are already strong (enforced tagging).

## Follow-ups (consumers)

- Surface cancellation in `getRoomARI` output + the calendar/hotel-detail (small: add the field
  to the lead-plan resolution).
- Owner UI to set a rate plan's cancellation policy (currently DB-settable).
- Use `resolveCancellation` in `cancelReservation` refund math when the direct-booking flow lands.
