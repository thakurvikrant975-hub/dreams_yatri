-- CreateEnum
CREATE TYPE "LoginApprovalReason" AS ENUM ('LATE_LOGIN', 'AUTO_LOGOUT');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED');

-- AlterTable
ALTER TABLE "team_members" ADD COLUMN     "lastHeartbeatAt" TIMESTAMP(3),
ADD COLUMN     "pendingReloginApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "attendance" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "loginAt" TIMESTAMP(3),
    "logoutAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_approval_requests" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "reason" "LoginApprovalReason" NOT NULL,
    "forDate" TIMESTAMP(3) NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "note" TEXT,

    CONSTRAINT "login_approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_date_idx" ON "attendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_memberId_date_key" ON "attendance"("memberId", "date");

-- CreateIndex
CREATE INDEX "login_approval_requests_status_idx" ON "login_approval_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "login_approval_requests_memberId_forDate_reason_key" ON "login_approval_requests"("memberId", "forDate", "reason");

-- AddForeignKey
ALTER TABLE "attendance" ADD CONSTRAINT "attendance_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_approval_requests" ADD CONSTRAINT "login_approval_requests_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
