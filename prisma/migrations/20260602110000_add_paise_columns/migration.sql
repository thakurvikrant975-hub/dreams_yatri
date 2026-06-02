-- Phase 2.1: paise (integer minor units) columns — charge source of truth.
-- Decimal(10,2) rupee columns are left untouched (display / back-compat).

ALTER TABLE "payments" ADD COLUMN "amount_paise" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "bookings" ADD COLUMN "totalAmount_paise" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "advanceAmount_paise" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "bookings" ADD COLUMN "balanceAmount_paise" INTEGER NOT NULL DEFAULT 0;
