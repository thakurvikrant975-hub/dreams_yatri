-- Backfill the room-capacity snapshot on days built BEFORE those columns
-- existed (added 20260804110000_add_room_capacity_and_mattress_fields).
--
-- Those days still carry their roomPricingId, so the real caps are recoverable
-- from the catalog room they point at. Without this, the "N Rooms | X Adults"
-- line falls back to base beds alone and over-reports the room count relative
-- to what the package was actually priced for (the pricing engine reads the
-- LIVE room via roomPricingId, so it was always right — only the display drifted).
--
-- Only fills NULLs, and only where a catalog room is actually linked: a
-- hand-typed day has no roomPricingId and must keep its NULLs so it stays on
-- the manual rooms/mattresses inputs rather than an auto-computed count.
UPDATE "custom_itineraries" AS ci
SET
  "accommodationMaxAdults"        = COALESCE(ci."accommodationMaxAdults", r."max_adults"),
  "accommodationMaxChildren"      = COALESCE(ci."accommodationMaxChildren", r."max_children"),
  "accommodationExtraBedCapacity" = COALESCE(ci."accommodationExtraBedCapacity", r."extra_bed_capacity")
FROM "hotel_room_pricing" AS p
JOIN "hotel_rooms" AS r ON r."id" = p."room_id"
WHERE p."id" = ci."roomPricingId"
  AND ci."roomPricingId" IS NOT NULL
  AND (
    ci."accommodationMaxAdults" IS NULL
    OR ci."accommodationMaxChildren" IS NULL
    OR ci."accommodationExtraBedCapacity" IS NULL
  );
