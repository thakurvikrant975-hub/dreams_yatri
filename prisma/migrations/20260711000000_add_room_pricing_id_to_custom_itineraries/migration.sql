-- Links a builder itinerary day to the exact hotel_room_pricing row picked
-- for that night, so the package's price can be computed from real hotel
-- rates (date/season + occupancy aware) instead of typed in by hand.
ALTER TABLE "custom_itineraries" ADD COLUMN "roomPricingId" INTEGER;
