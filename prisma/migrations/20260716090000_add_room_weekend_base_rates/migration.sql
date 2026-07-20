-- AlterTable: add optional weekend overrides to the plan-level base rate
ALTER TABLE "hotel_room_pricing" ADD COLUMN "weekend_price_per_night" DECIMAL(10,2);
ALTER TABLE "hotel_room_pricing" ADD COLUMN "weekend_extra_bed_rate" DECIMAL(10,2);
