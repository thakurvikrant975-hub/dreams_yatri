/*
  Warnings:

  - Made the column `room_id` on table `hotel_room_pricing` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "hotel_room_pricing" DROP CONSTRAINT "hotel_room_pricing_room_id_fkey";

-- AlterTable
ALTER TABLE "hotel_room_pricing" ADD COLUMN     "valid_from" TIMESTAMP(3),
ADD COLUMN     "valid_to" TIMESTAMP(3),
ALTER COLUMN "room_id" SET NOT NULL;

-- AlterTable
ALTER TABLE "itinerary_stays" ADD COLUMN     "occupancy" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "rooms_count" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "hotel_room_occupancy_prices" (
    "id" SERIAL NOT NULL,
    "pricing_id" INTEGER NOT NULL,
    "occupancy" INTEGER NOT NULL,
    "price_per_night" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),

    CONSTRAINT "hotel_room_occupancy_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_child_policies" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "age_from" INTEGER NOT NULL,
    "age_to" INTEGER NOT NULL,
    "charge_type" TEXT NOT NULL,
    "price" DECIMAL(10,2),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hotel_child_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_room_occupancy_prices_pricing_id_idx" ON "hotel_room_occupancy_prices"("pricing_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_room_occupancy_prices_pricing_id_occupancy_key" ON "hotel_room_occupancy_prices"("pricing_id", "occupancy");

-- CreateIndex
CREATE INDEX "hotel_child_policies_hotel_id_idx" ON "hotel_child_policies"("hotel_id");

-- AddForeignKey
ALTER TABLE "hotel_room_pricing" ADD CONSTRAINT "hotel_room_pricing_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_room_occupancy_prices" ADD CONSTRAINT "hotel_room_occupancy_prices_pricing_id_fkey" FOREIGN KEY ("pricing_id") REFERENCES "hotel_room_pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_child_policies" ADD CONSTRAINT "hotel_child_policies_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
