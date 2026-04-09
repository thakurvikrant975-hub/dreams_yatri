-- AlterTable
ALTER TABLE "Otp" ADD COLUMN     "email" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Otp_email_idx" ON "Otp"("email");
