ALTER TABLE "vehicles"    ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "cab_drivers" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
