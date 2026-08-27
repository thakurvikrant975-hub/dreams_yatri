-- AlterTable
ALTER TABLE "custom_itineraries" ADD COLUMN "extraMeals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
