-- package_itineraries.meals was added without DEFAULT so existing rows are NULL.
-- Prisma throws P2023 when it reads NULL for a non-nullable String[] field.
-- Fix: backfill NULLs then set the column default so new rows are safe too.

UPDATE "package_itineraries" SET "meals" = ARRAY[]::TEXT[] WHERE "meals" IS NULL;
ALTER TABLE "package_itineraries" ALTER COLUMN "meals" SET DEFAULT ARRAY[]::TEXT[];
