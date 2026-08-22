-- Seasonal margin for catalog packages.
--
-- Until now a package's margin was one number per (package, duration, stay
-- category) — the same cut in peak December as in the monsoon trough. This
-- keeps that number as the BASE margin (every date no season covers) and adds
-- date-ranged overrides on top, modelled on hotel_room_pricing_seasons: the
-- year in valid_from/valid_to is ignored when matching, so a season entered
-- once recurs every year instead of silently lapsing each January.
--
-- No backfill: a package with no seasons resolves to its base margin, which is
-- exactly the fixed margin it had before, so existing prices don't move.

-- CreateTable
CREATE TABLE "package_pricing_seasons" (
    "id" SERIAL NOT NULL,
    "pricing_id" INTEGER NOT NULL,
    "season_name" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_to" TIMESTAMP(3) NOT NULL,
    "margin_percentage" DECIMAL(5,2) NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_pricing_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_pricing_seasons_pricing_id_idx" ON "package_pricing_seasons"("pricing_id");

-- AddForeignKey
-- Cascade: deletePackage already does package_pricing.deleteMany, and a margin
-- season is meaningless without the config row it overrides.
ALTER TABLE "package_pricing_seasons"
    ADD CONSTRAINT "package_pricing_seasons_pricing_id_fkey"
    FOREIGN KEY ("pricing_id") REFERENCES "package_pricing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
