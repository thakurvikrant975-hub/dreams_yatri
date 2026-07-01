-- AlterTable
ALTER TABLE "cab_pricings" ADD COLUMN IF NOT EXISTS "created_by" TEXT;

-- AlterTable
ALTER TABLE "activities" ADD COLUMN IF NOT EXISTS "created_by" TEXT;
