-- CreateEnum
CREATE TYPE "ReopenRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "query_reopen_requests" (
    "id" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReopenRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNote" TEXT,
    "rejectionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "query_reopen_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "query_reopen_requests_status_idx" ON "query_reopen_requests"("status");

-- CreateIndex
CREATE INDEX "query_reopen_requests_queryId_idx" ON "query_reopen_requests"("queryId");

-- CreateIndex
CREATE INDEX "query_reopen_requests_requestedById_idx" ON "query_reopen_requests"("requestedById");
