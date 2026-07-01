-- Make destination_id nullable (backward compat — existing records keep their value)
ALTER TABLE "cab_pricings" ALTER COLUMN "destination_id" DROP NOT NULL;

-- Add location_id column (idempotent — safe if partial run already created it)
ALTER TABLE "cab_pricings" ADD COLUMN IF NOT EXISTS "location_id" BIGINT;

-- Backfill location_id from destination's linked location
-- Only backfill rows where the location actually exists in the locations table
UPDATE "cab_pricings" cp
SET "location_id" = CAST(d."location_id" AS BIGINT)
FROM "destinations" d
WHERE cp."destination_id" = d."id"
  AND d."location_id" IS NOT NULL
  AND d."location_id" ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM "locations" l WHERE l."id" = CAST(d."location_id" AS BIGINT)
  );

-- Clear any stale location_id values left by a previous partial run
-- (values that point to non-existent locations would violate the FK below)
UPDATE "cab_pricings"
SET "location_id" = NULL
WHERE "location_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "locations" l WHERE l."id" = "cab_pricings"."location_id"
  );

-- Add FK constraint (idempotent)
ALTER TABLE "cab_pricings"
  DROP CONSTRAINT IF EXISTS "cab_pricings_location_id_fkey";
ALTER TABLE "cab_pricings"
  ADD CONSTRAINT "cab_pricings_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add index for location_id lookups (idempotent)
DROP INDEX IF EXISTS "cab_pricings_location_id_idx";
CREATE INDEX "cab_pricings_location_id_idx" ON "cab_pricings"("location_id");
