-- Structured transport/transfer details (vehicle type, seats, pickup/drop
-- points, distance) so the itinerary preview can show a proper route diagram
-- per day instead of one flat "transport" text string.
ALTER TABLE "custom_itineraries"
  ADD COLUMN "transportVehicleType" TEXT,
  ADD COLUMN "transportSeats" INTEGER,
  ADD COLUMN "transportPickup" TEXT,
  ADD COLUMN "transportDrop" TEXT,
  ADD COLUMN "transportDistanceKm" DOUBLE PRECISION;
