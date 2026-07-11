-- Structured flight/train endpoints so the itinerary map can plot the
-- start-to-destination leg as a flight/train route (instead of driving
-- directions, which is meaningless for e.g. Mumbai -> Kerala) — free-text
-- flightNotes/trainNotes alone can't tell the map where the leg actually goes.
ALTER TABLE "custom_packages"
  ADD COLUMN "flightFrom" TEXT,
  ADD COLUMN "flightTo" TEXT,
  ADD COLUMN "trainFrom" TEXT,
  ADD COLUMN "trainTo" TEXT;
