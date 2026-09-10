-- Configurable child/infant pricing weight per package. Purely additive:
-- existing rows default to 50% (child pays half) and 0% (infant travels
-- free), the common travel-industry convention, and are editable per
-- package thereafter on the Costing tab.

-- AlterTable
ALTER TABLE "custom_packages"
    ADD COLUMN "childPricingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 50,
    ADD COLUMN "infantPricingPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0;
