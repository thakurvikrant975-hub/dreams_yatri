-- Pre-travel reconfirmation tracking, separate from the initial isConfirmed/confirmedAt.
ALTER TABLE "booking_hotels" ADD COLUMN "reconfirmedAt" TIMESTAMP(3);
ALTER TABLE "booking_hotels" ADD COLUMN "reconfirmedById" TEXT;
ALTER TABLE "booking_hotels" ADD COLUMN "reconfirmedByName" TEXT;

ALTER TABLE "booking_cabs" ADD COLUMN "reconfirmedAt" TIMESTAMP(3);
ALTER TABLE "booking_cabs" ADD COLUMN "reconfirmedById" TEXT;
ALTER TABLE "booking_cabs" ADD COLUMN "reconfirmedByName" TEXT;
