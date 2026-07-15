-- AlterTable: add color-coding to hotel room pricing seasons
ALTER TABLE "hotel_room_pricing_seasons" ADD COLUMN "color" TEXT;
-- AlterTable: add color-coding and an optional label to cab pricing seasons
ALTER TABLE "cab_pricing_seasons" ADD COLUMN "color" TEXT;
ALTER TABLE "cab_pricing_seasons" ADD COLUMN "season_name" TEXT;
