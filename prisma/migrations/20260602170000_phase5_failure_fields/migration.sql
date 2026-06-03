-- Phase 5.1: failure/reconciliation schema additions.

-- Payment failure status (PG12+: ADD VALUE allowed; cannot be USED until committed — we don't here).
ALTER TYPE "PaymentStatus" ADD VALUE IF NOT EXISTS 'FAILED';

-- Balance-reminder de-dup tracking on installments.
ALTER TABLE "payment_installments" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "payment_installments" ADD COLUMN "reminderCount" INTEGER NOT NULL DEFAULT 0;
