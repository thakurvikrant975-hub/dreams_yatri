-- AlterTable
ALTER TABLE "custom_packages" ADD COLUMN     "rejectedAt" TIMESTAMP(3),
ADD COLUMN     "rejectedBy" TEXT,
ADD COLUMN     "rejectedByName" TEXT,
ADD COLUMN     "rejectionReasonId" TEXT,
ADD COLUMN     "rejectionNote" TEXT;

-- CreateIndex
CREATE INDEX "custom_packages_rejectionReasonId_idx" ON "custom_packages"("rejectionReasonId");

-- AddForeignKey
ALTER TABLE "custom_packages" ADD CONSTRAINT "custom_packages_rejectionReasonId_fkey" FOREIGN KEY ("rejectionReasonId") REFERENCES "rejection_reasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
