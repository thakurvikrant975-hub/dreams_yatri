/*
  Warnings:

  - A unique constraint covering the columns `[package_id,slug]` on the table `package_stay_categories` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `slug` to the `package_stay_categories` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "hotel_room_pricing" ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "package_stay_categories" ADD COLUMN     "slug" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "packages" ADD COLUMN     "meta_desc" TEXT,
ADD COLUMN     "meta_title" TEXT;

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(8,2) NOT NULL,
    "applies_to" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "images" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "original_url" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "blur_url" TEXT NOT NULL,
    "blur_base64" TEXT NOT NULL,
    "original_key" TEXT NOT NULL,
    "thumbnail_key" TEXT NOT NULL,
    "blur_key" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "original_size" INTEGER NOT NULL,
    "aspect_ratio" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pricing_rules_applies_to_is_active_idx" ON "pricing_rules"("applies_to", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "images_uuid_key" ON "images"("uuid");

-- CreateIndex
CREATE INDEX "images_folder_idx" ON "images"("folder");

-- CreateIndex
CREATE UNIQUE INDEX "package_stay_categories_package_id_slug_key" ON "package_stay_categories"("package_id", "slug");
