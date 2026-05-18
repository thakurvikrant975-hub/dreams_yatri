-- Remove star_rating column (stay_type replaces it)
ALTER TABLE "hotels" DROP COLUMN IF EXISTS "star_rating";

-- Clean up stay_type values: remove embedded star counts from existing data
UPDATE "hotels" SET "stay_type" = 'Deluxe'       WHERE "stay_type" = 'Deluxe 2*';
UPDATE "hotels" SET "stay_type" = 'Super Deluxe'  WHERE "stay_type" = 'Super Deluxe 3*';
UPDATE "hotels" SET "stay_type" = 'Luxury'        WHERE "stay_type" = 'Luxury 4*';
UPDATE "hotels" SET "stay_type" = 'Super Luxury'  WHERE "stay_type" = 'Super Luxury 5*';
