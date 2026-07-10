-- AlterTable: custom_packages — header blurb + cover image for the printable itinerary
ALTER TABLE "custom_packages"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "coverImage" TEXT;
