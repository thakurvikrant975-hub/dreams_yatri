-- Allows a single custom-package itinerary day to book multiple different
-- room types and multiple different cabs, each with its own quantity,
-- instead of exactly one of each per day.
ALTER TABLE "custom_itineraries"
  ADD COLUMN "roomsCount" INTEGER,
  ADD COLUMN "extraRooms" JSONB,
  ADD COLUMN "cabQuantity" INTEGER,
  ADD COLUMN "extraCabs" JSONB;
