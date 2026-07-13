-- Corrects permit_vehicle_rates: the primary rate is a flat price per
-- vehicle (e.g. Rohtang Pass = Rs.4500 for an SUV); per-km is an optional
-- secondary rate for permits that instead scale with distance. Table is
-- empty (feature not yet used in production), so this is a safe rewrite.
ALTER TABLE "permit_vehicle_rates" ALTER COLUMN "price_per_km" DROP NOT NULL;
ALTER TABLE "permit_vehicle_rates" ADD COLUMN "price_per_vehicle" DECIMAL(10,2) NOT NULL;
