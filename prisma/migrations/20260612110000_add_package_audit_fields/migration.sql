-- Add created_by/updated_by audit fields to packages, mirroring categories/destinations.
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "packages" ADD COLUMN IF NOT EXISTS "updated_by" TEXT;
