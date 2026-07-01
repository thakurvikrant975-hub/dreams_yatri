-- Sync schema drift: apply all changes present in schema.prisma but missing from DB

-- AlterEnum
ALTER TYPE "LocationType" ADD VALUE 'ROUTE_STOP';

-- DropForeignKey
ALTER TABLE "hotel_addon_seasons" DROP CONSTRAINT "hotel_addon_seasons_addon_id_fkey";

-- DropForeignKey
ALTER TABLE "hotel_addons" DROP CONSTRAINT "hotel_addons_hotel_id_fkey";

-- DropForeignKey
ALTER TABLE "package_cab_pricings" DROP CONSTRAINT "package_cab_pricings_package_id_fkey";

-- DropForeignKey
ALTER TABLE "package_cab_pricings" DROP CONSTRAINT "package_cab_pricings_route_id_fkey";

-- DropForeignKey
ALTER TABLE "package_cab_pricings" DROP CONSTRAINT "package_cab_pricings_vehicle_id_fkey";

-- DropIndex
DROP INDEX "package_gallery_package_id_position_key";

-- AlterTable: add whatsapp to User (fixes Google OAuth user.create() P2022)
ALTER TABLE "User" ADD COLUMN     "whatsapp" TEXT;

-- AlterTable
ALTER TABLE "activities" DROP COLUMN "latitude",
DROP COLUMN "longitude",
ALTER COLUMN "included_meals" DROP DEFAULT;

-- AlterTable
ALTER TABLE "activity_categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cab_drivers" DROP COLUMN "created_by",
ALTER COLUMN "vehicle_image_keys" DROP DEFAULT,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cab_pricing_seasons" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "cab_pricings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hotel_addon_seasons" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hotel_addons" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hotel_meal_pricing_seasons" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hotel_meal_pricings" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hotel_room_pricing_seasons" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "hotel_rooms" ALTER COLUMN "max_occupancy" SET DEFAULT 2;

-- AlterTable
ALTER TABLE "hotels" DROP COLUMN "created_by",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "updated_by";

-- AlterTable
ALTER TABLE "itinerary_stays" ADD COLUMN     "active_meals" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "meal_types" ALTER COLUMN "covered_meals" DROP DEFAULT;

-- AlterTable
ALTER TABLE "package_cab_types" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "package_gallery" ADD COLUMN     "route_id" INTEGER;

-- AlterTable
ALTER TABLE "package_itineraries" ADD COLUMN     "excluded_meals" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "meals" TEXT[];

-- AlterTable
ALTER TABLE "package_quote" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "route_stops" DROP COLUMN "address",
DROP COLUMN "latitude",
DROP COLUMN "longitude",
DROP COLUMN "place_id",
ADD COLUMN     "location_id" BIGINT;

-- AlterTable
ALTER TABLE "transfer_routes" ADD COLUMN     "drop_location_id" BIGINT,
ADD COLUMN     "pickup_location_id" BIGINT;

-- AlterTable
ALTER TABLE "vehicles" DROP COLUMN "created_by";

-- DropTable
DROP TABLE "package_cab_pricings";

-- CreateTable
CREATE TABLE "pending_contact_verifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_contact_verifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_variant_seasons" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "season_name" TEXT NOT NULL,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "weekend_price" DECIMAL(10,2),

    CONSTRAINT "activity_variant_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_variant_season_pricing" (
    "id" SERIAL NOT NULL,
    "season_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "age_from" INTEGER,
    "age_to" INTEGER,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "activity_variant_season_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pending_contact_verifications_token_key" ON "pending_contact_verifications"("token");

-- CreateIndex
CREATE INDEX "pending_contact_verifications_userId_idx" ON "pending_contact_verifications"("userId");

-- CreateIndex
CREATE INDEX "activity_variant_seasons_variant_id_idx" ON "activity_variant_seasons"("variant_id");

-- CreateIndex
CREATE INDEX "activity_variant_season_pricing_season_id_idx" ON "activity_variant_season_pricing"("season_id");

-- CreateIndex
CREATE UNIQUE INDEX "User_whatsapp_key" ON "User"("whatsapp");

-- CreateIndex
CREATE INDEX "package_gallery_route_id_idx" ON "package_gallery"("route_id");

-- CreateIndex
CREATE INDEX "route_stops_location_id_idx" ON "route_stops"("location_id");

-- CreateIndex
CREATE INDEX "transfer_routes_pickup_location_id_drop_location_id_idx" ON "transfer_routes"("pickup_location_id", "drop_location_id");

-- AddForeignKey
ALTER TABLE "hotel_addons" ADD CONSTRAINT "hotel_addons_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_addon_seasons" ADD CONSTRAINT "hotel_addon_seasons_addon_id_fkey" FOREIGN KEY ("addon_id") REFERENCES "hotel_addons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_variant_seasons" ADD CONSTRAINT "activity_variant_seasons_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "activity_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_variant_season_pricing" ADD CONSTRAINT "activity_variant_season_pricing_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "activity_variant_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_drop_location_id_fkey" FOREIGN KEY ("drop_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfer_routes" ADD CONSTRAINT "transfer_routes_pickup_location_id_fkey" FOREIGN KEY ("pickup_location_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_gallery" ADD CONSTRAINT "package_gallery_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "package_routes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
