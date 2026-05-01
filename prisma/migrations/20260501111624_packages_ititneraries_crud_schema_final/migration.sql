/*
  Warnings:

  - You are about to drop the column `nights` on the `itinerary_stays` table. All the data in the column will be lost.
  - You are about to drop the column `rate_per_day` on the `package_cab_options` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `package_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `gst_pct` on the `package_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `package_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `margin_pct` on the `package_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `meal_rate_ap` on the `package_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `meal_rate_cp` on the `package_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `meal_rate_map` on the `package_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `package_pricing` table. All the data in the column will be lost.
  - You are about to drop the column `package_id` on the `package_routes` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[package_id,duration_id,route_id,day]` on the table `package_itineraries` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[route_id,sort_order]` on the table `route_stops` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `rate_per_cab` to the `package_cab_options` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "package_routes" DROP CONSTRAINT "package_routes_package_id_fkey";

-- DropIndex
DROP INDEX "itinerary_activities_itinerary_id_activity_id_key";

-- DropIndex
DROP INDEX "itinerary_activities_itinerary_id_idx";

-- DropIndex
DROP INDEX "itinerary_notes_itinerary_id_idx";

-- DropIndex
DROP INDEX "itinerary_transfers_itinerary_id_idx";

-- DropIndex
DROP INDEX "package_itineraries_route_id_day_key";

-- AlterTable
ALTER TABLE "itinerary_stays" DROP COLUMN "nights",
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "package_cab_options" DROP COLUMN "rate_per_day",
ADD COLUMN     "rate_per_cab" DECIMAL(10,2) NOT NULL;

-- AlterTable
ALTER TABLE "package_pricing" DROP COLUMN "created_at",
DROP COLUMN "gst_pct",
DROP COLUMN "is_active",
DROP COLUMN "margin_pct",
DROP COLUMN "meal_rate_ap",
DROP COLUMN "meal_rate_cp",
DROP COLUMN "meal_rate_map",
DROP COLUMN "updated_at",
ADD COLUMN     "gst_percentage" DECIMAL(5,2) NOT NULL DEFAULT 5,
ADD COLUMN     "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "package_routes" DROP COLUMN "package_id",
ADD COLUMN     "packagesId" INTEGER;

-- CreateIndex
CREATE INDEX "itinerary_activities_itinerary_id_sort_order_idx" ON "itinerary_activities"("itinerary_id", "sort_order");

-- CreateIndex
CREATE INDEX "itinerary_notes_itinerary_id_sort_order_idx" ON "itinerary_notes"("itinerary_id", "sort_order");

-- CreateIndex
CREATE INDEX "itinerary_transfers_itinerary_id_sort_order_idx" ON "itinerary_transfers"("itinerary_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "package_itineraries_package_id_duration_id_route_id_day_key" ON "package_itineraries"("package_id", "duration_id", "route_id", "day");

-- CreateIndex
CREATE INDEX "package_pricing_package_id_idx" ON "package_pricing"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_stops_route_id_sort_order_key" ON "route_stops"("route_id", "sort_order");

-- AddForeignKey
ALTER TABLE "package_routes" ADD CONSTRAINT "package_routes_packagesId_fkey" FOREIGN KEY ("packagesId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
