-- AlterTable: per-rate-plan cancellation policy (falls back to hotel-level when null)
ALTER TABLE "hotel_room_pricing" ADD COLUMN "cancellation_policy" "HotelCancellationPolicy";
