/*
  Warnings:

  - You are about to drop the `SalesQuery` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesQueryFollowUp` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesQueryNote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SalesQueryTimeline` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "SalesQueryFollowUp" DROP CONSTRAINT "SalesQueryFollowUp_salesQueryId_fkey";

-- DropForeignKey
ALTER TABLE "SalesQueryNote" DROP CONSTRAINT "SalesQueryNote_salesQueryId_fkey";

-- DropForeignKey
ALTER TABLE "SalesQueryTimeline" DROP CONSTRAINT "SalesQueryTimeline_salesQueryId_fkey";

-- AlterTable
ALTER TABLE "package_queries" ADD COLUMN     "closeReasonId" TEXT,
ADD COLUMN     "closeReasonOther" TEXT,
ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedBy" TEXT;

-- DropTable
DROP TABLE "SalesQuery";

-- DropTable
DROP TABLE "SalesQueryFollowUp";

-- DropTable
DROP TABLE "SalesQueryNote";

-- DropTable
DROP TABLE "SalesQueryTimeline";

-- CreateTable
CREATE TABLE "QueryFollowUp" (
    "id" TEXT NOT NULL,
    "packageQueryId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueryFollowUp_packageQueryId_idx" ON "QueryFollowUp"("packageQueryId");

-- AddForeignKey
ALTER TABLE "QueryFollowUp" ADD CONSTRAINT "QueryFollowUp_packageQueryId_fkey" FOREIGN KEY ("packageQueryId") REFERENCES "package_queries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
