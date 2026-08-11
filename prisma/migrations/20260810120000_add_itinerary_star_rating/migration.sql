-- Star rating snapshotted onto the day when a catalog room is picked.
--
-- Nullable and additive: existing rows keep NULL and render no stars, which is
-- exactly right for a stay chosen before this existed or typed by hand. No
-- backfill — the rating belongs to the room that was picked, and re-deriving it
-- for historical rows would mean guessing from a hotel name.
ALTER TABLE "custom_itineraries" ADD COLUMN "accommodationStarRating" TEXT;
