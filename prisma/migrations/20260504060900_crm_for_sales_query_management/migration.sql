-- CreateTable
CREATE TABLE "SalesQuery" (
    "id" TEXT NOT NULL,
    "packageQueryId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'IN',
    "packageName" TEXT,
    "destination" TEXT,
    "travelDate" TIMESTAMP(3),
    "groupSize" INTEGER,
    "message" TEXT,
    "source" TEXT NOT NULL DEFAULT 'WEBSITE_FORM',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "assignedTo" TEXT,
    "assignedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3),
    "closeReasonId" TEXT,
    "closeReasonOther" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQueryFollowUp" (
    "id" TEXT NOT NULL,
    "salesQueryId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "followUpAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesQueryFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQueryNote" (
    "id" TEXT NOT NULL,
    "salesQueryId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesQueryNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQueryTimeline" (
    "id" TEXT NOT NULL,
    "salesQueryId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesQueryTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesQuery_assignedTo_idx" ON "SalesQuery"("assignedTo");

-- CreateIndex
CREATE INDEX "SalesQuery_status_idx" ON "SalesQuery"("status");

-- CreateIndex
CREATE INDEX "SalesQueryFollowUp_salesQueryId_idx" ON "SalesQueryFollowUp"("salesQueryId");

-- CreateIndex
CREATE INDEX "SalesQueryNote_salesQueryId_idx" ON "SalesQueryNote"("salesQueryId");

-- CreateIndex
CREATE INDEX "SalesQueryTimeline_salesQueryId_idx" ON "SalesQueryTimeline"("salesQueryId");

-- AddForeignKey
ALTER TABLE "SalesQueryFollowUp" ADD CONSTRAINT "SalesQueryFollowUp_salesQueryId_fkey" FOREIGN KEY ("salesQueryId") REFERENCES "SalesQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQueryNote" ADD CONSTRAINT "SalesQueryNote_salesQueryId_fkey" FOREIGN KEY ("salesQueryId") REFERENCES "SalesQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQueryTimeline" ADD CONSTRAINT "SalesQueryTimeline_salesQueryId_fkey" FOREIGN KEY ("salesQueryId") REFERENCES "SalesQuery"("id") ON DELETE CASCADE ON UPDATE CASCADE;
