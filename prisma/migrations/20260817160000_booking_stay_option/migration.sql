-- Which stay tier a client booked, on a custom package quoted at several.
--
-- Ops needs it to know which hotels to hold — the same trip at 2★ and 4★ is a
-- different set of bookings — and it records which of the quoted prices was
-- accepted. Not a foreign key on purpose: the tier can be edited or removed on
-- the package afterwards, and a booking must neither cascade away with it nor
-- block its deletion. The label is frozen alongside the id for the same reason:
-- it is what was sold.
--
-- Null on every existing booking, which is correct — all of them predate tiers.

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN "stayOptionId" TEXT;
ALTER TABLE "bookings" ADD COLUMN "stayOptionLabel" TEXT;
