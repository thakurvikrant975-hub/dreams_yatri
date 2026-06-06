-- Status tracking (Phase 4.1): ops-proposed replacement offers for unavailable items

CREATE TABLE IF NOT EXISTS "replacement_offers" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "activityId" INTEGER,
    "options" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROPOSED',
    "chosenOptionId" TEXT,
    "proposedById" TEXT NOT NULL,
    "proposedByName" TEXT NOT NULL,
    "chosenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "replacement_offers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "replacement_offers_bookingId_idx" ON "replacement_offers"("bookingId");
ALTER TABLE "replacement_offers" ADD CONSTRAINT "replacement_offers_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
