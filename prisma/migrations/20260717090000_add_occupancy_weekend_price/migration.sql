-- AlterTable: weekend override for base plan-level occupancy pricing (e.g. single occupancy)
ALTER TABLE "hotel_room_occupancy_prices" ADD COLUMN "weekend_price_per_night" DECIMAL(10,2);

-- AlterTable: weekend override for season-level occupancy pricing
ALTER TABLE "hotel_room_pricing_season_occupancy" ADD COLUMN "weekend_price_per_night" DECIMAL(10,2);
