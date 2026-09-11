-- CreateEnum
CREATE TYPE "FollowUpStatus" AS ENUM ('PENDING', 'COMPLETED', 'RESCHEDULED', 'MISSED', 'CANCELLED');

-- AlterTable
ALTER TABLE "QueryFollowUp"
  ADD COLUMN "status" "FollowUpStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "resolvedAt" TIMESTAMP(3),
  ADD COLUMN "resolutionNote" TEXT,
  ADD COLUMN "previousId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "QueryFollowUp_previousId_key" ON "QueryFollowUp"("previousId");

-- CreateIndex
CREATE INDEX "QueryFollowUp_status_idx" ON "QueryFollowUp"("status");

-- AddForeignKey
ALTER TABLE "QueryFollowUp" ADD CONSTRAINT "QueryFollowUp_previousId_fkey" FOREIGN KEY ("previousId") REFERENCES "QueryFollowUp"("id") ON DELETE SET NULL ON UPDATE CASCADE;
