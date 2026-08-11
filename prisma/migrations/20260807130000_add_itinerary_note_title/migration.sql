-- Optional heading for a custom package day's note, alongside notes/notesType.
-- Nullable: an existing note has no title and keeps rendering under its tone's
-- own label ("Heads up", "Important", …), exactly as it does today.
ALTER TABLE "custom_itineraries" ADD COLUMN "notesTitle" TEXT;
