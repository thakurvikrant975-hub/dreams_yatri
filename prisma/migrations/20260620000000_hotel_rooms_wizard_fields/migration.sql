ALTER TABLE "hotel_rooms"
  ADD COLUMN IF NOT EXISTS "area_unit"        VARCHAR(10)  DEFAULT 'sqft',
  ADD COLUMN IF NOT EXISTS "room_type"        VARCHAR(100),
  ADD COLUMN IF NOT EXISTS "num_bedrooms"     INTEGER,
  ADD COLUMN IF NOT EXISTS "num_living_rooms" INTEGER,
  ADD COLUMN IF NOT EXISTS "num_rooms"        INTEGER      NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "room_wizard_step" INTEGER      NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "beds"             JSONB,
  ADD COLUMN IF NOT EXISTS "meal_plan"        VARCHAR(20);
