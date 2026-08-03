-- Per-day hotel/cab price corrections made by costing during package review,
-- replacing the whole-package lump hotelSubtotalOverride/cabSubtotalOverride.
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelPriceOverride" DOUBLE PRECISION;
ALTER TABLE "custom_itineraries" ADD COLUMN "cabPriceOverride" DOUBLE PRECISION;
