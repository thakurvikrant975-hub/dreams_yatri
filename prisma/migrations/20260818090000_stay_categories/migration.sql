-- Stay categories: Standard / Deluxe / Premium, all three shown in ONE document.
--
-- Each stay block in the itinerary lists every category's hotel side by side,
-- and the pricing block lists every category's price with the recommended one
-- highlighted. There is no per-category document and no per-category PDF.
--
-- The DROPs are for the dev database only. An earlier, reverted attempt at this
-- (star-rating tiers, one document per tier) left tables of the same names
-- behind there; they never reached any other database, so on production these
-- are no-ops. Recreated from scratch rather than altered, because a migration
-- that ALTERs a table production has never seen would fail there.
DROP TABLE IF EXISTS "custom_itinerary_stays";
DROP TABLE IF EXISTS "custom_package_stay_options";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "stayOptionId";
ALTER TABLE "bookings" DROP COLUMN IF EXISTS "stayOptionLabel";

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "StayCategory" AS ENUM ('STANDARD', 'DELUXE', 'PREMIUM');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE "custom_package_stay_options" (
    "id" TEXT NOT NULL,
    "customPackageId" TEXT NOT NULL,
    "category" "StayCategory" NOT NULL,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "pricePerPerson" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "pricingSnapshot" JSONB,
    "hotelSubtotalOverride" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_package_stay_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_itinerary_stays" (
    "id" TEXT NOT NULL,
    "itineraryId" TEXT NOT NULL,
    "stayOptionId" TEXT NOT NULL,
    "accommodation" TEXT,
    "accommodationPhoto" TEXT,
    "accommodationRoomPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accommodationLocation" TEXT,
    "accommodationRoomSpecs" TEXT,
    "accommodationStarRating" TEXT,
    "accommodationRoomCapacity" INTEGER,
    "accommodationMaxAdults" INTEGER,
    "accommodationMaxChildren" INTEGER,
    "accommodationExtraBedCapacity" INTEGER,
    "roomPricingId" INTEGER,
    "roomsCount" INTEGER,
    "extraRooms" JSONB,
    "hotelCheckIn" TEXT,
    "hotelCheckOut" TEXT,
    "hotelMealPlan" TEXT,
    "manualHotelPricePerNight" DOUBLE PRECISION,
    "manualExtraBeds" INTEGER,
    "manualExtraBedRate" DOUBLE PRECISION,
    "hotelPriceOverride" DOUBLE PRECISION,
    "hotelPending" BOOLEAN NOT NULL DEFAULT false,
    "hotelPendingNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_itinerary_stays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_package_stay_options_customPackageId_idx" ON "custom_package_stay_options"("customPackageId");
CREATE UNIQUE INDEX "custom_package_stay_options_customPackageId_category_key" ON "custom_package_stay_options"("customPackageId", "category");
CREATE INDEX "custom_itinerary_stays_stayOptionId_idx" ON "custom_itinerary_stays"("stayOptionId");
CREATE UNIQUE INDEX "custom_itinerary_stays_itineraryId_stayOptionId_key" ON "custom_itinerary_stays"("itineraryId", "stayOptionId");

-- AddForeignKey
ALTER TABLE "custom_package_stay_options" ADD CONSTRAINT "custom_package_stay_options_customPackageId_fkey" FOREIGN KEY ("customPackageId") REFERENCES "custom_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_itinerary_stays" ADD CONSTRAINT "custom_itinerary_stays_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "custom_itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "custom_itinerary_stays" ADD CONSTRAINT "custom_itinerary_stays_stayOptionId_fkey" FOREIGN KEY ("stayOptionId") REFERENCES "custom_package_stay_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: every existing package gets a Standard category, recommended, with
-- one stay row per day copied from the day's own hotel columns. That way a
-- package built before categories existed already has the one it is quoting,
-- and the document has something to put in its single column.
INSERT INTO "custom_package_stay_options" ("id", "customPackageId", "category", "isRecommended", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."id", 'STANDARD', true, NOW(), NOW()
FROM "custom_packages" p;

INSERT INTO "custom_itinerary_stays" (
    "id", "itineraryId", "stayOptionId",
    "accommodation", "accommodationPhoto", "accommodationRoomPhotos", "accommodationLocation",
    "accommodationRoomSpecs", "accommodationStarRating", "accommodationRoomCapacity",
    "accommodationMaxAdults", "accommodationMaxChildren", "accommodationExtraBedCapacity",
    "roomPricingId", "roomsCount", "extraRooms", "hotelCheckIn", "hotelCheckOut", "hotelMealPlan",
    "manualHotelPricePerNight", "manualExtraBeds", "manualExtraBedRate", "hotelPriceOverride",
    "hotelPending", "hotelPendingNote", "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, i."id", o."id",
    i."accommodation", i."accommodationPhoto", i."accommodationRoomPhotos", i."accommodationLocation",
    i."accommodationRoomSpecs", i."accommodationStarRating", i."accommodationRoomCapacity",
    i."accommodationMaxAdults", i."accommodationMaxChildren", i."accommodationExtraBedCapacity",
    i."roomPricingId", i."roomsCount", i."extraRooms", i."hotelCheckIn", i."hotelCheckOut", i."hotelMealPlan",
    i."manualHotelPricePerNight", i."manualExtraBeds", i."manualExtraBedRate", i."hotelPriceOverride",
    i."hotelPending", i."hotelPendingNote", NOW(), NOW()
FROM "custom_itineraries" i
JOIN "custom_package_stay_options" o ON o."customPackageId" = i."customPackageId";
