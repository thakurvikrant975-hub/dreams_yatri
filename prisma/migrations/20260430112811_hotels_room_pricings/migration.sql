/*
  Warnings:

  - You are about to drop the column `meals` on the `package_itineraries` table. All the data in the column will be lost.
  - You are about to drop the `itinerary_hotels` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `package_hotels` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "itinerary_hotels" DROP CONSTRAINT "itinerary_hotels_hotel_id_fkey";

-- DropForeignKey
ALTER TABLE "itinerary_hotels" DROP CONSTRAINT "itinerary_hotels_itinerary_id_fkey";

-- DropForeignKey
ALTER TABLE "itinerary_hotels" DROP CONSTRAINT "itinerary_hotels_stay_category_id_fkey";

-- DropForeignKey
ALTER TABLE "package_hotels" DROP CONSTRAINT "package_hotels_hotel_id_fkey";

-- DropForeignKey
ALTER TABLE "package_hotels" DROP CONSTRAINT "package_hotels_package_id_fkey";

-- DropForeignKey
ALTER TABLE "package_hotels" DROP CONSTRAINT "package_hotels_stay_category_id_fkey";

-- AlterTable
ALTER TABLE "package_itineraries" DROP COLUMN "meals";

-- DropTable
DROP TABLE "itinerary_hotels";

-- DropTable
DROP TABLE "package_hotels";

-- CreateTable
CREATE TABLE "itinerary_stays" (
    "id" SERIAL NOT NULL,
    "itinerary_id" INTEGER NOT NULL,
    "stay_category_id" INTEGER NOT NULL,
    "room_pricing_id" INTEGER NOT NULL,
    "nights" INTEGER,

    CONSTRAINT "itinerary_stays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_stays_itinerary_id_stay_category_id_key" ON "itinerary_stays"("itinerary_id", "stay_category_id");

-- AddForeignKey
ALTER TABLE "itinerary_stays" ADD CONSTRAINT "itinerary_stays_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "package_itineraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_stays" ADD CONSTRAINT "itinerary_stays_stay_category_id_fkey" FOREIGN KEY ("stay_category_id") REFERENCES "package_stay_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_stays" ADD CONSTRAINT "itinerary_stays_room_pricing_id_fkey" FOREIGN KEY ("room_pricing_id") REFERENCES "hotel_room_pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
