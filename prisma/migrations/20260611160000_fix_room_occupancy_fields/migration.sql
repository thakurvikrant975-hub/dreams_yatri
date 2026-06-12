-- Add extra_bed_capacity if not present (was added directly to dev without a migration)
ALTER TABLE "hotel_rooms" ADD COLUMN IF NOT EXISTS "extra_bed_capacity" INTEGER NOT NULL DEFAULT 1;

-- Add max_adults and max_children (IF NOT EXISTS for idempotency across envs)
ALTER TABLE "hotel_rooms" ADD COLUMN IF NOT EXISTS "max_adults"   INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "hotel_rooms" ADD COLUMN IF NOT EXISTS "max_children" INTEGER NOT NULL DEFAULT 2;

-- Seed max_adults from existing occupancy data where still at default
UPDATE "hotel_rooms"
SET max_adults = GREATEST(max_occupancy + extra_bed_capacity, 3)
WHERE max_adults = 3;
