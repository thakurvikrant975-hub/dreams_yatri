-- Up to 3 gallery photos (with per-photo captions) per activity, matching
-- the "Glimpses of the experience" gallery style on the live package page.
-- The existing singular `photo` column stays for backward compatibility.
ALTER TABLE "custom_itinerary_activities"
  ADD COLUMN "photos" TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "photoLabels" TEXT[] NOT NULL DEFAULT '{}';
