-- CreateEnum
CREATE TYPE "TemplateApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "package_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "destination" TEXT,
    "coverImage" TEXT,
    "totalDays" INTEGER NOT NULL,
    "totalNights" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "sourcePackageId" TEXT,
    "sourcePackageTitle" TEXT,
    "submittedById" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedByTeamId" TEXT,
    "submittedByTeamName" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TemplateApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "photo" TEXT,
    "photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "photoLabels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "day" INTEGER NOT NULL,
    "destination" TEXT,
    "packageTemplateId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "submittedByName" TEXT NOT NULL,
    "submittedByTeamId" TEXT,
    "submittedByTeamName" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "TemplateApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedByName" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedById" TEXT,
    "rejectedByName" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_templates_status_idx" ON "package_templates"("status");

-- CreateIndex
CREATE INDEX "package_templates_submittedById_idx" ON "package_templates"("submittedById");

-- CreateIndex
CREATE INDEX "package_templates_submittedByTeamId_idx" ON "package_templates"("submittedByTeamId");

-- CreateIndex
CREATE INDEX "activity_templates_status_idx" ON "activity_templates"("status");

-- CreateIndex
CREATE INDEX "activity_templates_submittedById_idx" ON "activity_templates"("submittedById");

-- CreateIndex
CREATE INDEX "activity_templates_submittedByTeamId_idx" ON "activity_templates"("submittedByTeamId");

-- CreateIndex
CREATE INDEX "activity_templates_packageTemplateId_idx" ON "activity_templates"("packageTemplateId");

-- AddForeignKey
ALTER TABLE "activity_templates" ADD CONSTRAINT "activity_templates_packageTemplateId_fkey" FOREIGN KEY ("packageTemplateId") REFERENCES "package_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
