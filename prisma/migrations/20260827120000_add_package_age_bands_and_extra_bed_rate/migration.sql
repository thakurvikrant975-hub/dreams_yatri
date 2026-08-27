-- Two unrelated-looking columns, both about the same class of bug: a number
-- the builder needed in order to price a room correctly, that only existed
-- somewhere else.

-- 1. Per-package traveller age bands.
--
-- Infant 0-2 / child 3-12 / adult 13+ was hard-coded. Hotels do not agree on
-- it — under-5s are infants at a good number of properties — so the boundary
-- that decides who needs a bed and who is a paying head now travels with the
-- package. Defaults are the industry ones, so every existing row keeps the
-- classification it already had.
ALTER TABLE "custom_packages" ADD COLUMN "infantMaxAge" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "custom_packages" ADD COLUMN "childMaxAge"  INTEGER NOT NULL DEFAULT 12;

-- 2. The mattress rate, snapshotted onto the day.
--
-- hotel_room_pricing.extra_bed_rate is frequently null, and the builder never
-- carried it, so mattresses an exec had entered were charged at zero with
-- nothing on screen to say so. Diagnostic only — pricing still reads the live
-- rate row (or the exec's manualExtraBedRate override).
ALTER TABLE "custom_itineraries" ADD COLUMN "accommodationExtraBedRate" DOUBLE PRECISION;
