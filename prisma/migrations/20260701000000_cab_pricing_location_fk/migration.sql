-- Make destination_id nullable (backward compat — existing records keep their value)
ALTER TABLE "cab_pricings" ALTER COLUMN "destination_id" DROP NOT NULL;

-- Add location_id column (primary city reference via locations table)
ALTER TABLE "cab_pricings" ADD COLUMN "location_id" BIGINT;

-- Backfill location_id from destination's linked location where available
UPDATE "cab_pricings" cp
SET "location_id" = CAST(d."location_id" AS BIGINT)
FROM "destinations" d
WHERE cp."destination_id" = d."id"
  AND d."location_id" IS NOT NULL
  AND d."location_id" ~ '^[0-9]+$';

-- Add FK constraint
ALTER TABLE "cab_pricings"
  ADD CONSTRAINT "cab_pricings_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for location_id lookups
CREATE INDEX "cab_pricings_location_id_idx" ON "cab_pricings"("location_id");
