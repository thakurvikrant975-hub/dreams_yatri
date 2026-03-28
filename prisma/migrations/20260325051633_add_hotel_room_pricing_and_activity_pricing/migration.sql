-- CreateTable
CREATE TABLE "hotel_room_pricing" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "room_type" TEXT NOT NULL,
    "description" TEXT,
    "occupancy" INTEGER NOT NULL DEFAULT 2,
    "price_per_night" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "season" TEXT NOT NULL DEFAULT 'all',
    "amenities" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hotel_room_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_pricing" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "pricing_type" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "min_persons" INTEGER,
    "max_persons" INTEGER,
    "duration_hours" DECIMAL(4,1),
    "attributes" JSONB,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "activity_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_room_pricing_hotel_id_is_active_idx" ON "hotel_room_pricing"("hotel_id", "is_active");

-- CreateIndex
CREATE INDEX "hotel_room_pricing_hotel_id_season_idx" ON "hotel_room_pricing"("hotel_id", "season");

-- CreateIndex
CREATE INDEX "activity_pricing_activity_id_is_active_idx" ON "activity_pricing"("activity_id", "is_active");

-- AddForeignKey
ALTER TABLE "hotel_room_pricing" ADD CONSTRAINT "hotel_room_pricing_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_pricing" ADD CONSTRAINT "activity_pricing_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
