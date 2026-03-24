/*
  Warnings:

  - You are about to drop the column `itinerary` on the `package_itineraries` table. All the data in the column will be lost.
  - You are about to drop the column `variant_id` on the `package_itineraries` table. All the data in the column will be lost.
  - You are about to drop the column `base_destination_id` on the `packages` table. All the data in the column will be lost.
  - You are about to drop the `package_variants` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `updated_at` to the `destinations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `activities` to the `package_itineraries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `day` to the `package_itineraries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `duration_id` to the `package_itineraries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `package_id` to the `package_itineraries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `package_itineraries` table without a default value. This is not possible if the table is not empty.
  - Added the required column `destination_id` to the `packages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `regions` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "package_itineraries" DROP CONSTRAINT "package_itineraries_variant_id_fkey";

-- DropForeignKey
ALTER TABLE "package_variants" DROP CONSTRAINT "package_variants_package_id_fkey";

-- DropForeignKey
ALTER TABLE "packages" DROP CONSTRAINT "packages_base_destination_id_fkey";

-- AlterTable
ALTER TABLE "destinations" ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "meta_desc" TEXT,
ADD COLUMN     "meta_title" TEXT,
ADD COLUMN     "thumbnail" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "package_itineraries" DROP COLUMN "itinerary",
DROP COLUMN "variant_id",
ADD COLUMN     "activities" JSONB NOT NULL,
ADD COLUMN     "day" INTEGER NOT NULL,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "duration_id" INTEGER NOT NULL,
ADD COLUMN     "meals" JSONB,
ADD COLUMN     "package_id" INTEGER NOT NULL,
ADD COLUMN     "route_index" INTEGER,
ADD COLUMN     "stay" TEXT,
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "packages" DROP COLUMN "base_destination_id",
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "destination_id" INTEGER NOT NULL,
ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "regions" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'India',
ADD COLUMN     "cover_image" TEXT,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "is_active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "meta_desc" TEXT,
ADD COLUMN     "meta_title" TEXT,
ADD COLUMN     "thumbnail" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- DropTable
DROP TABLE "package_variants";

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "group" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_images" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "blur_base64" TEXT,
    "alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_durations" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "nights" INTEGER NOT NULL,
    "routes" JSONB NOT NULL,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_durations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_stay_categories" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "min_duration_days" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "package_stay_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_pricing" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "duration_id" INTEGER NOT NULL,
    "route_index" INTEGER NOT NULL,
    "stay_category_id" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "package_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_tags" (
    "package_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "package_tags_pkey" PRIMARY KEY ("package_id","tag_id")
);

-- CreateTable
CREATE TABLE "package_categories" (
    "package_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "package_categories_pkey" PRIMARY KEY ("package_id","category_id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "destination_id" INTEGER NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "star_rating" INTEGER,
    "category" TEXT,
    "amenities" JSONB,
    "check_in_time" TEXT,
    "check_out_time" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_images" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "blur_base64" TEXT,
    "alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_rooms" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "amenities" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_hotels" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "stay_category_id" INTEGER NOT NULL,
    "night_number" INTEGER,
    "is_recommended" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "package_hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "destination_id" INTEGER NOT NULL,
    "duration_hours" DECIMAL(4,1),
    "difficulty" TEXT,
    "category" TEXT,
    "price" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_images" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "blur_base64" TEXT,
    "alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_activities" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "duration_id" INTEGER NOT NULL,
    "day_number" INTEGER NOT NULL,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,
    "extra_price" DECIMAL(10,2),

    CONSTRAINT "package_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_group_idx" ON "tags"("group");

-- CreateIndex
CREATE INDEX "tags_slug_idx" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "package_images_package_id_idx" ON "package_images"("package_id");

-- CreateIndex
CREATE INDEX "package_durations_package_id_is_active_idx" ON "package_durations"("package_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "package_durations_package_id_slug_key" ON "package_durations"("package_id", "slug");

-- CreateIndex
CREATE INDEX "package_stay_categories_package_id_is_active_idx" ON "package_stay_categories"("package_id", "is_active");

-- CreateIndex
CREATE INDEX "package_pricing_package_id_duration_id_is_active_idx" ON "package_pricing"("package_id", "duration_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "package_pricing_package_id_duration_id_route_index_stay_cat_key" ON "package_pricing"("package_id", "duration_id", "route_index", "stay_category_id");

-- CreateIndex
CREATE INDEX "package_tags_tag_id_idx" ON "package_tags"("tag_id");

-- CreateIndex
CREATE INDEX "package_categories_category_id_idx" ON "package_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotels_slug_key" ON "hotels"("slug");

-- CreateIndex
CREATE INDEX "hotels_destination_id_is_active_idx" ON "hotels"("destination_id", "is_active");

-- CreateIndex
CREATE INDEX "hotels_slug_idx" ON "hotels"("slug");

-- CreateIndex
CREATE INDEX "hotel_images_hotel_id_idx" ON "hotel_images"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_rooms_hotel_id_idx" ON "hotel_rooms"("hotel_id");

-- CreateIndex
CREATE INDEX "package_hotels_package_id_stay_category_id_idx" ON "package_hotels"("package_id", "stay_category_id");

-- CreateIndex
CREATE INDEX "package_hotels_hotel_id_idx" ON "package_hotels"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "activities_slug_key" ON "activities"("slug");

-- CreateIndex
CREATE INDEX "activities_destination_id_is_active_idx" ON "activities"("destination_id", "is_active");

-- CreateIndex
CREATE INDEX "activities_category_idx" ON "activities"("category");

-- CreateIndex
CREATE INDEX "activities_slug_idx" ON "activities"("slug");

-- CreateIndex
CREATE INDEX "activity_images_activity_id_idx" ON "activity_images"("activity_id");

-- CreateIndex
CREATE INDEX "package_activities_package_id_duration_id_idx" ON "package_activities"("package_id", "duration_id");

-- CreateIndex
CREATE INDEX "package_activities_activity_id_idx" ON "package_activities"("activity_id");

-- CreateIndex
CREATE INDEX "destinations_region_id_idx" ON "destinations"("region_id");

-- CreateIndex
CREATE INDEX "destinations_slug_idx" ON "destinations"("slug");

-- CreateIndex
CREATE INDEX "package_itineraries_package_id_duration_id_idx" ON "package_itineraries"("package_id", "duration_id");

-- CreateIndex
CREATE INDEX "packages_destination_id_is_active_idx" ON "packages"("destination_id", "is_active");

-- CreateIndex
CREATE INDEX "packages_slug_idx" ON "packages"("slug");

-- CreateIndex
CREATE INDEX "regions_slug_idx" ON "regions"("slug");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_images" ADD CONSTRAINT "package_images_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_durations" ADD CONSTRAINT "package_durations_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_stay_categories" ADD CONSTRAINT "package_stay_categories_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_pricing" ADD CONSTRAINT "package_pricing_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_pricing" ADD CONSTRAINT "package_pricing_duration_id_fkey" FOREIGN KEY ("duration_id") REFERENCES "package_durations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_pricing" ADD CONSTRAINT "package_pricing_stay_category_id_fkey" FOREIGN KEY ("stay_category_id") REFERENCES "package_stay_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_itineraries" ADD CONSTRAINT "package_itineraries_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_itineraries" ADD CONSTRAINT "package_itineraries_duration_id_fkey" FOREIGN KEY ("duration_id") REFERENCES "package_durations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_tags" ADD CONSTRAINT "package_tags_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_tags" ADD CONSTRAINT "package_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_categories" ADD CONSTRAINT "package_categories_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_categories" ADD CONSTRAINT "package_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_images" ADD CONSTRAINT "hotel_images_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_hotels" ADD CONSTRAINT "package_hotels_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_hotels" ADD CONSTRAINT "package_hotels_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_hotels" ADD CONSTRAINT "package_hotels_stay_category_id_fkey" FOREIGN KEY ("stay_category_id") REFERENCES "package_stay_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_images" ADD CONSTRAINT "activity_images_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_activities" ADD CONSTRAINT "package_activities_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_activities" ADD CONSTRAINT "package_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
