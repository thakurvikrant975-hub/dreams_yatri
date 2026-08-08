-- Coordinates for the day's drop point, the counterpart to the pickup pair
-- that already exists. Road distance and drive time are derived by routing
-- between the two, which needs both ends as real points rather than names.
ALTER TABLE "custom_itineraries" ADD COLUMN "transportDropLat" DOUBLE PRECISION;
ALTER TABLE "custom_itineraries" ADD COLUMN "transportDropLng" DOUBLE PRECISION;
