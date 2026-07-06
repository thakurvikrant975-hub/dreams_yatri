-- Backfill NULL updated_at values before enforcing NOT NULL
UPDATE "vehicles" SET "updated_at" = COALESCE("created_at", now()) WHERE "updated_at" IS NULL;

-- AlterTable
ALTER TABLE "vehicles" ALTER COLUMN "updated_at" SET NOT NULL;
