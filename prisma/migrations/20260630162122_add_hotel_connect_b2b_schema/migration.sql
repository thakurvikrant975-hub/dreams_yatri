-- CreateEnum
CREATE TYPE "HotelOwnerStatus" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "HotelCancellationPolicy" AS ENUM ('FREE_TILL_CHECKIN', 'FREE_TILL_24H', 'FREE_TILL_48H', 'FREE_TILL_72H', 'NON_REFUNDABLE');

-- CreateEnum
CREATE TYPE "HotelBusinessType" AS ENUM ('PROPRIETORSHIP', 'PARTNERSHIP', 'LLP', 'PRIVATE_LIMITED', 'PUBLIC_LIMITED', 'HUF');

-- CreateEnum
CREATE TYPE "HotelListingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'LIVE');

-- CreateEnum
CREATE TYPE "PropertyCategory" AS ENUM ('HOTEL', 'HOMESTAY_VILLA');

-- CreateEnum
CREATE TYPE "PropertySubType" AS ENUM ('HOTEL', 'RESORT', 'GUEST_HOUSE', 'HOUSEBOAT', 'VILLA', 'HOMESTAY', 'APARTMENT');

-- DropForeignKey
ALTER TABLE "hotels" DROP CONSTRAINT "hotels_destination_id_fkey";

-- AlterTable
ALTER TABLE "hotel_images" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- NOTE: schema.prisma no longer declares hotel_meal_pricings.non_veg_price /
-- veg_price, but they were deliberately NOT dropped here — could not verify
-- whether production holds real pricing data in them (no DB access to check
-- from this environment). Leaving them in place is harmless (Prisma ignores
-- undeclared columns); follow up with a separate migration once verified.

-- AlterTable
ALTER TABLE "hotel_room_pricing" ADD COLUMN     "extra_child_rate" DECIMAL(10,2);

-- AlterTable
ALTER TABLE "hotel_rooms" ADD COLUMN     "base_adults" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "base_children" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "max_occupancy" SET DEFAULT 3,
ALTER COLUMN "max_adults" SET DEFAULT 2,
ALTER COLUMN "max_children" SET DEFAULT 1,
ALTER COLUMN "area_unit" SET DATA TYPE TEXT,
ALTER COLUMN "room_type" SET DATA TYPE TEXT,
ALTER COLUMN "meal_plan" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "hotels" ADD COLUMN     "acceptable_id_proofs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "allow_guests_below_18" BOOLEAN,
ADD COLUMN     "allow_male_only_groups" BOOLEAN,
ADD COLUMN     "allow_outside_visitors" BOOLEAN,
ADD COLUMN     "allow_same_city_id" BOOLEAN,
ADD COLUMN     "allow_unmarried_couples" BOOLEAN,
ADD COLUMN     "allowed_pet_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "approved_at" TIMESTAMP(3),
ADD COLUMN     "approved_by_id" TEXT,
ADD COLUMN     "bank_account_number" TEXT,
ADD COLUMN     "bank_consent_given" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "bank_ifsc_code" TEXT,
ADD COLUMN     "bank_name" TEXT,
ADD COLUMN     "booking_since_year" INTEGER,
ADD COLUMN     "business_type" "HotelBusinessType",
ADD COLUMN     "cancellation_policy" "HotelCancellationPolicy",
ADD COLUMN     "channel_manager_name" TEXT,
ADD COLUMN     "checkin_24_hours" BOOLEAN,
ADD COLUMN     "contact_email" TEXT,
ADD COLUMN     "contact_landline" TEXT,
ADD COLUMN     "contact_mobile" TEXT,
ADD COLUMN     "contact_mobile_cc" TEXT DEFAULT '+91',
ADD COLUMN     "contact_whatsapp" TEXT,
ADD COLUMN     "extra_bed_included" BOOLEAN,
ADD COLUMN     "gstin_number" TEXT,
ADD COLUMN     "has_channel_manager" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "infant_complimentary_food" BOOLEAN,
ADD COLUMN     "infant_free_occupancy" BOOLEAN,
ADD COLUMN     "landmark" TEXT,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "listing_status" "HotelListingStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN     "longitude" DECIMAL(10,7),
ADD COLUMN     "msme_number" TEXT,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "pan_number" TEXT,
ADD COLUMN     "parties_events_allowed" BOOLEAN,
ADD COLUMN     "pet_extra_charges" BOOLEAN,
ADD COLUMN     "pet_food_available" BOOLEAN,
ADD COLUMN     "pets_allowed" BOOLEAN,
ADD COLUMN     "pets_on_property" BOOLEAN,
ADD COLUMN     "pets_restricted_areas" TEXT,
ADD COLUMN     "pets_without_leash" BOOLEAN,
ADD COLUMN     "property_amenities" JSONB,
ADD COLUMN     "property_category" "PropertyCategory",
ADD COLUMN     "property_documents" JSONB,
ADD COLUMN     "property_sub_type" "PropertySubType",
ADD COLUMN     "provide_bed_extra_adults" BOOLEAN,
ADD COLUMN     "provide_bed_extra_kids" BOOLEAN,
ADD COLUMN     "rejection_reason" TEXT,
ADD COLUMN     "show_couple_tag" BOOLEAN,
ADD COLUMN     "smoking_allowed" BOOLEAN,
ADD COLUMN     "star_rating" INTEGER,
ADD COLUMN     "submitted_at" TIMESTAMP(3),
ADD COLUMN     "whatsapp_same_as_mobile" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "wheelchair_accessible" BOOLEAN,
ADD COLUMN     "wizard_step" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "year_built" INTEGER,
ALTER COLUMN "destination_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "package_itineraries" ALTER COLUMN "meals" DROP DEFAULT;

-- CreateTable
CREATE TABLE "hotel_owners" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "businessName" TEXT,
    "status" "HotelOwnerStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_owners_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_owners_email_key" ON "hotel_owners"("email");

-- CreateIndex
CREATE INDEX "hotel_owners_email_idx" ON "hotel_owners"("email");

-- CreateIndex
CREATE INDEX "hotels_owner_id_idx" ON "hotels"("owner_id");

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "hotel_owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

