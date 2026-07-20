-- AlterTable
ALTER TABLE "hotel_review" ADD COLUMN     "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
