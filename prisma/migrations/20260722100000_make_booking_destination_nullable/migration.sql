-- Direct hotel-only bookings have no meaningful entry in the curated
-- `destinations` catalog (that's an ops/package-browsing concept) and rely on
-- the hotel's own Location record instead. Drop the NOT NULL constraint so
-- Booking.destinationId can be left null for those bookings; package bookings
-- are unaffected and keep setting it as before.
ALTER TABLE "bookings" ALTER COLUMN "destinationId" DROP NOT NULL;
