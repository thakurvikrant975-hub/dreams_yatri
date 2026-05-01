/*
  Warnings:

  - You are about to drop the column `alt` on the `package_gallery` table. All the data in the column will be lost.
  - You are about to drop the column `is_active` on the `package_gallery` table. All the data in the column will be lost.
  - You are about to drop the column `thumbnail` on the `package_gallery` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `route_stops` table. All the data in the column will be lost.
  - Added the required column `destination_id` to the `route_stops` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "GallerySourceType" ADD VALUE 'ROOM';

-- DropForeignKey
ALTER TABLE "route_stops" DROP CONSTRAINT "route_stops_route_id_fkey";

-- DropIndex
DROP INDEX "route_stops_route_id_location_key";

-- AlterTable
ALTER TABLE "destinations" ADD COLUMN     "latitude" DECIMAL(10,8),
ADD COLUMN     "longitude" DECIMAL(11,8),
ADD COLUMN     "place_id" TEXT;

-- AlterTable
ALTER TABLE "package_durations" ADD COLUMN     "thumbnail_url" TEXT;

-- AlterTable
ALTER TABLE "package_gallery" DROP COLUMN "alt",
DROP COLUMN "is_active",
DROP COLUMN "thumbnail",
ADD COLUMN     "label" TEXT;

-- AlterTable
ALTER TABLE "package_routes" ADD COLUMN     "polyline" JSONB,
ADD COLUMN     "total_distance_km" DOUBLE PRECISION,
ADD COLUMN     "total_duration_min" INTEGER;

-- AlterTable
ALTER TABLE "route_stops" DROP COLUMN "location",
ADD COLUMN     "destination_id" INTEGER NOT NULL,
ADD COLUMN     "latitude" DECIMAL(10,8),
ADD COLUMN     "longitude" DECIMAL(11,8),
ALTER COLUMN "sort_order" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "package_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
