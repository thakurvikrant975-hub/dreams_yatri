/*
  Warnings:

  - You are about to drop the column `cab_type` on the `itinerary_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `drop_point` on the `itinerary_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `duration_text` on the `itinerary_transfers` table. All the data in the column will be lost.
  - You are about to drop the column `pickup_point` on the `itinerary_transfers` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('HATCHBACK', 'SEDAN', 'SUV', 'LUXURY_SEDAN', 'LUXURY_SUV', 'TEMPO_TRAVELLER', 'MINI_BUS', 'BUS');

-- CreateEnum
CREATE TYPE "VehicleRateType" AS ENUM ('PER_KM', 'FLAT_TRIP', 'PER_DAY');

-- AlterTable
ALTER TABLE "itinerary_transfers" DROP COLUMN "cab_type",
DROP COLUMN "drop_point",
DROP COLUMN "duration_text",
DROP COLUMN "pickup_point",
ADD COLUMN     "cost_price" DECIMAL(10,2),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "num_vehicles" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "route_id" INTEGER,
ADD COLUMN     "sell_price" DECIMAL(10,2),
ADD COLUMN     "vehicle_id" INTEGER;

-- CreateTable
CREATE TABLE "vehicles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "VehicleType" NOT NULL,
    "passenger_capacity" INTEGER NOT NULL,
    "luggage_bags" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_rates" (
    "id" SERIAL NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "rate_type" "VehicleRateType" NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "cost_price" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "vehicle_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transfer_routes" (
    "id" SERIAL NOT NULL,
    "pickup_name" TEXT NOT NULL,
    "pickup_place_id" TEXT,
    "pickup_lat" DECIMAL(10,7),
    "pickup_lng" DECIMAL(10,7),
    "drop_name" TEXT NOT NULL,
    "drop_place_id" TEXT,
    "drop_lat" DECIMAL(10,7),
    "drop_lng" DECIMAL(10,7),
    "distance_km" DECIMAL(8,2),
    "duration_min" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transfer_routes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicle_rates_vehicle_id_is_active_idx" ON "vehicle_rates"("vehicle_id", "is_active");

-- CreateIndex
CREATE INDEX "transfer_routes_pickup_name_drop_name_idx" ON "transfer_routes"("pickup_name", "drop_name");

-- AddForeignKey
ALTER TABLE "vehicle_rates" ADD CONSTRAINT "vehicle_rates_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_transfers" ADD CONSTRAINT "itinerary_transfers_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "transfer_routes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_transfers" ADD CONSTRAINT "itinerary_transfers_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
