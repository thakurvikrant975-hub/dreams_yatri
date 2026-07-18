-- AlterTable
ALTER TABLE "hotels" DROP COLUMN "pricing_notes";

-- AlterTable
ALTER TABLE "hotel_room_pricing" ADD COLUMN     "notes" TEXT;
