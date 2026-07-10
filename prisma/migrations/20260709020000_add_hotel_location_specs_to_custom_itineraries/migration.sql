-- Richer hotel details in the itinerary builder/preview: location, room
-- specs (bed/view/area), and room capacity (used to compute the "X Room(s) |
-- Y Adults" occupancy line against the query's traveller counts).
ALTER TABLE "custom_itineraries"
  ADD COLUMN "accommodationLocation" TEXT,
  ADD COLUMN "accommodationRoomSpecs" TEXT,
  ADD COLUMN "accommodationRoomCapacity" INTEGER;
