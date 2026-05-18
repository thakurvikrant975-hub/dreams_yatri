-- Create activity_categories table
CREATE TABLE "activity_categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "activity_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "activity_categories_name_key" ON "activity_categories"("name");
CREATE UNIQUE INDEX "activity_categories_slug_key" ON "activity_categories"("slug");
CREATE INDEX "activity_categories_is_active_idx" ON "activity_categories"("is_active");

-- Add category_id to activities (nullable FK to activity_categories)
ALTER TABLE "activities" ADD COLUMN "category_id" INTEGER;
ALTER TABLE "activities" ADD CONSTRAINT "activities_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "activity_categories"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "activities_category_id_is_active_idx" ON "activities"("category_id", "is_active");

-- Remove destination_id from activities
ALTER TABLE "activities" DROP CONSTRAINT IF EXISTS "activities_destination_id_fkey";
DROP INDEX IF EXISTS "activities_destination_id_is_active_idx";
ALTER TABLE "activities" DROP COLUMN IF EXISTS "destination_id";

-- Remove category string column from activities
DROP INDEX IF EXISTS "activities_category_idx";
ALTER TABLE "activities" DROP COLUMN IF EXISTS "category";
