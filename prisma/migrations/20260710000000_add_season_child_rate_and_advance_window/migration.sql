-- AlterTable
ALTER TABLE "hotel_room_pricing_seasons" ADD COLUMN "extra_child_rate" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "hotel_room_availability" ADD COLUMN "min_advance_days" INTEGER;
ALTER TABLE "hotel_room_availability" ADD COLUMN "max_advance_days" INTEGER;
