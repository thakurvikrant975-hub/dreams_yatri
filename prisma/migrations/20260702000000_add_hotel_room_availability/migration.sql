-- CreateTable
CREATE TABLE "hotel_room_availability" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "room_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "total_units" INTEGER NOT NULL,
    "booked_units" INTEGER NOT NULL DEFAULT 0,
    "stop_sell" BOOLEAN NOT NULL DEFAULT false,
    "price_override" DECIMAL(10,2),
    "min_los" INTEGER,
    "max_los" INTEGER,
    "closed_to_arrival" BOOLEAN NOT NULL DEFAULT false,
    "closed_to_departure" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_room_availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_room_availability_room_id_date_key" ON "hotel_room_availability"("room_id", "date");

-- CreateIndex
CREATE INDEX "hotel_room_availability_hotel_id_date_idx" ON "hotel_room_availability"("hotel_id", "date");

-- CreateIndex
CREATE INDEX "hotel_room_availability_room_id_date_idx" ON "hotel_room_availability"("room_id", "date");

-- AddForeignKey
ALTER TABLE "hotel_room_availability" ADD CONSTRAINT "hotel_room_availability_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_room_availability" ADD CONSTRAINT "hotel_room_availability_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
