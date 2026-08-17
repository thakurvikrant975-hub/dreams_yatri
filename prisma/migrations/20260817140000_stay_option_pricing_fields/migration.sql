-- Per-tier pricing needs three columns the first cut missed.
--
-- manualExtraBeds/manualExtraBedRate feed computeBuilderHotelPricing's line
-- math, so they are part of a stay, not of a day — a 4★ room sleeps a child
-- differently from a 2★ one. Leaving them shared would have priced every tier
-- off the default tier's extra beds.
--
-- hotelSubtotalOverride is costing's flat correction to a whole hotel subtotal.
-- With tiers reviewed one at a time it has to hang off the option; the
-- package-level column stays as the default tier's mirror.

-- AlterTable
ALTER TABLE "custom_itinerary_stays" ADD COLUMN "manualExtraBeds" INTEGER;
ALTER TABLE "custom_itinerary_stays" ADD COLUMN "manualExtraBedRate" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "custom_package_stay_options" ADD COLUMN "hotelSubtotalOverride" DOUBLE PRECISION;

-- Backfill from the rows these mirror. Every stay row today belongs to a
-- default option (see the previous migration's backfill), so this is a
-- straight copy off the day it hangs from.
UPDATE "custom_itinerary_stays" s
SET "manualExtraBeds"    = i."manualExtraBeds",
    "manualExtraBedRate" = i."manualExtraBedRate"
FROM "custom_itineraries" i
WHERE i."id" = s."itineraryId";

UPDATE "custom_package_stay_options" o
SET "hotelSubtotalOverride" = p."hotelSubtotalOverride"
FROM "custom_packages" p
WHERE p."id" = o."customPackageId" AND o."isDefault" = true;
