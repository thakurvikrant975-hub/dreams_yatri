-- Add covered_meals array to meal_types (tracks which standard meals a plan includes)
ALTER TABLE "meal_types" ADD COLUMN IF NOT EXISTS "covered_meals" TEXT[] NOT NULL DEFAULT '{}';
