-- DropForeignKey
ALTER TABLE "hotels" DROP CONSTRAINT "hotels_owner_id_fkey";

-- DropIndex
DROP INDEX "hotels_owner_id_idx";

-- AlterTable
ALTER TABLE "hotels" DROP COLUMN "approved_at",
DROP COLUMN "approved_by_id",
DROP COLUMN "listing_status",
DROP COLUMN "owner_id",
DROP COLUMN "rejection_reason",
DROP COLUMN "submitted_at";

-- DropTable
DROP TABLE "hotel_owners";

-- DropEnum
DROP TYPE "HotelListingStatus";

-- DropEnum
DROP TYPE "HotelOwnerStatus";
