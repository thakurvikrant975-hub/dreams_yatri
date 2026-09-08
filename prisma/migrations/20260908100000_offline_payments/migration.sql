-- Payments taken outside the gateway, and the ability to reverse any payment.
--
-- VOIDED is added as a PaymentStatus rather than a `voidedAt` boolean because
-- every existing money query already filters on status; a voided row therefore
-- drops out of sums, reports and the ops queue without each call site having
-- to remember a new condition.

-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'VOIDED';

-- AlterTable
ALTER TABLE "payments"
  ADD COLUMN "recordedById"   TEXT,
  ADD COLUMN "recordedByName" TEXT,
  ADD COLUMN "receiptUrl"     TEXT,
  ADD COLUMN "notes"          TEXT,
  ADD COLUMN "voidedAt"       TIMESTAMP(3),
  ADD COLUMN "voidedById"     TEXT,
  ADD COLUMN "voidedByName"   TEXT,
  ADD COLUMN "voidReason"     TEXT;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_recordedById_fkey"
  FOREIGN KEY ("recordedById") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_voidedById_fkey"
  FOREIGN KEY ("voidedById") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
