-- Property type the exec wants (e.g. "RESORT", "STAR_4") for a pending
-- "Add Hotels by Team" request, shown to the hotel team on
-- /dashboard/hotel-requests. Rooms/mattresses/meal-plan for the request
-- reuse the existing roomsCount/manualExtraBeds/hotelMealPlan columns rather
-- than adding dedicated ones.
ALTER TABLE "custom_itineraries" ADD COLUMN "hotelRequestType" TEXT;
