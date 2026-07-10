-- The room search now surfaces up to 3 real room photos alongside the
-- hotel's main photo (accommodationPhoto), so the package builder and the
-- client-facing itinerary document can show a real photo gallery instead of
-- text-only hotel info.
ALTER TABLE "custom_itineraries"
  ADD COLUMN "accommodationRoomPhotos" TEXT[] NOT NULL DEFAULT '{}';
