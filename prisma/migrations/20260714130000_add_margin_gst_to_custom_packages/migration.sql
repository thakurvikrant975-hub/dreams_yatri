-- AlterTable
ALTER TABLE "custom_packages" ADD COLUMN "marginPercentage" DOUBLE PRECISION NOT NULL DEFAULT 25;
ALTER TABLE "custom_packages" ADD COLUMN "gstPercentage" DOUBLE PRECISION NOT NULL DEFAULT 5;
