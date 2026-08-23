-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('UNATTENDED_LEAD', 'PACKAGE_SEND_DELAY', 'MISSED_FOLLOW_UP', 'LATE_LOGIN', 'LOGIN_APPROVAL_REQUEST', 'DASHBOARD_INACTIVITY', 'TARGET_SHORTFALL');

-- AlterTable
ALTER TABLE "package_queries" ADD COLUMN "isHot" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "firstRespondedAt" TIMESTAMP(3),
ADD COLUMN "firstPackageSentAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "team_notifications" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "severity" "LogSeverity" NOT NULL DEFAULT 'MEDIUM',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "team_notifications_memberId_createdAt_idx" ON "team_notifications"("memberId", "createdAt");

-- CreateIndex
CREATE INDEX "team_notifications_memberId_readAt_idx" ON "team_notifications"("memberId", "readAt");

-- AddForeignKey
ALTER TABLE "team_notifications" ADD CONSTRAINT "team_notifications_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
