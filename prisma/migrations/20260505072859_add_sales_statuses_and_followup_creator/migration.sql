-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "QueryStatus" ADD VALUE 'ACTIVE';
ALTER TYPE "QueryStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "QueryFollowUp" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "createdByName" TEXT;

-- CreateIndex
CREATE INDEX "QueryFollowUp_createdById_idx" ON "QueryFollowUp"("createdById");
