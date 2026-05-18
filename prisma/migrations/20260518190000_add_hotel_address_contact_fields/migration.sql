-- Add structured address and contact fields to hotels
ALTER TABLE "hotels" ADD COLUMN "city"           TEXT;
ALTER TABLE "hotels" ADD COLUMN "state"          TEXT;
ALTER TABLE "hotels" ADD COLUMN "country"        TEXT;
ALTER TABLE "hotels" ADD COLUMN "pincode"        TEXT;
ALTER TABLE "hotels" ADD COLUMN "business_phone" TEXT;
ALTER TABLE "hotels" ADD COLUMN "business_email" TEXT;
