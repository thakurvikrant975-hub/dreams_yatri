-- AlterTable: add a per-season weekend override for the extra bed rate
ALTER TABLE "hotel_room_pricing_seasons" ADD COLUMN "weekend_extra_bed_rate" DECIMAL(10,2);
