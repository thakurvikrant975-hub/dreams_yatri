/*
  Warnings:

  - You are about to drop the column `stay` on the `package_itineraries` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "package_itineraries" DROP COLUMN "stay",
ADD COLUMN     "activity_ids" JSONB,
ADD COLUMN     "hotel_id" INTEGER;

-- CreateIndex
CREATE INDEX "package_itineraries_hotel_id_idx" ON "package_itineraries"("hotel_id");

-- AddForeignKey
ALTER TABLE "package_itineraries" ADD CONSTRAINT "package_itineraries_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
