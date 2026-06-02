-- Phase 2.4: payment schedule legs (DEPOSIT + BALANCE) in paise.

CREATE TYPE "InstallmentType" AS ENUM ('DEPOSIT', 'BALANCE');
CREATE TYPE "InstallmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'WAIVED', 'CANCELLED');

CREATE TABLE "payment_installments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "InstallmentType" NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "amount_paise" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3),
    "status" "InstallmentStatus" NOT NULL DEFAULT 'PENDING',
    "paidPaymentId" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "payment_installments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_installments_bookingId_type_key" ON "payment_installments"("bookingId", "type");
CREATE INDEX "payment_installments_bookingId_idx" ON "payment_installments"("bookingId");
CREATE INDEX "payment_installments_status_idx" ON "payment_installments"("status");

ALTER TABLE "payment_installments"
    ADD CONSTRAINT "payment_installments_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
