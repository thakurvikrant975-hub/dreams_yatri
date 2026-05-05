/*
  Warnings:

  - The values [PENDING_REVIEW,REJECTED] on the enum `BookingStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [SUCCESS,FAILED] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - The values [ACTIVE] on the enum `QueryStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "BookingStatus_new" AS ENUM ('CONFIRMED', 'OPS_REVIEW', 'HOTEL_VERIFICATION', 'HOTEL_CONFIRMED', 'CAB_VERIFICATION', 'CAB_CONFIRMED', 'ALL_CONFIRMED', 'UPCOMING', 'ONGOING', 'COMPLETED', 'MODIFICATION_REQUESTED', 'CANCELLED');
ALTER TABLE "public"."bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
ALTER TABLE "booking_timeline" ALTER COLUMN "fromStatus" TYPE "BookingStatus_new" USING ("fromStatus"::text::"BookingStatus_new");
ALTER TABLE "booking_timeline" ALTER COLUMN "toStatus" TYPE "BookingStatus_new" USING ("toStatus"::text::"BookingStatus_new");
ALTER TYPE "BookingStatus" RENAME TO "BookingStatus_old";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
DROP TYPE "public"."BookingStatus_old";
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'ADVANCE_PAID', 'FULLY_PAID', 'REFUNDED', 'PARTIALLY_REFUNDED');
ALTER TABLE "public"."bookings" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "public"."payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "bookings" ALTER COLUMN "paymentStatus" SET DEFAULT 'PENDING';
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "QueryStatus_new" AS ENUM ('SUBMITTED', 'VERIFIED', 'REJECTED', 'ASSIGNED', 'IN_PROGRESS', 'PACKAGE_SENT', 'CLIENT_ACCEPTED', 'CLIENT_DECLINED', 'PAYMENT_INITIATED', 'CONVERTED', 'CLOSED');
ALTER TABLE "public"."package_queries" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "package_queries" ALTER COLUMN "status" TYPE "QueryStatus_new" USING ("status"::text::"QueryStatus_new");
ALTER TYPE "QueryStatus" RENAME TO "QueryStatus_old";
ALTER TYPE "QueryStatus_new" RENAME TO "QueryStatus";
DROP TYPE "public"."QueryStatus_old";
ALTER TABLE "package_queries" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
COMMIT;

-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'CONFIRMED';
