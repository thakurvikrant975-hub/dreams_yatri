/*
  Warnings:

  - Added the required column `category_id` to the `hotel_images` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "hotel_images" ADD COLUMN     "category_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "thumbnail" TEXT;

-- CreateTable
CREATE TABLE "hotel_image_categories" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "room_pricing_id" INTEGER,
    "name" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hotel_image_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_image_categories_hotel_id_idx" ON "hotel_image_categories"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_image_categories_room_pricing_id_idx" ON "hotel_image_categories"("room_pricing_id");

-- CreateIndex
CREATE INDEX "hotel_images_category_id_idx" ON "hotel_images"("category_id");

-- AddForeignKey
ALTER TABLE "hotel_image_categories" ADD CONSTRAINT "hotel_image_categories_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_image_categories" ADD CONSTRAINT "hotel_image_categories_room_pricing_id_fkey" FOREIGN KEY ("room_pricing_id") REFERENCES "hotel_room_pricing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_images" ADD CONSTRAINT "hotel_images_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "hotel_image_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
