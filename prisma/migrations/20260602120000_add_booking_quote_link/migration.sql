-- Phase 2.2: link a Booking to the quote it was created from + freeze the price.

CREATE TYPE "PaymentPlan" AS ENUM ('FULL', 'DEPOSIT');

ALTER TABLE "bookings" ADD COLUMN "quoteId" TEXT;
ALTER TABLE "bookings" ADD COLUMN "quoteInputsHash" TEXT;
ALTER TABLE "bookings" ADD COLUMN "priceSnapshot" JSONB;
ALTER TABLE "bookings" ADD COLUMN "paymentPlan" "PaymentPlan";

-- One booking per quote (nullable-unique: many legacy NULLs allowed in Postgres).
CREATE UNIQUE INDEX "bookings_quoteId_key" ON "bookings"("quoteId");
