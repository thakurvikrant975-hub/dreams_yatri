-- Phase 9.1: checkout details — traveller names + booking contact/GST.

ALTER TABLE "booking_travellers" ADD COLUMN "firstName" TEXT;
ALTER TABLE "booking_travellers" ADD COLUMN "lastName" TEXT;

ALTER TABLE "bookings" ADD COLUMN "contactEmail" TEXT;
ALTER TABLE "bookings" ADD COLUMN "contactPhone" TEXT;
ALTER TABLE "bookings" ADD COLUMN "gstStateCode" TEXT;
