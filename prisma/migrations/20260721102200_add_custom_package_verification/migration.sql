-- Internal pricing double-check flag for custom_packages, independent of
-- the client-facing status (SENT/ACCEPTED/DECLINED).
ALTER TABLE "custom_packages" ADD COLUMN "verified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "custom_packages" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "custom_packages" ADD COLUMN "verifiedBy" TEXT;
ALTER TABLE "custom_packages" ADD COLUMN "verifiedByName" TEXT;
