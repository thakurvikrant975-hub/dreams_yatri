-- Add missing columns to activities table
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "destination_id" INTEGER;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "location_id" BIGINT;
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "included_meals" TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS "activities_destination_id_is_active_idx" ON "activities"("destination_id", "is_active");
CREATE INDEX IF NOT EXISTS "activities_location_id_idx" ON "activities"("location_id");

ALTER TABLE "activities" ADD CONSTRAINT "activities_destination_id_fkey"
  FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "activities" ADD CONSTRAINT "activities_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
