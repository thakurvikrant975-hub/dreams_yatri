-- Drop destination FK and column
ALTER TABLE route_stops DROP CONSTRAINT IF EXISTS "route_stops_destination_id_fkey";
ALTER TABLE route_stops DROP COLUMN IF EXISTS "destination_id";

-- Add new location fields
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS "place_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS "place_id" TEXT;
ALTER TABLE route_stops ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE route_stops ALTER COLUMN "place_name" DROP DEFAULT;

-- Set sort_order default
ALTER TABLE route_stops ALTER COLUMN "sort_order" SET DEFAULT 0;

-- Re-add route FK with ON DELETE CASCADE
ALTER TABLE route_stops DROP CONSTRAINT IF EXISTS "route_stops_route_id_fkey";
ALTER TABLE route_stops ADD CONSTRAINT "route_stops_route_id_fkey"
  FOREIGN KEY ("route_id") REFERENCES "package_routes"("id") ON DELETE CASCADE;
