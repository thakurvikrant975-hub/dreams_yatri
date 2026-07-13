-- Per-vehicle, per-km permit pricing — a permit like Rohtang Pass charges a
-- different rate per vehicle type (SUV/Sedan/Bus/etc.), so this replaces the
-- old single flat permits.price_per_vehicle for new records (those columns
-- are kept only for the older catalog-package pricing engine's compatibility).
CREATE TABLE "permit_vehicle_rates" (
    "id" SERIAL NOT NULL,
    "permit_id" INTEGER NOT NULL,
    "vehicle_id" INTEGER NOT NULL,
    "price_per_km" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permit_vehicle_rates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permit_vehicle_rates_permit_id_vehicle_id_key" ON "permit_vehicle_rates"("permit_id", "vehicle_id");
CREATE INDEX "permit_vehicle_rates_permit_id_idx" ON "permit_vehicle_rates"("permit_id");
CREATE INDEX "permit_vehicle_rates_vehicle_id_idx" ON "permit_vehicle_rates"("vehicle_id");

ALTER TABLE "permit_vehicle_rates" ADD CONSTRAINT "permit_vehicle_rates_permit_id_fkey" FOREIGN KEY ("permit_id") REFERENCES "permits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "permit_vehicle_rates" ADD CONSTRAINT "permit_vehicle_rates_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
