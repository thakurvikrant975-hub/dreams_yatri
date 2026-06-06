-- Status tracking (Phase 1.1): per-item fulfilment status, vouchers, booking_activities

-- New enum for per-item fulfilment lifecycle
CREATE TYPE "FulfillmentStatus" AS ENUM ('PENDING', 'IN_PROCESS', 'CONFIRMED', 'UNAVAILABLE', 'REPLACED', 'CANCELLED');

-- DocumentType: add ACTIVITY_TICKET
ALTER TYPE "DocumentType" ADD VALUE IF NOT EXISTS 'ACTIVITY_TICKET';

-- BookingHotel: status + voucher
ALTER TABLE "booking_hotels" ADD COLUMN IF NOT EXISTS "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "booking_hotels" ADD COLUMN IF NOT EXISTS "voucherUrl" TEXT;

-- BookingCab: status + voucher
ALTER TABLE "booking_cabs" ADD COLUMN IF NOT EXISTS "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "booking_cabs" ADD COLUMN IF NOT EXISTS "voucherUrl" TEXT;

-- BookingActivity: new per-activity fulfilment record
CREATE TABLE IF NOT EXISTS "booking_activities" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "activityId" INTEGER NOT NULL,
    "variantId" INTEGER,
    "name" TEXT NOT NULL,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "status" "FulfillmentStatus" NOT NULL DEFAULT 'PENDING',
    "voucherUrl" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "booking_activities_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "booking_activities_bookingId_dayNumber_activityId_key" ON "booking_activities"("bookingId", "dayNumber", "activityId");
CREATE INDEX IF NOT EXISTS "booking_activities_bookingId_idx" ON "booking_activities"("bookingId");
ALTER TABLE "booking_activities" ADD CONSTRAINT "booking_activities_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
