-- Add location_id FK to hotels table
ALTER TABLE "hotels" ADD COLUMN IF NOT EXISTS "location_id" BIGINT;

CREATE INDEX IF NOT EXISTS "hotels_location_id_idx" ON "hotels"("location_id");

ALTER TABLE "hotels" ADD CONSTRAINT "hotels_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
