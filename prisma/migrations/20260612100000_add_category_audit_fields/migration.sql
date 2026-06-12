-- Add audit fields (created_at, updated_at, created_by, updated_by) to categories,
-- mirroring the audit columns already present on destinations etc.
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "updated_by" TEXT;
