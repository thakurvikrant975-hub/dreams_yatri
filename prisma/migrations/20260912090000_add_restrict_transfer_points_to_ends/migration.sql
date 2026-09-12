-- Route (Destinations & Nights) toggle: when on, only Day 1's transfer
-- pickup and the last day's transfer drop are collected in the builder —
-- every day in between skips pickup, drop AND distance. Purely additive:
-- existing packages default to off (unchanged, every day still asks for
-- pickup/drop as before).

-- AlterTable
ALTER TABLE "custom_packages"
    ADD COLUMN "restrictTransferPointsToEnds" BOOLEAN NOT NULL DEFAULT false;
