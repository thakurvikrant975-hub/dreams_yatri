-- Add hotel-level margin and GST (one-time settings, applied to all variants)
ALTER TABLE "hotels"
  ADD COLUMN "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN "gst_percentage"    DECIMAL(5,2) NOT NULL DEFAULT 18;

-- Add-ons table (per-hotel: meal extras, services, equipment, etc.)
CREATE TABLE "hotel_addons" (
  "id"            SERIAL PRIMARY KEY,
  "hotel_id"      INTEGER       NOT NULL,
  "label"         TEXT          NOT NULL,
  "description"   TEXT,
  "charge_type"   TEXT          NOT NULL,   -- PER_PERSON | PER_ROOM | PER_BOOKING
  "price"         DECIMAL(10,2) NOT NULL,
  "weekend_price" DECIMAL(10,2),
  "is_active"     BOOLEAN       NOT NULL DEFAULT true,
  "sort_order"    INTEGER       NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_addons_hotel_id_fkey"
    FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE
);

CREATE INDEX "hotel_addons_hotel_id_idx" ON "hotel_addons"("hotel_id");

-- Seasonal overrides for add-ons
CREATE TABLE "hotel_addon_seasons" (
  "id"            SERIAL PRIMARY KEY,
  "addon_id"      INTEGER       NOT NULL,
  "season_name"   TEXT          NOT NULL,
  "valid_from"    TIMESTAMP(3)  NOT NULL,
  "valid_to"      TIMESTAMP(3)  NOT NULL,
  "price"         DECIMAL(10,2) NOT NULL,
  "weekend_price" DECIMAL(10,2),
  "is_active"     BOOLEAN       NOT NULL DEFAULT true,
  "sort_order"    INTEGER       NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "hotel_addon_seasons_addon_id_fkey"
    FOREIGN KEY ("addon_id") REFERENCES "hotel_addons"("id") ON DELETE CASCADE
);

CREATE INDEX "hotel_addon_seasons_addon_id_idx" ON "hotel_addon_seasons"("addon_id");
