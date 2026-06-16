-- Seasonal rate overrides for a hotel room pricing plan
CREATE TABLE IF NOT EXISTS "hotel_room_pricing_seasons" (
    "id"                      SERIAL          NOT NULL,
    "pricing_id"              INTEGER         NOT NULL,
    "season_name"             TEXT            NOT NULL,
    "valid_from"              TIMESTAMP(3)    NOT NULL,
    "valid_to"                TIMESTAMP(3)    NOT NULL,
    "price_per_night"         DECIMAL(10,2)   NOT NULL,
    "original_price"          DECIMAL(10,2),
    "is_active"               BOOLEAN         NOT NULL DEFAULT true,
    "sort_order"              INTEGER         NOT NULL DEFAULT 0,
    "created_at"              TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extra_bed_rate"          DECIMAL(10,2),
    "weekend_price_per_night" DECIMAL(10,2),
    CONSTRAINT "hotel_room_pricing_seasons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "hotel_room_pricing_seasons_pricing_id_idx" ON "hotel_room_pricing_seasons"("pricing_id");

DO $$ BEGIN
  ALTER TABLE "hotel_room_pricing_seasons" ADD CONSTRAINT "hotel_room_pricing_seasons_pricing_id_fkey"
    FOREIGN KEY ("pricing_id") REFERENCES "hotel_room_pricing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Per-occupancy prices within a seasonal band
CREATE TABLE IF NOT EXISTS "hotel_room_pricing_season_occupancy" (
    "id"              SERIAL        NOT NULL,
    "season_id"       INTEGER       NOT NULL,
    "occupancy"       INTEGER       NOT NULL,
    "price_per_night" DECIMAL(10,2) NOT NULL,
    "original_price"  DECIMAL(10,2),
    CONSTRAINT "hotel_room_pricing_season_occupancy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hotel_room_pricing_season_occupancy_season_id_occupancy_key"
    ON "hotel_room_pricing_season_occupancy"("season_id", "occupancy");
CREATE INDEX IF NOT EXISTS "hotel_room_pricing_season_occupancy_season_id_idx"
    ON "hotel_room_pricing_season_occupancy"("season_id");

DO $$ BEGIN
  ALTER TABLE "hotel_room_pricing_season_occupancy" ADD CONSTRAINT "hotel_room_pricing_season_occupancy_season_id_fkey"
    FOREIGN KEY ("season_id") REFERENCES "hotel_room_pricing_seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- À-la-carte meal pricing for a hotel
CREATE TABLE IF NOT EXISTS "hotel_meal_pricings" (
    "id"            SERIAL          NOT NULL,
    "hotel_id"      INTEGER         NOT NULL,
    "meal_type"     TEXT            NOT NULL,
    "label"         TEXT            NOT NULL,
    "price"         DECIMAL(10,2)   NOT NULL,
    "weekend_price" DECIMAL(10,2),
    "is_active"     BOOLEAN         NOT NULL DEFAULT true,
    "sort_order"    INTEGER         NOT NULL DEFAULT 0,
    "created_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hotel_meal_pricings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "hotel_meal_pricings_hotel_id_idx" ON "hotel_meal_pricings"("hotel_id");

DO $$ BEGIN
  ALTER TABLE "hotel_meal_pricings" ADD CONSTRAINT "hotel_meal_pricings_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Seasonal overrides for a meal price
CREATE TABLE IF NOT EXISTS "hotel_meal_pricing_seasons" (
    "id"              SERIAL          NOT NULL,
    "meal_pricing_id" INTEGER         NOT NULL,
    "season_name"     TEXT            NOT NULL,
    "valid_from"      TIMESTAMP(3)    NOT NULL,
    "valid_to"        TIMESTAMP(3)    NOT NULL,
    "price"           DECIMAL(10,2)   NOT NULL,
    "weekend_price"   DECIMAL(10,2),
    "is_active"       BOOLEAN         NOT NULL DEFAULT true,
    "sort_order"      INTEGER         NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "hotel_meal_pricing_seasons_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "hotel_meal_pricing_seasons_meal_pricing_id_idx" ON "hotel_meal_pricing_seasons"("meal_pricing_id");

DO $$ BEGIN
  ALTER TABLE "hotel_meal_pricing_seasons" ADD CONSTRAINT "hotel_meal_pricing_seasons_meal_pricing_id_fkey"
    FOREIGN KEY ("meal_pricing_id") REFERENCES "hotel_meal_pricings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
