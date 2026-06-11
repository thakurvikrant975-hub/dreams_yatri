-- AlterTable: add property_amenities JSON column to hotels
ALTER TABLE "hotels" ADD COLUMN "property_amenities" JSONB;
