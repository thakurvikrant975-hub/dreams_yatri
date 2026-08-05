-- Internal QC sign-off on hotel content. Independent of listing_status (the
-- hotel-connect owner workflow) and of is_active — an unapproved hotel stays
-- live and bookable; this only records what a manager has actually checked.
CREATE TYPE "HotelApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'CHANGES_REQUESTED');

ALTER TABLE "hotels" ADD COLUMN "approval_status" "HotelApprovalStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "hotels" ADD COLUMN "approval_notes" TEXT;
ALTER TABLE "hotels" ADD COLUMN "approval_flags" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "hotels" ADD COLUMN "approval_reviewed_at" TIMESTAMP(3);
ALTER TABLE "hotels" ADD COLUMN "approval_reviewed_by_id" TEXT;

CREATE INDEX "hotels_approval_status_idx" ON "hotels"("approval_status");

-- Owner-submitted listings an admin already signed off on in Property
-- Submissions are approved content by definition — carry that decision over so
-- the queue starts with only genuinely unreviewed hotels in it.
UPDATE "hotels"
SET "approval_status"         = 'APPROVED',
    "approval_reviewed_at"    = COALESCE("approved_at", "updated_at"),
    "approval_reviewed_by_id" = "approved_by_id"
WHERE "listing_status" IN ('APPROVED', 'LIVE');
