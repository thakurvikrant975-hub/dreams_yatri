-- Tracks whether/when a client actually opened their shared itinerary link
-- (view-tracking), and keeps the last-sent version's data before an overwrite
-- so a sales exec editing after send isn't flying blind on what changed.
ALTER TABLE "custom_packages"
  ADD COLUMN "viewedAt" TIMESTAMP(3),
  ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "previousSnapshot" JSONB;
