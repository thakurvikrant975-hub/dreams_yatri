-- Phase 2.3: per-person traveller rows (replaces the bare Booking.travellers count for detail).

CREATE TYPE "TravellerType" AS ENUM ('ADULT', 'CHILD', 'INFANT');

CREATE TABLE "booking_travellers" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "TravellerType" NOT NULL,
    "fullName" TEXT NOT NULL,
    "age" INTEGER,
    "dateOfBirth" TIMESTAMP(3),
    "gender" "Gender",
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "passportNumber" TEXT,
    "passportExpiry" TIMESTAMP(3),
    "nationality" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "booking_travellers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "booking_travellers_bookingId_idx" ON "booking_travellers"("bookingId");

ALTER TABLE "booking_travellers"
    ADD CONSTRAINT "booking_travellers_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
