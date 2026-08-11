-- Manually-raised invoices and vouchers.
--
-- Ops issues the same two documents the site generates automatically for
-- business that never became a booking (walk-ins, B2B agents, phone bookings).
-- One table for both, discriminated by `type`, so the document series, the
-- listing and the permissions stay single.
--
-- Entirely new table with no FK onto bookings — nothing existing reads or
-- writes it, so this is safe to apply against a live database.
CREATE TYPE "ManualDocumentType" AS ENUM ('INVOICE', 'VOUCHER');

CREATE TABLE "manual_documents" (
    "id" TEXT NOT NULL,
    "type" "ManualDocumentType" NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestContact" TEXT,
    "title" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "travellers" INTEGER NOT NULL DEFAULT 1,
    "totalAmount_paise" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_documents_pkey" PRIMARY KEY ("id")
);

-- The document number is the document's identity on paper. Unique so two
-- people raising a document at the same moment cannot both be handed the same
-- number — the create path retries against exactly this constraint rather than
-- trusting its count-then-insert to be atomic.
CREATE UNIQUE INDEX "manual_documents_documentNumber_key" ON "manual_documents"("documentNumber");

CREATE INDEX "manual_documents_type_issueDate_idx" ON "manual_documents"("type", "issueDate");
CREATE INDEX "manual_documents_guestName_idx" ON "manual_documents"("guestName");

-- Nullable and ON DELETE SET NULL: a document must outlive the team member who
-- raised it. `createdByName` is stored alongside for the same reason — the
-- author's name as it read when the document was issued.
ALTER TABLE "manual_documents"
    ADD CONSTRAINT "manual_documents_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
