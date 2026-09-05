-- AlterTable
ALTER TABLE "lead_requests" ADD COLUMN "source" "QuerySource" NOT NULL DEFAULT 'PHONE_CALL',
ADD COLUMN "sourceOther" TEXT;
