-- Add verification and rating fields to cab_drivers

ALTER TABLE "cab_drivers" ADD COLUMN "is_verified"   BOOLEAN       NOT NULL DEFAULT false;
ALTER TABLE "cab_drivers" ADD COLUMN "avg_rating"     DECIMAL(3,2);
ALTER TABLE "cab_drivers" ADD COLUMN "rating_count"   INTEGER       NOT NULL DEFAULT 0;
