/*
  Warnings:

  - You are about to drop the column `margin_percentage` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `max_persons` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `min_persons` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `original_price` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `pricing_type` on the `activities` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "activities" DROP COLUMN "margin_percentage",
DROP COLUMN "max_persons",
DROP COLUMN "min_persons",
DROP COLUMN "original_price",
DROP COLUMN "price",
DROP COLUMN "pricing_type";

-- AlterTable
ALTER TABLE "hotel_room_pricing" ADD COLUMN     "gst_percentage" DECIMAL(5,2) NOT NULL DEFAULT 18;

-- AlterTable
ALTER TABLE "itinerary_activities" ADD COLUMN     "variant_id" INTEGER;

-- CreateTable
CREATE TABLE "activity_variants" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "booking_mode" TEXT NOT NULL,
    "pricing_type" TEXT NOT NULL,
    "min_persons" INTEGER,
    "max_persons" INTEGER,
    "cost_price" DECIMAL(10,2),
    "gst_percentage" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "valid_from" TIMESTAMP(3),
    "valid_to" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "activity_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_variant_pricing" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "age_from" INTEGER,
    "age_to" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "activity_variant_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_addons" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "pricing_type" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "cost_price" DECIMAL(10,2),
    "is_optional" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "activity_addons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_variants_activity_id_idx" ON "activity_variants"("activity_id");

-- CreateIndex
CREATE INDEX "activity_variant_pricing_variant_id_idx" ON "activity_variant_pricing"("variant_id");

-- CreateIndex
CREATE INDEX "activity_addons_activity_id_idx" ON "activity_addons"("activity_id");

-- AddForeignKey
ALTER TABLE "activity_variants" ADD CONSTRAINT "activity_variants_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_variant_pricing" ADD CONSTRAINT "activity_variant_pricing_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "activity_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_addons" ADD CONSTRAINT "activity_addons_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_activities" ADD CONSTRAINT "itinerary_activities_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "activity_variants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
