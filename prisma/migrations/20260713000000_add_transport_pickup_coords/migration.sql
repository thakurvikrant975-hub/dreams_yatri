-- Links a builder itinerary day's pickup point to real coordinates (picked
-- via the Location catalog, not free-text) so the nearest-city cab search
-- can be run against the actual pickup location instead of a geocoded guess.
ALTER TABLE "custom_itineraries" ADD COLUMN "transportPickupLat" DOUBLE PRECISION;
ALTER TABLE "custom_itineraries" ADD COLUMN "transportPickupLng" DOUBLE PRECISION;
