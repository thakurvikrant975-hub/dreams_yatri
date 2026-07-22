-- AlterTable
ALTER TABLE "itinerary_settings" ADD COLUMN "defaultMarginPercentage" DOUBLE PRECISION NOT NULL DEFAULT 25,
ADD COLUMN "defaultGstPercentage" DOUBLE PRECISION NOT NULL DEFAULT 5;
