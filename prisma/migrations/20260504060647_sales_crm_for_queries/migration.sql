-- CreateEnum
CREATE TYPE "CabType" AS ENUM ('SEDAN', 'HATCHBACK', 'SUV', 'INNOVA', 'ERTIGA', 'WAGON_R', 'BOLERO', 'TEMPO_TRAVELLER', 'MINI_VAN', 'BUS');

-- CreateEnum
CREATE TYPE "RoomSharingType" AS ENUM ('SHARED', 'PRIVATE');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER');

-- CreateEnum
CREATE TYPE "FoodPreference" AS ENUM ('VEG', 'NON_VEG');

-- CreateEnum
CREATE TYPE "MealPlan" AS ENUM ('EP', 'CP', 'MAP', 'AP');

-- CreateEnum
CREATE TYPE "TimelineAction" AS ENUM ('BOOKING_CREATED', 'STATUS_CHANGED', 'DEPARTMENT_ASSIGNED', 'MEMBER_ASSIGNED', 'DEPARTMENT_CONFIRMED', 'DEPARTMENT_FLAGGED', 'NOTE_ADDED', 'MODIFICATION_REQUESTED', 'EMAIL_SENT', 'REFUND_INITIATED');

-- CreateEnum
CREATE TYPE "PolicyType" AS ENUM ('CANCELLATION', 'DATE_CHANGE', 'REFUND', 'TERMS_AND_CONDITIONS');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY');

-- CreateEnum
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'BANNED', 'DELETED');

-- CreateEnum
CREATE TYPE "TripType" AS ENUM ('Adventure', 'Leisure', 'Pilgrimage', 'Honeymoon', 'Family', 'Corporate', 'Backpacking', 'Wildlife');

-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('Solo', 'Couple', 'Family', 'Group');

-- CreateEnum
CREATE TYPE "BudgetTier" AS ENUM ('Budget', 'MidRange', 'Luxury', 'UltraLuxury');

-- CreateEnum
CREATE TYPE "TripDuration" AS ENUM ('Weekend', 'Short', 'Week', 'Long', 'Extended');

-- CreateEnum
CREATE TYPE "TravelMonth" AS ENUM ('Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED', 'PENDING_REVIEW', 'HOTEL_VERIFICATION', 'HOTEL_CONFIRMED', 'CAB_VERIFICATION', 'CAB_CONFIRMED', 'OPS_REVIEW', 'CONFIRMED', 'REJECTED', 'MODIFICATION_REQUESTED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'CARD', 'NET_BANKING', 'WALLET', 'EMI', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('RAZORPAY', 'PHONEPE', 'PAYU', 'OFFLINE');

-- CreateEnum
CREATE TYPE "LogAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_CHANGE', 'PERMISSION_CHANGE', 'EXPORT', 'BULK_ACTION', 'VIEW_SENSITIVE');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('SUCCESS', 'FAILED', 'REJECTED', 'PENDING');

-- CreateEnum
CREATE TYPE "LogSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "QueryStatus" AS ENUM ('SUBMITTED', 'IN_PROGRESS', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "QuerySource" AS ENUM ('WEBSITE_FORM', 'LANDING_PAGE', 'WHATSAPP', 'PHONE_CALL', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "GallerySourceType" AS ENUM ('PACKAGE', 'HOTEL', 'ACTIVITY', 'ROOM');

-- CreateTable
CREATE TABLE "regions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "meta_desc" TEXT,
    "meta_title" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cover_image" TEXT,
    "thumbnail" TEXT,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "region_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "meta_desc" TEXT,
    "meta_title" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "cover_image" TEXT,
    "thumbnail" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "place_id" TEXT,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "parent_id" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "group" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "thumbnail" TEXT,
    "description" TEXT,
    "destination_id" INTEGER NOT NULL,
    "inclusions" TEXT[],
    "exclusions" TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policies" (
    "id" SERIAL NOT NULL,
    "type" "PolicyType" NOT NULL,
    "title" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "points" TEXT[],

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_policy_map" (
    "package_id" INTEGER NOT NULL,
    "policy_id" INTEGER NOT NULL,

    CONSTRAINT "package_policy_map_pkey" PRIMARY KEY ("package_id","policy_id")
);

-- CreateTable
CREATE TABLE "package_images" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_durations" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "days" INTEGER NOT NULL,
    "nights" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "thumbnail_url" TEXT,

    CONSTRAINT "package_durations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_stay_categories" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "min_duration_days" INTEGER,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "slug" TEXT NOT NULL,

    CONSTRAINT "package_stay_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_pricing" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "duration_id" INTEGER NOT NULL,
    "stay_category_id" INTEGER NOT NULL,
    "gst_percentage" DECIMAL(5,2) NOT NULL DEFAULT 5,
    "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 10,

    CONSTRAINT "package_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_cab_options" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "cab_type" "CabType" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "rate_per_cab" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "package_cab_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_itineraries" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "duration_id" INTEGER NOT NULL,
    "route_id" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "package_itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_tags" (
    "package_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "package_tags_pkey" PRIMARY KEY ("package_id","tag_id")
);

-- CreateTable
CREATE TABLE "package_categories" (
    "package_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "package_categories_pkey" PRIMARY KEY ("package_id","category_id")
);

-- CreateTable
CREATE TABLE "hotels" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "destination_id" INTEGER NOT NULL,
    "address" TEXT,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "star_rating" INTEGER,
    "category" TEXT,
    "stay_type" TEXT,
    "check_in_time" TEXT,
    "check_out_time" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "thumbnail" TEXT,

    CONSTRAINT "hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_image_categories" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "room_pricing_id" INTEGER,
    "name" TEXT NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hotel_image_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_images" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "thumbnail" TEXT,
    "alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "url" TEXT,

    CONSTRAINT "hotel_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_room_pricing" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "room_id" INTEGER,
    "plan_name" TEXT,
    "meal_type_id" INTEGER,
    "diet_type_id" INTEGER,
    "price_per_night" DECIMAL(10,2) NOT NULL,
    "original_price" DECIMAL(10,2),
    "extra_bed_rate" DECIMAL(10,2),
    "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_room_pricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_meals" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "bookingHotelId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "mealType" "MealType" NOT NULL,
    "foodPreference" "FoodPreference" NOT NULL,
    "ratePerPerson" DECIMAL(10,2) NOT NULL,
    "travellers" INTEGER NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "booking_meals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "destination_id" INTEGER NOT NULL,
    "duration_hours" DECIMAL(4,1),
    "difficulty" TEXT,
    "category" TEXT,
    "price" DECIMAL(10,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "margin_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "max_persons" INTEGER,
    "min_persons" INTEGER,
    "original_price" DECIMAL(10,2),
    "pricing_type" TEXT,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_images" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "blur_base64" TEXT,
    "alt" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" DECIMAL(8,2) NOT NULL,
    "applies_to" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "email" TEXT,
    "gender" "Gender",
    "dateOfBirth" TIMESTAMP(3),
    "nationality" TEXT,
    "maritalStatus" "MaritalStatus",
    "anniversary" TIMESTAMP(3),
    "state" TEXT,
    "city" TEXT,
    "passportNumber" TEXT,
    "passportExpiryDate" TIMESTAMP(3),
    "passportIssuingCountry" TEXT,
    "panNumber" TEXT,
    "isProfileComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "country_code" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Otp" (
    "id" TEXT NOT NULL,
    "phone" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" INTEGER NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "email" TEXT,

    CONSTRAINT "Otp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MagicSession" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MagicSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "travel_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripTypes" "TripType"[],
    "groupType" "GroupType",
    "budget" "BudgetTier",
    "duration" "TripDuration",
    "months" "TravelMonth"[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "travel_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "bookingNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" INTEGER,
    "destinationId" INTEGER NOT NULL,
    "tripType" "TripType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "travellers" INTEGER NOT NULL DEFAULT 1,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "cabType" "CabType" NOT NULL DEFAULT 'INNOVA',
    "roomSharingType" "RoomSharingType" NOT NULL DEFAULT 'SHARED',
    "mealPlan" "MealPlan" NOT NULL DEFAULT 'MAP',
    "hotelCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "cabCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "mealCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "marginAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "paidAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "notes" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "currentDepartmentId" TEXT,
    "currentAssigneeId" TEXT,
    "hotelAssigneeId" TEXT,
    "hotelConfirmedAt" TIMESTAMP(3),
    "hotelNotes" TEXT,
    "cabAssigneeId" TEXT,
    "cabConfirmedAt" TIMESTAMP(3),
    "cabNotes" TEXT,
    "opsAssigneeId" TEXT,
    "opsReviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "modificationNote" TEXT,
    "modificationRequestedBy" TEXT,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_hotels" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "cityName" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "hotelId" INTEGER NOT NULL,
    "roomType" TEXT NOT NULL,
    "roomsCount" INTEGER NOT NULL,
    "ratePerRoom" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "notes" TEXT,

    CONSTRAINT "booking_hotels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_cabs" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "legNumber" INTEGER NOT NULL,
    "fromLocation" TEXT NOT NULL,
    "toLocation" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "cabType" "CabType" NOT NULL,
    "cabCount" INTEGER NOT NULL DEFAULT 1,
    "capacity" INTEGER NOT NULL,
    "ratePerCab" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(10,2) NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "driverName" TEXT,
    "driverPhone" TEXT,
    "vehicleNumber" TEXT,
    "notes" TEXT,

    CONSTRAINT "booking_cabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_booking_hotel" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "hotelId" INTEGER NOT NULL,
    "stayType" TEXT,
    "checkingDate" TIMESTAMP(3) NOT NULL,
    "checkoutDate" TIMESTAMP(3) NOT NULL,
    "pax" INTEGER NOT NULL DEFAULT 1,
    "rooms" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "package_booking_hotel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_timeline" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "action" "TimelineAction" NOT NULL,
    "fromStatus" "BookingStatus",
    "toStatus" "BookingStatus",
    "note" TEXT,
    "performedById" TEXT NOT NULL,
    "performedByName" TEXT NOT NULL,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "gateway" "PaymentGateway" NOT NULL,
    "method" "PaymentMethod",
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayOrderId" TEXT,
    "gatewayPaymentId" TEXT,
    "gatewaySignature" TEXT,
    "refundId" TEXT,
    "refundAmount" DECIMAL(10,2),
    "refundedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "regions_all" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_all_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subregions_all" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "region_id" INTEGER NOT NULL,

    CONSTRAINT "subregions_all_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries_all" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "iso2" CHAR(2),
    "phonecode" VARCHAR(255),
    "capital" VARCHAR(255),
    "currency" VARCHAR(255),
    "currency_name" VARCHAR(255),
    "nationality" VARCHAR(255),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "region_id" INTEGER,
    "subregion_id" INTEGER,

    CONSTRAINT "countries_all_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states_all" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "country_id" INTEGER NOT NULL,

    CONSTRAINT "states_all_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities_all" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "state_code" VARCHAR(255) NOT NULL,
    "country_code" CHAR(2) NOT NULL,
    "latitude" DECIMAL(10,8) NOT NULL,
    "longitude" DECIMAL(11,8) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "state_id" INTEGER NOT NULL,
    "country_id" INTEGER NOT NULL,

    CONSTRAINT "cities_all_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_roles" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" VARCHAR(500),
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "departmentId" TEXT,
    "teamRoleId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "joiningDate" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userName" TEXT,
    "userRole" TEXT,
    "userDesignation" TEXT,
    "action" "LogAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "entitySlug" TEXT,
    "previousData" JSONB,
    "newData" JSONB,
    "metadata" JSONB,
    "status" "LogStatus" NOT NULL DEFAULT 'SUCCESS',
    "errorMessage" TEXT,
    "statusCode" INTEGER,
    "severity" "LogSeverity" NOT NULL DEFAULT 'LOW',
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,
    "flagReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "referer" TEXT,
    "requestMethod" TEXT,
    "requestPath" TEXT,
    "sessionId" TEXT,
    "requestId" TEXT,
    "country" TEXT,
    "region" TEXT,
    "city" TEXT,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_queries" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "message" TEXT,
    "packageName" TEXT,
    "destination" TEXT,
    "travelDate" TIMESTAMP(3),
    "groupSize" INTEGER,
    "source" "QuerySource" NOT NULL DEFAULT 'WEBSITE_FORM',
    "gclid" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "pageUrl" TEXT,
    "status" "QueryStatus" NOT NULL DEFAULT 'SUBMITTED',
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "rejectionReasonId" TEXT,
    "rejectionNote" TEXT,
    "callAttempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "assignedTo" TEXT,
    "assignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "leadProfileId" TEXT,

    CONSTRAINT "package_queries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rejection_reasons" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rejection_reasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_notes" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "query_timeline" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "event" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_profiles" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "totalQueries" INTEGER NOT NULL DEFAULT 0,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diet_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "diet_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_room_images" (
    "id" SERIAL NOT NULL,
    "room_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnail" TEXT,
    "alt" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "hotel_room_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_rooms" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "area_sqft" INTEGER,
    "bed_type" TEXT,
    "view_type" TEXT,
    "max_occupancy" INTEGER NOT NULL DEFAULT 3,
    "amenities" JSONB,
    "features" JSONB,
    "bathroom" JSONB,
    "facilities" JSONB,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_activities" (
    "id" SERIAL NOT NULL,
    "itinerary_id" INTEGER NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_optional" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "itinerary_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_notes" (
    "id" SERIAL NOT NULL,
    "itinerary_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "position" TEXT NOT NULL DEFAULT 'bottom',
    "optional_link_text" TEXT,
    "optional_link_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itinerary_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_stays" (
    "id" SERIAL NOT NULL,
    "itinerary_id" INTEGER NOT NULL,
    "stay_category_id" INTEGER NOT NULL,
    "room_pricing_id" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itinerary_stays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "itinerary_transfers" (
    "id" SERIAL NOT NULL,
    "itinerary_id" INTEGER NOT NULL,
    "cab_type" TEXT,
    "pickup_point" TEXT,
    "drop_point" TEXT,
    "duration_text" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "itinerary_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "meal_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_gallery" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    "source_type" "GallerySourceType" NOT NULL,
    "source_id" INTEGER,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT,

    CONSTRAINT "package_gallery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_routes" (
    "id" SERIAL NOT NULL,
    "duration_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "polyline" JSONB,
    "total_distance_km" DOUBLE PRECISION,
    "total_duration_min" INTEGER,
    "packagesId" INTEGER,

    CONSTRAINT "package_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "route_stops" (
    "id" SERIAL NOT NULL,
    "route_id" INTEGER NOT NULL,
    "stay_days" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "destination_id" INTEGER NOT NULL,
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),

    CONSTRAINT "route_stops_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_slug_key" ON "regions"("slug");

-- CreateIndex
CREATE INDEX "regions_slug_idx" ON "regions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations"("slug");

-- CreateIndex
CREATE INDEX "destinations_region_id_idx" ON "destinations"("region_id");

-- CreateIndex
CREATE INDEX "destinations_slug_idx" ON "destinations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "categories_parent_id_idx" ON "categories"("parent_id");

-- CreateIndex
CREATE INDEX "categories_slug_idx" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateIndex
CREATE INDEX "tags_group_idx" ON "tags"("group");

-- CreateIndex
CREATE INDEX "tags_slug_idx" ON "tags"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "packages_slug_key" ON "packages"("slug");

-- CreateIndex
CREATE INDEX "packages_destination_id_is_active_idx" ON "packages"("destination_id", "is_active");

-- CreateIndex
CREATE INDEX "packages_slug_idx" ON "packages"("slug");

-- CreateIndex
CREATE INDEX "policies_type_is_active_idx" ON "policies"("type", "is_active");

-- CreateIndex
CREATE INDEX "package_policy_map_policy_id_idx" ON "package_policy_map"("policy_id");

-- CreateIndex
CREATE INDEX "package_images_package_id_idx" ON "package_images"("package_id");

-- CreateIndex
CREATE INDEX "package_durations_package_id_is_active_idx" ON "package_durations"("package_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "package_durations_package_id_slug_key" ON "package_durations"("package_id", "slug");

-- CreateIndex
CREATE INDEX "package_stay_categories_package_id_is_active_idx" ON "package_stay_categories"("package_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "package_stay_categories_package_id_slug_key" ON "package_stay_categories"("package_id", "slug");

-- CreateIndex
CREATE INDEX "package_pricing_package_id_idx" ON "package_pricing"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_pricing_package_id_duration_id_stay_category_id_key" ON "package_pricing"("package_id", "duration_id", "stay_category_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_cab_options_package_id_cab_type_key" ON "package_cab_options"("package_id", "cab_type");

-- CreateIndex
CREATE INDEX "package_itineraries_route_id_duration_id_idx" ON "package_itineraries"("route_id", "duration_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_itineraries_package_id_duration_id_route_id_day_key" ON "package_itineraries"("package_id", "duration_id", "route_id", "day");

-- CreateIndex
CREATE INDEX "package_tags_tag_id_idx" ON "package_tags"("tag_id");

-- CreateIndex
CREATE INDEX "package_categories_category_id_idx" ON "package_categories"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotels_slug_key" ON "hotels"("slug");

-- CreateIndex
CREATE INDEX "hotels_destination_id_is_active_idx" ON "hotels"("destination_id", "is_active");

-- CreateIndex
CREATE INDEX "hotels_slug_idx" ON "hotels"("slug");

-- CreateIndex
CREATE INDEX "hotel_image_categories_hotel_id_idx" ON "hotel_image_categories"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_image_categories_room_pricing_id_idx" ON "hotel_image_categories"("room_pricing_id");

-- CreateIndex
CREATE INDEX "hotel_images_hotel_id_idx" ON "hotel_images"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_images_category_id_idx" ON "hotel_images"("category_id");

-- CreateIndex
CREATE INDEX "hotel_room_pricing_hotel_id_idx" ON "hotel_room_pricing"("hotel_id");

-- CreateIndex
CREATE INDEX "hotel_room_pricing_room_id_idx" ON "hotel_room_pricing"("room_id");

-- CreateIndex
CREATE INDEX "booking_meals_bookingId_idx" ON "booking_meals"("bookingId");

-- CreateIndex
CREATE INDEX "booking_meals_bookingHotelId_idx" ON "booking_meals"("bookingHotelId");

-- CreateIndex
CREATE UNIQUE INDEX "activities_slug_key" ON "activities"("slug");

-- CreateIndex
CREATE INDEX "activities_destination_id_is_active_idx" ON "activities"("destination_id", "is_active");

-- CreateIndex
CREATE INDEX "activities_category_idx" ON "activities"("category");

-- CreateIndex
CREATE INDEX "activities_slug_idx" ON "activities"("slug");

-- CreateIndex
CREATE INDEX "activity_images_activity_id_idx" ON "activity_images"("activity_id");

-- CreateIndex
CREATE INDEX "pricing_rules_applies_to_is_active_idx" ON "pricing_rules"("applies_to", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_passportNumber_key" ON "User"("passportNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_panNumber_key" ON "User"("panNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE INDEX "Otp_phone_idx" ON "Otp"("phone");

-- CreateIndex
CREATE INDEX "Otp_email_idx" ON "Otp"("email");

-- CreateIndex
CREATE UNIQUE INDEX "MagicSession_token_key" ON "MagicSession"("token");

-- CreateIndex
CREATE UNIQUE INDEX "travel_preferences_userId_key" ON "travel_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_bookingNumber_key" ON "bookings"("bookingNumber");

-- CreateIndex
CREATE INDEX "bookings_userId_idx" ON "bookings"("userId");

-- CreateIndex
CREATE INDEX "bookings_packageId_idx" ON "bookings"("packageId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE INDEX "booking_hotels_bookingId_idx" ON "booking_hotels"("bookingId");

-- CreateIndex
CREATE INDEX "booking_hotels_hotelId_idx" ON "booking_hotels"("hotelId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_hotels_bookingId_dayNumber_key" ON "booking_hotels"("bookingId", "dayNumber");

-- CreateIndex
CREATE INDEX "booking_cabs_bookingId_idx" ON "booking_cabs"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "booking_cabs_bookingId_legNumber_key" ON "booking_cabs"("bookingId", "legNumber");

-- CreateIndex
CREATE INDEX "package_booking_hotel_bookingId_idx" ON "package_booking_hotel"("bookingId");

-- CreateIndex
CREATE INDEX "booking_timeline_bookingId_idx" ON "booking_timeline"("bookingId");

-- CreateIndex
CREATE INDEX "booking_timeline_performedById_idx" ON "booking_timeline"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "payments_gatewayPaymentId_key" ON "payments"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_userId_idx" ON "payments"("userId");

-- CreateIndex
CREATE INDEX "payments_gatewayOrderId_idx" ON "payments"("gatewayOrderId");

-- CreateIndex
CREATE INDEX "subregions_all_region_id_idx" ON "subregions_all"("region_id");

-- CreateIndex
CREATE INDEX "countries_all_region_id_idx" ON "countries_all"("region_id");

-- CreateIndex
CREATE INDEX "countries_all_subregion_id_idx" ON "countries_all"("subregion_id");

-- CreateIndex
CREATE INDEX "states_all_country_id_idx" ON "states_all"("country_id");

-- CreateIndex
CREATE INDEX "cities_all_state_id_idx" ON "cities_all"("state_id");

-- CreateIndex
CREATE INDEX "cities_all_country_id_idx" ON "cities_all"("country_id");

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_roles_name_key" ON "team_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_email_key" ON "team_members"("email");

-- CreateIndex
CREATE INDEX "team_members_email_idx" ON "team_members"("email");

-- CreateIndex
CREATE INDEX "team_members_departmentId_idx" ON "team_members"("departmentId");

-- CreateIndex
CREATE INDEX "team_members_teamRoleId_idx" ON "team_members"("teamRoleId");

-- CreateIndex
CREATE INDEX "activity_logs_userId_idx" ON "activity_logs"("userId");

-- CreateIndex
CREATE INDEX "activity_logs_action_idx" ON "activity_logs"("action");

-- CreateIndex
CREATE INDEX "activity_logs_entity_entityId_idx" ON "activity_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "activity_logs_status_idx" ON "activity_logs"("status");

-- CreateIndex
CREATE INDEX "activity_logs_severity_idx" ON "activity_logs"("severity");

-- CreateIndex
CREATE INDEX "activity_logs_isSuspicious_idx" ON "activity_logs"("isSuspicious");

-- CreateIndex
CREATE INDEX "activity_logs_actionAt_idx" ON "activity_logs"("actionAt");

-- CreateIndex
CREATE INDEX "activity_logs_ipAddress_idx" ON "activity_logs"("ipAddress");

-- CreateIndex
CREATE INDEX "package_queries_status_idx" ON "package_queries"("status");

-- CreateIndex
CREATE INDEX "package_queries_verified_idx" ON "package_queries"("verified");

-- CreateIndex
CREATE INDEX "package_queries_destination_idx" ON "package_queries"("destination");

-- CreateIndex
CREATE INDEX "package_queries_assignedTo_idx" ON "package_queries"("assignedTo");

-- CreateIndex
CREATE INDEX "package_queries_createdAt_idx" ON "package_queries"("createdAt");

-- CreateIndex
CREATE INDEX "query_notes_queryId_idx" ON "query_notes"("queryId");

-- CreateIndex
CREATE INDEX "query_timeline_queryId_idx" ON "query_timeline"("queryId");

-- CreateIndex
CREATE UNIQUE INDEX "lead_profiles_phone_key" ON "lead_profiles"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "diet_types_name_key" ON "diet_types"("name");

-- CreateIndex
CREATE INDEX "hotel_room_images_room_id_idx" ON "hotel_room_images"("room_id");

-- CreateIndex
CREATE INDEX "hotel_rooms_hotel_id_idx" ON "hotel_rooms"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_rooms_hotel_id_slug_key" ON "hotel_rooms"("hotel_id", "slug");

-- CreateIndex
CREATE INDEX "itinerary_activities_itinerary_id_sort_order_idx" ON "itinerary_activities"("itinerary_id", "sort_order");

-- CreateIndex
CREATE INDEX "itinerary_notes_itinerary_id_sort_order_idx" ON "itinerary_notes"("itinerary_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "itinerary_stays_itinerary_id_stay_category_id_key" ON "itinerary_stays"("itinerary_id", "stay_category_id");

-- CreateIndex
CREATE INDEX "itinerary_transfers_itinerary_id_sort_order_idx" ON "itinerary_transfers"("itinerary_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "meal_types_name_key" ON "meal_types"("name");

-- CreateIndex
CREATE INDEX "package_gallery_package_id_idx" ON "package_gallery"("package_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_gallery_package_id_position_key" ON "package_gallery"("package_id", "position");

-- CreateIndex
CREATE INDEX "package_routes_duration_id_idx" ON "package_routes"("duration_id");

-- CreateIndex
CREATE UNIQUE INDEX "package_routes_duration_id_slug_key" ON "package_routes"("duration_id", "slug");

-- CreateIndex
CREATE INDEX "route_stops_route_id_idx" ON "route_stops"("route_id");

-- CreateIndex
CREATE UNIQUE INDEX "route_stops_route_id_sort_order_key" ON "route_stops"("route_id", "sort_order");

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_policy_map" ADD CONSTRAINT "package_policy_map_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_policy_map" ADD CONSTRAINT "package_policy_map_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_images" ADD CONSTRAINT "package_images_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_durations" ADD CONSTRAINT "package_durations_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_stay_categories" ADD CONSTRAINT "package_stay_categories_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_pricing" ADD CONSTRAINT "package_pricing_duration_id_fkey" FOREIGN KEY ("duration_id") REFERENCES "package_durations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_pricing" ADD CONSTRAINT "package_pricing_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_pricing" ADD CONSTRAINT "package_pricing_stay_category_id_fkey" FOREIGN KEY ("stay_category_id") REFERENCES "package_stay_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_cab_options" ADD CONSTRAINT "package_cab_options_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_itineraries" ADD CONSTRAINT "package_itineraries_duration_id_fkey" FOREIGN KEY ("duration_id") REFERENCES "package_durations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_itineraries" ADD CONSTRAINT "package_itineraries_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_itineraries" ADD CONSTRAINT "package_itineraries_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "package_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_tags" ADD CONSTRAINT "package_tags_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_tags" ADD CONSTRAINT "package_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_categories" ADD CONSTRAINT "package_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_categories" ADD CONSTRAINT "package_categories_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotels" ADD CONSTRAINT "hotels_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_image_categories" ADD CONSTRAINT "hotel_image_categories_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_image_categories" ADD CONSTRAINT "hotel_image_categories_room_pricing_id_fkey" FOREIGN KEY ("room_pricing_id") REFERENCES "hotel_room_pricing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_images" ADD CONSTRAINT "hotel_images_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "hotel_image_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_images" ADD CONSTRAINT "hotel_images_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_room_pricing" ADD CONSTRAINT "hotel_room_pricing_diet_type_id_fkey" FOREIGN KEY ("diet_type_id") REFERENCES "diet_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_room_pricing" ADD CONSTRAINT "hotel_room_pricing_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_room_pricing" ADD CONSTRAINT "hotel_room_pricing_meal_type_id_fkey" FOREIGN KEY ("meal_type_id") REFERENCES "meal_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_room_pricing" ADD CONSTRAINT "hotel_room_pricing_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_meals" ADD CONSTRAINT "booking_meals_bookingHotelId_fkey" FOREIGN KEY ("bookingHotelId") REFERENCES "booking_hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_meals" ADD CONSTRAINT "booking_meals_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_images" ADD CONSTRAINT "activity_images_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "travel_preferences" ADD CONSTRAINT "travel_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_cabAssigneeId_fkey" FOREIGN KEY ("cabAssigneeId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_currentAssigneeId_fkey" FOREIGN KEY ("currentAssigneeId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_currentDepartmentId_fkey" FOREIGN KEY ("currentDepartmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_destinationId_fkey" FOREIGN KEY ("destinationId") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_hotelAssigneeId_fkey" FOREIGN KEY ("hotelAssigneeId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_opsAssigneeId_fkey" FOREIGN KEY ("opsAssigneeId") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_hotels" ADD CONSTRAINT "booking_hotels_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_hotels" ADD CONSTRAINT "booking_hotels_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_hotels" ADD CONSTRAINT "booking_hotels_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cabs" ADD CONSTRAINT "booking_cabs_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_cabs" ADD CONSTRAINT "booking_cabs_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "team_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_booking_hotel" ADD CONSTRAINT "package_booking_hotel_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_booking_hotel" ADD CONSTRAINT "package_booking_hotel_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_timeline" ADD CONSTRAINT "booking_timeline_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_timeline" ADD CONSTRAINT "booking_timeline_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_timeline" ADD CONSTRAINT "booking_timeline_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subregions_all" ADD CONSTRAINT "subregions_all_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions_all"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries_all" ADD CONSTRAINT "countries_all_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions_all"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "countries_all" ADD CONSTRAINT "countries_all_subregion_id_fkey" FOREIGN KEY ("subregion_id") REFERENCES "subregions_all"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "states_all" ADD CONSTRAINT "states_all_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries_all"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities_all" ADD CONSTRAINT "cities_all_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries_all"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities_all" ADD CONSTRAINT "cities_all_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states_all"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_teamRoleId_fkey" FOREIGN KEY ("teamRoleId") REFERENCES "team_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_queries" ADD CONSTRAINT "package_queries_leadProfileId_fkey" FOREIGN KEY ("leadProfileId") REFERENCES "lead_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_queries" ADD CONSTRAINT "package_queries_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "rejection_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_notes" ADD CONSTRAINT "query_notes_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "package_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "query_timeline" ADD CONSTRAINT "query_timeline_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "package_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_room_images" ADD CONSTRAINT "hotel_room_images_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_rooms" ADD CONSTRAINT "hotel_rooms_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_activities" ADD CONSTRAINT "itinerary_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_activities" ADD CONSTRAINT "itinerary_activities_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "package_itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_notes" ADD CONSTRAINT "itinerary_notes_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "package_itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_stays" ADD CONSTRAINT "itinerary_stays_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "package_itineraries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_stays" ADD CONSTRAINT "itinerary_stays_room_pricing_id_fkey" FOREIGN KEY ("room_pricing_id") REFERENCES "hotel_room_pricing"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_stays" ADD CONSTRAINT "itinerary_stays_stay_category_id_fkey" FOREIGN KEY ("stay_category_id") REFERENCES "package_stay_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "itinerary_transfers" ADD CONSTRAINT "itinerary_transfers_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "package_itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_gallery" ADD CONSTRAINT "package_gallery_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_routes" ADD CONSTRAINT "package_routes_duration_id_fkey" FOREIGN KEY ("duration_id") REFERENCES "package_durations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_routes" ADD CONSTRAINT "package_routes_packagesId_fkey" FOREIGN KEY ("packagesId") REFERENCES "packages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "route_stops" ADD CONSTRAINT "route_stops_route_id_fkey" FOREIGN KEY ("route_id") REFERENCES "package_routes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
