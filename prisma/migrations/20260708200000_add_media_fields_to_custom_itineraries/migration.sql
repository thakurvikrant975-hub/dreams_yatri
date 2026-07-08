-- Photo fields for the package builder's day-by-day itinerary: lets a
-- selected hotel room, cab/vehicle, and activity carry a preview photo
-- through to the client-facing itinerary document.
ALTER TABLE "custom_itineraries"
  ADD COLUMN "accommodationPhoto" TEXT,
  ADD COLUMN "transportPhoto" TEXT;

ALTER TABLE "custom_itinerary_activities"
  ADD COLUMN "photo" TEXT;
