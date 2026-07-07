-- AlterTable
ALTER TABLE "hotel_owners"
  ADD COLUMN "email_verified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "email_verification_token" TEXT,
  ADD COLUMN "email_verification_expires" TIMESTAMP(3),
  ADD COLUMN "password_reset_token" TEXT,
  ADD COLUMN "password_reset_expires" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_owners_email_verification_token_key" ON "hotel_owners"("email_verification_token");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_owners_password_reset_token_key" ON "hotel_owners"("password_reset_token");
