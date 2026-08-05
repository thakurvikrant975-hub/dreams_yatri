-- Corrects the backfill in 20260805120000_add_hotel_approval.
--
-- That migration treated listing_status IN ('APPROVED','LIVE') as proof a
-- manager had signed the content off. That only holds for owner submissions,
-- which reach LIVE through the Property Submissions review. Ops-created
-- hotels (owner_id IS NULL) were set LIVE in bulk without any review — on the
-- current data that is 1147 of 1149 "approved" rows, which would have started
-- the queue with almost everything wrongly marked approved.
--
-- Narrowed to rows the backfill itself wrote: approval_notes is still NULL,
-- so a real decision made through the Hotel Approvals screen is never undone.
UPDATE "hotels"
SET "approval_status"         = 'PENDING',
    "approval_reviewed_at"    = NULL,
    "approval_reviewed_by_id" = NULL
WHERE "owner_id" IS NULL
  AND "approval_status" = 'APPROVED'
  AND "approval_notes" IS NULL;
