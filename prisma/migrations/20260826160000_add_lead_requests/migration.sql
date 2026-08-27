-- CreateEnum
CREATE TYPE "LeadRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "lead_requests" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20) NOT NULL,
    "email" TEXT,
    "destination" TEXT NOT NULL,
    "status" "LeadRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requestedById" TEXT NOT NULL,
    "requestedByName" TEXT NOT NULL,
    "rejectionReason" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "decidedByName" TEXT,
    "resultingQueryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lead_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lead_requests_status_idx" ON "lead_requests"("status");

-- CreateIndex
CREATE INDEX "lead_requests_requestedById_idx" ON "lead_requests"("requestedById");

-- CreateIndex
CREATE INDEX "lead_requests_phone_idx" ON "lead_requests"("phone");
