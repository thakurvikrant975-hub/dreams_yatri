-- CreateEnum
CREATE TYPE "HotelReservationStatus" AS ENUM ('HELD', 'CONFIRMED', 'CANCELLED');

-- CreateTable
CREATE TABLE "hotel_reservation" (
    "id" TEXT NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "room_id" INTEGER NOT NULL,
    "check_in" DATE NOT NULL,
    "check_out" DATE NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 1,
    "status" "HotelReservationStatus" NOT NULL DEFAULT 'HELD',
    "source" TEXT NOT NULL DEFAULT 'direct',
    "external_ref" TEXT,
    "hold_key" TEXT NOT NULL,
    "guest_name" TEXT,
    "guest_email" TEXT,
    "guest_phone" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gross_amount" DECIMAL(10,2),
    "net_amount" DECIMAL(10,2),
    "commission" DECIMAL(10,2),
    "booking_id" TEXT,
    "notes" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_reservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_reservation_hold_key_key" ON "hotel_reservation"("hold_key");

-- CreateIndex
CREATE INDEX "hotel_reservation_hotel_id_check_in_idx" ON "hotel_reservation"("hotel_id", "check_in");

-- CreateIndex
CREATE INDEX "hotel_reservation_room_id_check_in_idx" ON "hotel_reservation"("room_id", "check_in");

-- CreateIndex
CREATE INDEX "hotel_reservation_source_idx" ON "hotel_reservation"("source");

-- CreateIndex
CREATE INDEX "hotel_reservation_status_idx" ON "hotel_reservation"("status");

-- AddForeignKey
ALTER TABLE "hotel_reservation" ADD CONSTRAINT "hotel_reservation_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_reservation" ADD CONSTRAINT "hotel_reservation_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
