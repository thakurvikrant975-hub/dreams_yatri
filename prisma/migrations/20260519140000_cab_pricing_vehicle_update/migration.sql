-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID');

-- AlterTable vehicles: add has_ac, image_key, fuel_type
ALTER TABLE "vehicles" ADD COLUMN "has_ac" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "vehicles" ADD COLUMN "image_key" TEXT;
ALTER TABLE "vehicles" ADD COLUMN "fuel_type" "FuelType";

-- AlterTable itinerary_transfers: drop pricing columns
ALTER TABLE "itinerary_transfers" DROP COLUMN "cost_price";
ALTER TABLE "itinerary_transfers" DROP COLUMN "sell_price";

-- CreateTable package_cab_pricings
CREATE TABLE "package_cab_pricings" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "route_id" INTEGER NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "sell_price" DECIMAL(10,2) NOT NULL,
    "cost_price" DECIMAL(10,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "package_cab_pricings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "package_cab_pricings_route_id_vehicle_id_key" ON "package_cab_pricings"("route_id", "vehicle_id");

-- AddForeignKey
ALTER TABLE "package_cab_pricings" ADD CONSTRAINT "package_cab_pricings_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_cab_pricings" ADD CONSTRAINT "package_cab_pricings_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "package_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "package_cab_pricings" ADD CONSTRAINT "package_cab_pricings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
