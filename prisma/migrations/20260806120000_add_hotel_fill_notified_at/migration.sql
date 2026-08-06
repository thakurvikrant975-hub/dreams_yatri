-- One-shot "seen" gate for the "hotel added for <package>" toast, mirroring
-- custom_packages.execNotifiedAt but kept per-day so it never collides with
-- the approved/rejected notification on the same package.
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelFillNotifiedAt" TIMESTAMP(3);
