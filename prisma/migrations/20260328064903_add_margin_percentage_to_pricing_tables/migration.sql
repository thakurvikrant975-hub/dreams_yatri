-- AlterTable
ALTER TABLE "activity_pricing" ADD COLUMN     "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "hotel_room_pricing" ADD COLUMN     "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 10;
