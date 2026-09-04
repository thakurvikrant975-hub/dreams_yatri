-- AlterTable
ALTER TABLE "custom_packages" ADD COLUMN "everVerifiedAt" TIMESTAMP(3);

-- Backfill: a package that's currently verified, or that has since moved
-- past review (sent, or has a verifiedAt on record from before this column
-- existed), was approved by costing at some point even though the live
-- `verified` flag may have been reset by a later rework. Best-effort based
-- on data already on hand — anything genuinely missed just means the
-- Save to Library option won't retroactively show until the next approval.
UPDATE "custom_packages"
SET "everVerifiedAt" = COALESCE("verifiedAt", "sentAt")
WHERE "verified" = true OR "verifiedAt" IS NOT NULL OR "sentAt" IS NOT NULL;
