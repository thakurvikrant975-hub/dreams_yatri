-- Destination-level cab pricing: price per vehicle type, with optional season overrides

-- Enum
DO $$ BEGIN
  CREATE TYPE "CabPricingType" AS ENUM ('PER_DAY', 'PER_KM');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Base pricing per destination × vehicle
CREATE TABLE IF NOT EXISTS "cab_pricings" (
    "id"             SERIAL          NOT NULL,
    "destination_id" INTEGER         NOT NULL,
    "vehicle_id"     INTEGER         NOT NULL,
    "cost_price"     DECIMAL(10,2),
    "is_active"      BOOLEAN         NOT NULL DEFAULT true,
    "created_at"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "price"          DECIMAL(10,2)   NOT NULL,
    "pricing_type"   "CabPricingType" NOT NULL DEFAULT 'PER_DAY',
    "updated_by"     TEXT,
    CONSTRAINT "cab_pricings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cab_pricings_destination_id_vehicle_id_key" ON "cab_pricings"("destination_id", "vehicle_id");
CREATE INDEX        IF NOT EXISTS "cab_pricings_destination_id_idx"              ON "cab_pricings"("destination_id");
CREATE INDEX        IF NOT EXISTS "cab_pricings_vehicle_id_idx"                  ON "cab_pricings"("vehicle_id");

DO $$ BEGIN
  ALTER TABLE "cab_pricings" ADD CONSTRAINT "cab_pricings_destination_id_fkey"
    FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "cab_pricings" ADD CONSTRAINT "cab_pricings_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seasonal overrides for a pricing entry
CREATE TABLE IF NOT EXISTS "cab_pricing_seasons" (
    "id"            SERIAL           NOT NULL,
    "pricing_id"    INTEGER          NOT NULL,
    "pricing_type"  "CabPricingType" NOT NULL DEFAULT 'PER_DAY',
    "valid_from"    TIMESTAMP(3)     NOT NULL,
    "valid_to"      TIMESTAMP(3)     NOT NULL,
    "weekday_price" DECIMAL(10,2)    NOT NULL,
    "weekday_cost"  DECIMAL(10,2),
    "weekend_price" DECIMAL(10,2),
    "weekend_cost"  DECIMAL(10,2),
    "is_active"     BOOLEAN          NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cab_pricing_seasons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cab_pricing_seasons_pricing_id_idx" ON "cab_pricing_seasons"("pricing_id");

DO $$ BEGIN
  ALTER TABLE "cab_pricing_seasons" ADD CONSTRAINT "cab_pricing_seasons_pricing_id_fkey"
    FOREIGN KEY ("pricing_id") REFERENCES "cab_pricings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Per-package, per-duration vehicle slots (links a package to a pricing row)
CREATE TABLE IF NOT EXISTS "package_cab_types" (
    "id"          SERIAL       NOT NULL,
    "package_id"  INTEGER      NOT NULL,
    "duration_id" INTEGER      NOT NULL,
    "vehicle_id"  INTEGER      NOT NULL,
    "label"       TEXT,
    "note"        TEXT,
    "is_default"  BOOLEAN      NOT NULL DEFAULT false,
    "is_active"   BOOLEAN      NOT NULL DEFAULT true,
    "sort_order"  INTEGER      NOT NULL DEFAULT 0,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "package_cab_types_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "package_cab_types_package_id_duration_id_vehicle_id_key"
    ON "package_cab_types"("package_id", "duration_id", "vehicle_id");
CREATE INDEX IF NOT EXISTS "package_cab_types_package_id_duration_id_idx"
    ON "package_cab_types"("package_id", "duration_id");

DO $$ BEGIN
  ALTER TABLE "package_cab_types" ADD CONSTRAINT "package_cab_types_duration_id_fkey"
    FOREIGN KEY ("duration_id") REFERENCES "package_durations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "package_cab_types" ADD CONSTRAINT "package_cab_types_package_id_fkey"
    FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "package_cab_types" ADD CONSTRAINT "package_cab_types_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Day-range segments tying a cab slot to a specific pricing row
CREATE TABLE IF NOT EXISTS "package_cab_segments" (
    "id"             SERIAL   NOT NULL,
    "cab_type_id"    INTEGER  NOT NULL,
    "day_from"       INTEGER  NOT NULL,
    "day_to"         INTEGER  NOT NULL,
    "cab_pricing_id" INTEGER  NOT NULL,
    "sort_order"     INTEGER  NOT NULL DEFAULT 0,
    CONSTRAINT "package_cab_segments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "package_cab_segments_cab_type_id_idx" ON "package_cab_segments"("cab_type_id");

DO $$ BEGIN
  ALTER TABLE "package_cab_segments" ADD CONSTRAINT "package_cab_segments_cab_pricing_id_fkey"
    FOREIGN KEY ("cab_pricing_id") REFERENCES "cab_pricings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "package_cab_segments" ADD CONSTRAINT "package_cab_segments_cab_type_id_fkey"
    FOREIGN KEY ("cab_type_id") REFERENCES "package_cab_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
