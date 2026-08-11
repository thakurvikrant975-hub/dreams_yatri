-- Internal hotel-team -> sales-exec note on a fulfilled day, kept out of
-- the itinerary PDF (separate from the existing client-facing `notes`).
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelFillNote" TEXT;
