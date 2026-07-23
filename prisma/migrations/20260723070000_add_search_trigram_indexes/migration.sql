-- Enables fast substring (ILIKE '%term%') matching via trigram indexes —
-- a plain btree index can't be used for infix search, so without this,
-- any '%term%' filter forces a full-table regex scan.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "hotels_name_trgm_idx" ON "hotels" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "hotels_city_trgm_idx" ON "hotels" USING GIN ("city" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "hotel_rooms_name_trgm_idx" ON "hotel_rooms" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "hotel_room_pricing_seasons_season_name_trgm_idx" ON "hotel_room_pricing_seasons" USING GIN ("season_name" gin_trgm_ops);
