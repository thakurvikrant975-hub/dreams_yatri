-- Manual (GPay/UPI) payment proof review, and the one-time "booking
-- confirmed" celebration + party-ask flags. Purely additive: existing rows
-- default to APPROVED verification (gateway payments stay trusted as-is)
-- and null/false for the new Booking flags.

-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "payments"
    ADD COLUMN "proofUrl" TEXT,
    ADD COLUMN "proofKey" TEXT,
    ADD COLUMN "verificationStatus" "PaymentVerificationStatus" NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN "rejectionReason" TEXT,
    ADD COLUMN "submittedById" TEXT,
    ADD COLUMN "submittedByName" TEXT,
    ADD COLUMN "verifiedById" TEXT,
    ADD COLUMN "verifiedByName" TEXT,
    ADD COLUMN "verifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "bookings"
    ADD COLUMN "celebrationSeenAt" TIMESTAMP(3),
    ADD COLUMN "partyRequested" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "partyAskedAt" TIMESTAMP(3);
