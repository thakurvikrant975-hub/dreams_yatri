-- AlterEnum
ALTER TYPE "QuerySource" ADD VALUE IF NOT EXISTS 'META';

-- AlterTable
ALTER TABLE "custom_package_tickets" DROP COLUMN IF EXISTS "dropPoint",
DROP COLUMN IF EXISTS "pickupPoint";

-- AlterTable
ALTER TABLE "custom_packages" ALTER COLUMN "termsConditions" DROP DEFAULT,
ALTER COLUMN "paymentPolicy" DROP DEFAULT,
ALTER COLUMN "amendmentPolicy" DROP DEFAULT,
ALTER COLUMN "travelBenefits" DROP DEFAULT;
