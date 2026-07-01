-- AlterTable: add max_adults and max_children to hotel_rooms
ALTER TABLE "hotel_rooms" ADD COLUMN "max_adults"   INTEGER NOT NULL DEFAULT 3;
ALTER TABLE "hotel_rooms" ADD COLUMN "max_children" INTEGER NOT NULL DEFAULT 2;
