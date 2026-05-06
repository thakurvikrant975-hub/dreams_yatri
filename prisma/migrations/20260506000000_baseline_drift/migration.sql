-- Baseline: captures all drift made directly in DB

-- Remove ALL_CONFIRMED from BookingStatus (requires recreating the type in Postgres)
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW';
ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- route_stops changes
ALTER TABLE "route_stops" DROP CONSTRAINT IF EXISTS "route_stops_destination_id_fkey";
ALTER TABLE "route_stops" DROP CONSTRAINT IF EXISTS "route_stops_route_id_fkey";
ALTER TABLE "route_stops" DROP COLUMN IF EXISTS "destination_id";
ALTER TABLE "route_stops" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "route_stops" ADD COLUMN IF NOT EXISTS "place_id" TEXT;
ALTER TABLE "route_stops" ADD COLUMN IF NOT EXISTS "place_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "route_stops" ALTER COLUMN "sort_order" SET DEFAULT 0;
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "package_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- bookings default change
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING_REVIEW'::"BookingStatus";
