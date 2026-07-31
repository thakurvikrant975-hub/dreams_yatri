-- Hotel-team fulfillment queue: lets a sales exec flag a day as "needs
-- hotel from the team" instead of leaving it silently blank/unpriced.
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelPending" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelPendingNote" TEXT;
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelRequestedAt" TIMESTAMP(3);
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelFilledAt" TIMESTAMP(3);
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelFilledById" TEXT;
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelFilledByName" TEXT;
ALTER TABLE "custom_itineraries" ADD COLUMN "manualHotelPricePerNight" DOUBLE PRECISION;

CREATE INDEX "custom_itineraries_hotelPending_idx" ON "custom_itineraries"("hotelPending");
