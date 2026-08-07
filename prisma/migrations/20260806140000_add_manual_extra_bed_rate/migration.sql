-- Manual counterpart to hotel_room_pricing.extra_bed_rate, for a day with NO
-- catalog roomPricingId. custom_itineraries.manualExtraBeds already tracked
-- how many extra mattresses a hand-typed or hotel-team-filled day needed, but
-- there was no rate to multiply it against, so those mattresses never
-- actually added to the day's price.
ALTER TABLE "custom_itineraries" ADD COLUMN "manualExtraBedRate" DOUBLE PRECISION;
