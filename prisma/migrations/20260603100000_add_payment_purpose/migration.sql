-- Phase 7.5: distinguish payment purpose (initial booking vs date-change top-up).

CREATE TYPE "PaymentPurpose" AS ENUM ('INITIAL', 'TOPUP', 'BALANCE');

ALTER TABLE "payments" ADD COLUMN "purpose" "PaymentPurpose" NOT NULL DEFAULT 'INITIAL';
