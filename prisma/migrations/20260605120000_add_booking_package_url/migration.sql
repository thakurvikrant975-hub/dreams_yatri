-- Add packageUrl to bookings (public package URL booked, for admin reference/management)
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "packageUrl" TEXT;
