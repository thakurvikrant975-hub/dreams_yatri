-- AlterTable: add max_adults and max_children to hotel_rooms
ALTER TABLE "hotel_rooms" ADD COLUMN "max_adults"   INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "hotel_rooms" ADD COLUMN "max_children" INTEGER NOT NULL DEFAULT 2;

-- Seed max_adults from existing data: base beds + extra beds
UPDATE "hotel_rooms"
SET max_adults = max_occupancy + extra_bed_capacity;
