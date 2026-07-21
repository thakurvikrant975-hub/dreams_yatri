-- AlterTable
ALTER TABLE "itinerary_settings" ADD COLUMN "customPolicySections" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "custom_packages" ADD COLUMN "customPolicySections" JSONB;
