-- CreateEnum (idempotent — shadow DB may already have this type)
DO $$ BEGIN
    CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'ADVANCE_PAID', 'FULLY_PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."ReferralSource" AS ENUM ('AGENT', 'CLIENT', 'PARTNER', 'ORGANIC');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "public"."DocumentType" AS ENUM ('HOTEL_VOUCHER', 'CAB_CONFIRMATION', 'ITINERARY', 'INVOICE', 'FLIGHT_TICKET', 'OTHER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterEnum
ALTER TYPE "public"."QueryStatus" ADD VALUE IF NOT EXISTS 'ASSIGNED';
ALTER TYPE "public"."QueryStatus" ADD VALUE IF NOT EXISTS 'PACKAGE_SENT';
ALTER TYPE "public"."QueryStatus" ADD VALUE IF NOT EXISTS 'CLIENT_ACCEPTED';
ALTER TYPE "public"."QueryStatus" ADD VALUE IF NOT EXISTS 'CLIENT_DECLINED';
ALTER TYPE "public"."QueryStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_INITIATED';
ALTER TYPE "public"."QueryStatus" ADD VALUE IF NOT EXISTS 'CONVERTED';

-- AlterEnum
ALTER TYPE "public"."BookingStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE "public"."BookingStatus" ADD VALUE IF NOT EXISTS 'ALL_CONFIRMED';
ALTER TYPE "public"."BookingStatus" ADD VALUE IF NOT EXISTS 'UPCOMING';
ALTER TYPE "public"."BookingStatus" ADD VALUE IF NOT EXISTS 'ONGOING';
ALTER TYPE "public"."BookingStatus" ADD VALUE IF NOT EXISTS 'COMPLETED';

-- AlterTable: add new columns to bookings
ALTER TABLE "public"."bookings"
  ADD COLUMN IF NOT EXISTS "paymentStatus"           "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "advancePaidAmount"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "balanceDueAmount"         DECIMAL(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "balanceDueDate"           TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceQueryId"            TEXT,
  ADD COLUMN IF NOT EXISTS "convertedAt"              TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "salesAgentId"             TEXT,
  ADD COLUMN IF NOT EXISTS "salesAgentName"           TEXT,
  ADD COLUMN IF NOT EXISTS "referredBy"               TEXT,
  ADD COLUMN IF NOT EXISTS "referralSource"           "public"."ReferralSource",
  ADD COLUMN IF NOT EXISTS "opsAgentName"             TEXT,
  ADD COLUMN IF NOT EXISTS "hotelAgentName"           TEXT,
  ADD COLUMN IF NOT EXISTS "cabAgentName"             TEXT,
  ADD COLUMN IF NOT EXISTS "confirmationEmailSentAt"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "confirmationEmailTo"      TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "bookings_sourceQueryId_key" ON "public"."bookings"("sourceQueryId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "public"."bookings"
      ADD CONSTRAINT "bookings_sourceQueryId_fkey"
      FOREIGN KEY ("sourceQueryId")
      REFERENCES "public"."package_queries"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- CreateTable: trip_documents
CREATE TABLE IF NOT EXISTS "public"."trip_documents" (
  "id"          TEXT NOT NULL,
  "bookingId"   TEXT NOT NULL,
  "type"        "public"."DocumentType" NOT NULL,
  "fileUrl"     TEXT NOT NULL,
  "uploadedBy"  TEXT NOT NULL,
  "uploadedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "trip_documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (idempotent)
DO $$ BEGIN
    ALTER TABLE "public"."trip_documents"
      ADD CONSTRAINT "trip_documents_bookingId_fkey"
      FOREIGN KEY ("bookingId")
      REFERENCES "public"."bookings"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;