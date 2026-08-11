-- Tone for a custom package day's note — "warning" | "info" | "error" |
-- "success" | "neutral". Deliberately the same vocabulary as
-- itinerary_notes.type in the admin catalog (see NOTE_STYLES in the website's
-- Itnary.tsx) rather than a second set of names for the same idea.
--
-- Nullable with no default: an existing note has no tone and should keep
-- rendering exactly as it does today, which is the neutral treatment.
ALTER TABLE "custom_itineraries" ADD COLUMN "notesType" TEXT;
