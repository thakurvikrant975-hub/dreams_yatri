-- The hotel team can now reject a pending hotel request (single day or all
-- pending days on a package) with a reason, instead of only filling it.
-- hotelPending is deliberately left untouched by a reject — see the doc
-- comment on hotelRejectedAt in schema.prisma.
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelRejectedAt" TIMESTAMP(3);
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelRejectedById" TEXT;
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelRejectedByName" TEXT;
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelRejectionNote" TEXT;
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelRejectedNotifiedAt" TIMESTAMP(3);
