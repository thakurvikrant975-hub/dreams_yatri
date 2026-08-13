-- Costing's discount off the final price.
--
-- Additive and nullable: a package with no discount has discountType NULL and
-- prices exactly as before, so applying this changes nothing that exists.
--
-- Type + value rather than a stored amount, so a percentage stays a percentage
-- when the itinerary changes underneath it — a "10% off" frozen into a rupee
-- figure on first save would drift the moment a day was added.
CREATE TYPE "DiscountType" AS ENUM ('FLAT', 'PERCENT');

ALTER TABLE "custom_packages" ADD COLUMN "discountType"  "DiscountType";
ALTER TABLE "custom_packages" ADD COLUMN "discountValue" DOUBLE PRECISION;
ALTER TABLE "custom_packages" ADD COLUMN "discountNote"  TEXT;
