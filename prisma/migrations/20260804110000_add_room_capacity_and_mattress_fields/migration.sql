-- Room capacity snapshot (for a catalog-picked room) and manual mattress
-- count (for a hand-typed/hotel-team-filled day) — see the schema comments
-- on custom_itineraries.
ALTER TABLE "custom_itineraries" ADD COLUMN "accommodationMaxAdults" INTEGER;
ALTER TABLE "custom_itineraries" ADD COLUMN "accommodationMaxChildren" INTEGER;
ALTER TABLE "custom_itineraries" ADD COLUMN "accommodationExtraBedCapacity" INTEGER;
ALTER TABLE "custom_itineraries" ADD COLUMN "manualExtraBeds" INTEGER;
