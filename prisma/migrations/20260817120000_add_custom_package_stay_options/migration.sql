-- Multiple stay tiers per custom package (2★/3★/4★), so a sales exec can quote
-- options side by side and the client picks one.
--
-- Only hotels vary between options, so this adds the (day × tier) cell and the
-- tier itself. The matching columns already on custom_itineraries stay put and
-- now mirror the DEFAULT option's stay — everything not yet taught about tiers
-- keeps reading them unchanged. Backfill below gives every existing package
-- exactly one option, so nothing is left without a default.

-- CreateTable
CREATE TABLE "custom_package_stay_options" (
    "id" TEXT NOT NULL,
    "customPackageId" TEXT NOT NULL,
    "starRating" INTEGER NOT NULL,
    "label" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pricePerPerson" DOUBLE PRECISION,
    "totalPrice" DOUBLE PRECISION,
    "pricingSnapshot" JSONB,
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
    "hotelPriceOverride" DOUBLE PRECISION,
    "hotelPending" BOOLEAN NOT NULL DEFAULT false,
    "hotelPendingNote" TEXT,
    "hotelRequestType" TEXT,
    "hotelRequestedAt" TIMESTAMP(3),
    "hotelFilledAt" TIMESTAMP(3),
    "hotelFilledById" TEXT,
    "hotelFilledByName" TEXT,
    "hotelFillNote" TEXT,
    "hotelFillNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_itinerary_stays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_package_stay_options_customPackageId_idx" ON "custom_package_stay_options"("customPackageId");

-- CreateIndex
CREATE UNIQUE INDEX "custom_package_stay_options_customPackageId_starRating_key" ON "custom_package_stay_options"("customPackageId", "starRating");

-- CreateIndex
CREATE INDEX "custom_itinerary_stays_stayOptionId_idx" ON "custom_itinerary_stays"("stayOptionId");

-- CreateIndex
CREATE INDEX "custom_itinerary_stays_hotelPending_idx" ON "custom_itinerary_stays"("hotelPending");

-- CreateIndex
CREATE UNIQUE INDEX "custom_itinerary_stays_itineraryId_stayOptionId_key" ON "custom_itinerary_stays"("itineraryId", "stayOptionId");

-- AddForeignKey
ALTER TABLE "custom_package_stay_options" ADD CONSTRAINT "custom_package_stay_options_customPackageId_fkey" FOREIGN KEY ("customPackageId") REFERENCES "custom_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_itinerary_stays" ADD CONSTRAINT "custom_itinerary_stays_itineraryId_fkey" FOREIGN KEY ("itineraryId") REFERENCES "custom_itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_itinerary_stays" ADD CONSTRAINT "custom_itinerary_stays_stayOptionId_fkey" FOREIGN KEY ("stayOptionId") REFERENCES "custom_package_stay_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Backfill ────────────────────────────────────────────────────────────────
-- Every existing package gets one default option, so "the default option's
-- stay" is a safe assumption everywhere from the first read onwards. The star
-- rating is taken from whatever the days actually say (accommodationStarRating
-- is free text — "4", "4 Star", "4.5" — so pull the leading digit), falling
-- back to 3 when nothing is recorded or it doesn't parse.
INSERT INTO "custom_package_stay_options"
    ("id", "customPackageId", "starRating", "isDefault", "sortOrder", "pricePerPerson", "totalPrice", "pricingSnapshot", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    p."id",
    COALESCE((
        SELECT GREATEST(2, LEAST(5, FLOOR(NULLIF(SUBSTRING(i."accommodationStarRating" FROM '\d+'), '')::numeric)::int))
        FROM "custom_itineraries" i
        WHERE i."customPackageId" = p."id"
          AND i."accommodationStarRating" IS NOT NULL
          AND SUBSTRING(i."accommodationStarRating" FROM '\d+') <> ''
        ORDER BY i."day" ASC
        LIMIT 1
    ), 3),
    true,
    0,
    p."pricePerPerson",
    p."totalPrice",
    p."pricingSnapshot",
    NOW(),
    NOW()
FROM "custom_packages" p;

-- One stay row per (day, default option), copied from the day's own columns.
INSERT INTO "custom_itinerary_stays" (
    "id", "itineraryId", "stayOptionId",
    "accommodation", "accommodationPhoto", "accommodationRoomPhotos", "accommodationLocation",
    "accommodationRoomSpecs", "accommodationStarRating", "accommodationRoomCapacity",
    "accommodationMaxAdults", "accommodationMaxChildren", "accommodationExtraBedCapacity",
    "roomPricingId", "roomsCount", "extraRooms", "hotelCheckIn", "hotelCheckOut", "hotelMealPlan",
    "manualHotelPricePerNight", "hotelPriceOverride",
    "hotelPending", "hotelPendingNote", "hotelRequestType", "hotelRequestedAt",
    "hotelFilledAt", "hotelFilledById", "hotelFilledByName", "hotelFillNote", "hotelFillNotifiedAt",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, i."id", o."id",
    i."accommodation", i."accommodationPhoto", i."accommodationRoomPhotos", i."accommodationLocation",
    i."accommodationRoomSpecs", i."accommodationStarRating", i."accommodationRoomCapacity",
    i."accommodationMaxAdults", i."accommodationMaxChildren", i."accommodationExtraBedCapacity",
    i."roomPricingId", i."roomsCount", i."extraRooms", i."hotelCheckIn", i."hotelCheckOut", i."hotelMealPlan",
    i."manualHotelPricePerNight", i."hotelPriceOverride",
    i."hotelPending", i."hotelPendingNote", i."hotelRequestType", i."hotelRequestedAt",
    i."hotelFilledAt", i."hotelFilledById", i."hotelFilledByName", i."hotelFillNote", i."hotelFillNotifiedAt",
    NOW(), NOW()
FROM "custom_itineraries" i
JOIN "custom_package_stay_options" o
  ON o."customPackageId" = i."customPackageId" AND o."isDefault" = true;
