/*
  Warnings:

  - You are about to drop the `hotel_rooms` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "hotel_rooms" DROP CONSTRAINT "hotel_rooms_hotel_id_fkey";

-- DropTable
DROP TABLE "hotel_rooms";
