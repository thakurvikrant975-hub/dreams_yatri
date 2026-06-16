-- AlterTable: add bed_count and child_cot_available to hotel_rooms
ALTER TABLE "hotel_rooms" ADD COLUMN "bed_count" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "hotel_rooms" ADD COLUMN "child_cot_available" BOOLEAN NOT NULL DEFAULT false;
-- Change extra_bed_capacity default from 1 to 0 (off by default)
ALTER TABLE "hotel_rooms" ALTER COLUMN "extra_bed_capacity" SET DEFAULT 0;
