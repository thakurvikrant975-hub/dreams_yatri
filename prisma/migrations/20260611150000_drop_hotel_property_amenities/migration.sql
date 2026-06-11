-- DropColumn: property_amenities reverted to room-level amenities only
ALTER TABLE "hotels" DROP COLUMN IF EXISTS "property_amenities";
