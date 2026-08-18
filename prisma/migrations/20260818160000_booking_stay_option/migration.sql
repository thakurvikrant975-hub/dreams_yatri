-- Which stay option a client booked, on a package quoting several.
--
-- Ops needs it to know which hotels to hold, and it records which of the quoted
-- prices was accepted. Not a foreign key on purpose: the option can be renamed
-- or removed afterwards, and a booking must neither cascade away with it nor
-- block its deletion. The label is frozen alongside the id — it is what was
-- sold. Null on every existing booking, which is correct: they all predate this.
--
-- The model is Booking, the table is bookings (@@map).
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "stayOptionId" TEXT;
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "stayOptionLabel" TEXT;
