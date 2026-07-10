-- AlterTable: custom_packages — flight/train inclusion toggles
ALTER TABLE "custom_packages"
  ADD COLUMN "flightsIncluded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "flightNotes" TEXT,
  ADD COLUMN "trainIncluded" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "trainNotes" TEXT;

-- AlterTable: custom_itineraries — structured hotel fields
ALTER TABLE "custom_itineraries"
  ADD COLUMN "hotelCheckIn" TEXT,
  ADD COLUMN "hotelCheckOut" TEXT,
  ADD COLUMN "hotelMealPlan" TEXT;

-- CreateTable: custom_itinerary_activities (replaces the flat activities TEXT[])
CREATE TABLE "custom_itinerary_activities" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_itinerary_activities_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_itinerary_activities_itineraryId_idx" ON "custom_itinerary_activities"("itineraryId");

ALTER TABLE "custom_itinerary_activities"
  ADD CONSTRAINT "custom_itinerary_activities_itineraryId_fkey"
  FOREIGN KEY ("itineraryId") REFERENCES "custom_itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: carry over each existing flat activity string as a row with no description
INSERT INTO "custom_itinerary_activities" ("id", "itineraryId", "title", "sortOrder", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  ci."id",
  act.value,
  act.ordinality - 1,
  now(),
  now()
FROM "custom_itineraries" ci,
  LATERAL unnest(ci."activities") WITH ORDINALITY AS act(value, ordinality)
WHERE ci."activities" IS NOT NULL AND array_length(ci."activities", 1) > 0;

-- AlterTable: drop the now-migrated flat activities column
ALTER TABLE "custom_itineraries" DROP COLUMN "activities";
