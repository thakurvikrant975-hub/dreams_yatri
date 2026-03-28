/*
  Warnings:

  - You are about to drop the `activity_pricing` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "activity_pricing" DROP CONSTRAINT "activity_pricing_activity_id_fkey";

-- AlterTable
ALTER TABLE "activities" ADD COLUMN     "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "max_persons" INTEGER,
ADD COLUMN     "min_persons" INTEGER,
ADD COLUMN     "original_price" DECIMAL(10,2),
ADD COLUMN     "pricing_type" TEXT;

-- DropTable
DROP TABLE "activity_pricing";
