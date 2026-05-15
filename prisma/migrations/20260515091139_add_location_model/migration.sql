/*
  Warnings:

  - You are about to drop the `cities_all` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `countries_all` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `regions_all` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `states_all` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `subregions_all` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "LocationType" AS ENUM ('REGION', 'SUBREGION', 'COUNTRY', 'STATE', 'CITY', 'DISTRICT', 'AREA', 'NEIGHBORHOOD', 'VILLAGE', 'LANDMARK', 'AIRPORT', 'BEACH', 'MOUNTAIN', 'ISLAND', 'TOURISM_ZONE', 'BUS_STATION', 'TRAIN_STATION', 'PORT');

-- DropForeignKey
ALTER TABLE "cities_all" DROP CONSTRAINT "cities_all_country_id_fkey";

-- DropForeignKey
ALTER TABLE "cities_all" DROP CONSTRAINT "cities_all_state_id_fkey";

-- DropForeignKey
ALTER TABLE "countries_all" DROP CONSTRAINT "countries_all_region_id_fkey";

-- DropForeignKey
ALTER TABLE "countries_all" DROP CONSTRAINT "countries_all_subregion_id_fkey";

-- DropForeignKey
ALTER TABLE "states_all" DROP CONSTRAINT "states_all_country_id_fkey";

-- DropForeignKey
ALTER TABLE "subregions_all" DROP CONSTRAINT "subregions_all_region_id_fkey";

-- DropTable
DROP TABLE "cities_all";

-- DropTable
DROP TABLE "countries_all";

-- DropTable
DROP TABLE "regions_all";

-- DropTable
DROP TABLE "states_all";

-- DropTable
DROP TABLE "subregions_all";

-- CreateTable
CREATE TABLE "locations" (
    "id" BIGSERIAL NOT NULL,
    "parent_id" BIGINT,
    "type" "LocationType" NOT NULL,
    "name" TEXT NOT NULL,
    "official_name" TEXT,
    "slug" TEXT NOT NULL,
    "short_code" TEXT,
    "iso_code" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "elevation_meters" INTEGER,
    "timezone" TEXT,
    "population" INTEGER,
    "seo_title" TEXT,
    "seo_description" TEXT,
    "description" TEXT,
    "hero_image" TEXT,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "is_searchable" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "country_id" BIGINT,
    "state_id" BIGINT,
    "city_id" BIGINT,
    "geonames_id" INTEGER,
    "osm_id" TEXT,
    "mapbox_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "locations_slug_key" ON "locations"("slug");

-- CreateIndex
CREATE INDEX "locations_type_idx" ON "locations"("type");

-- CreateIndex
CREATE INDEX "locations_parent_id_idx" ON "locations"("parent_id");

-- CreateIndex
CREATE INDEX "locations_country_id_idx" ON "locations"("country_id");

-- CreateIndex
CREATE INDEX "locations_state_id_idx" ON "locations"("state_id");

-- CreateIndex
CREATE INDEX "locations_city_id_idx" ON "locations"("city_id");

-- CreateIndex
CREATE INDEX "locations_latitude_longitude_idx" ON "locations"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "locations_is_active_idx" ON "locations"("is_active");

-- CreateIndex
CREATE INDEX "locations_is_searchable_idx" ON "locations"("is_searchable");

-- CreateIndex
CREATE INDEX "locations_name_idx" ON "locations"("name");

-- CreateIndex
CREATE INDEX "locations_slug_idx" ON "locations"("slug");

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "locations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
