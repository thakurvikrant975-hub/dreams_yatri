-- The Google Ads mirror: what the Ads API says about our account, copied by a
-- scheduled sync so reports can join spend to leads and bookings. New tables
-- only — nothing existing is altered, and no foreign key reaches package_queries
-- (a lead naming an unsynced campaign must still insert). Conventions are in the
-- schema's "Google Ads mirror" block; plan in docs/ads-analytics.

-- CreateEnum
CREATE TYPE "AdsSyncKind" AS ENUM ('STRUCTURE', 'STATS');

-- CreateEnum
CREATE TYPE "AdsSyncStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "google_ads_accounts" (
    "id" VARCHAR(32) NOT NULL,
    "managerId" VARCHAR(32),
    "name" TEXT NOT NULL,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "currencyCode" VARCHAR(3) NOT NULL,
    "timeZone" VARCHAR(64) NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ads_budgets" (
    "id" VARCHAR(32) NOT NULL,
    "accountId" VARCHAR(32) NOT NULL,
    "name" TEXT,
    "amountMicros" BIGINT,
    "totalAmountMicros" BIGINT,
    "period" VARCHAR(32) NOT NULL,
    "deliveryMethod" VARCHAR(32) NOT NULL,
    "isShared" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(32) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_budgets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ads_budget_history" (
    "id" TEXT NOT NULL,
    "budgetId" VARCHAR(32) NOT NULL,
    "amountMicros" BIGINT,
    "totalAmountMicros" BIGINT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "google_ads_budget_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ads_campaigns" (
    "id" VARCHAR(32) NOT NULL,
    "accountId" VARCHAR(32) NOT NULL,
    "budgetId" VARCHAR(32),
    "name" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "channelType" VARCHAR(32) NOT NULL,
    "biddingStrategyType" VARCHAR(64),
    "startDate" DATE,
    "endDate" DATE,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ads_ad_groups" (
    "id" VARCHAR(32) NOT NULL,
    "campaignId" VARCHAR(32) NOT NULL,
    "name" TEXT NOT NULL,
    "status" VARCHAR(32) NOT NULL,
    "type" VARCHAR(64),
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_ad_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "google_ads_ads" (
    "adGroupId" VARCHAR(32) NOT NULL,
    "id" VARCHAR(32) NOT NULL,
    "type" VARCHAR(64),
    "status" VARCHAR(32) NOT NULL,
    "finalUrl" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_ads_pkey" PRIMARY KEY ("adGroupId","id")
);

-- CreateTable
CREATE TABLE "google_ads_campaign_daily" (
    "campaignId" VARCHAR(32) NOT NULL,
    "date" DATE NOT NULL,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conversionsValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "searchImpressionShare" DECIMAL(5,4),
    "searchBudgetLostImpressionShare" DECIMAL(5,4),
    "searchRankLostImpressionShare" DECIMAL(5,4),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_campaign_daily_pkey" PRIMARY KEY ("campaignId","date")
);

-- CreateTable
CREATE TABLE "google_ads_ad_group_daily" (
    "adGroupId" VARCHAR(32) NOT NULL,
    "date" DATE NOT NULL,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conversionsValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_ad_group_daily_pkey" PRIMARY KEY ("adGroupId","date")
);

-- CreateTable
CREATE TABLE "google_ads_ad_daily" (
    "adGroupId" VARCHAR(32) NOT NULL,
    "adId" VARCHAR(32) NOT NULL,
    "date" DATE NOT NULL,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "conversionsValue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_ad_daily_pkey" PRIMARY KEY ("adGroupId","adId","date")
);

-- CreateTable
CREATE TABLE "google_ads_campaign_hourly" (
    "campaignId" VARCHAR(32) NOT NULL,
    "date" DATE NOT NULL,
    "hour" SMALLINT NOT NULL,
    "costMicros" BIGINT NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "conversions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_ads_campaign_hourly_pkey" PRIMARY KEY ("campaignId","date","hour")
);

-- CreateTable
CREATE TABLE "ads_sync_runs" (
    "id" TEXT NOT NULL,
    "platform" VARCHAR(16) NOT NULL,
    "kind" "AdsSyncKind" NOT NULL,
    "status" "AdsSyncStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "windowFrom" DATE,
    "windowTo" DATE,
    "rowsWritten" INTEGER NOT NULL DEFAULT 0,
    "details" JSONB,
    "error" TEXT,

    CONSTRAINT "ads_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "google_ads_budgets_accountId_idx" ON "google_ads_budgets"("accountId");

-- CreateIndex
CREATE INDEX "google_ads_budget_history_budgetId_validFrom_idx" ON "google_ads_budget_history"("budgetId", "validFrom");

-- CreateIndex
CREATE INDEX "google_ads_campaigns_accountId_status_idx" ON "google_ads_campaigns"("accountId", "status");

-- CreateIndex
CREATE INDEX "google_ads_campaigns_budgetId_idx" ON "google_ads_campaigns"("budgetId");

-- CreateIndex
CREATE INDEX "google_ads_ad_groups_campaignId_status_idx" ON "google_ads_ad_groups"("campaignId", "status");

-- CreateIndex
CREATE INDEX "google_ads_campaign_daily_date_idx" ON "google_ads_campaign_daily"("date");

-- CreateIndex
CREATE INDEX "google_ads_ad_group_daily_date_idx" ON "google_ads_ad_group_daily"("date");

-- CreateIndex
CREATE INDEX "google_ads_ad_daily_date_idx" ON "google_ads_ad_daily"("date");

-- CreateIndex
CREATE INDEX "google_ads_campaign_hourly_date_idx" ON "google_ads_campaign_hourly"("date");

-- CreateIndex
CREATE INDEX "ads_sync_runs_platform_kind_startedAt_idx" ON "ads_sync_runs"("platform", "kind", "startedAt");

-- AddForeignKey
ALTER TABLE "google_ads_budgets" ADD CONSTRAINT "google_ads_budgets_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "google_ads_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_budget_history" ADD CONSTRAINT "google_ads_budget_history_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "google_ads_budgets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_campaigns" ADD CONSTRAINT "google_ads_campaigns_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "google_ads_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_campaigns" ADD CONSTRAINT "google_ads_campaigns_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "google_ads_budgets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_ad_groups" ADD CONSTRAINT "google_ads_ad_groups_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "google_ads_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_ads" ADD CONSTRAINT "google_ads_ads_adGroupId_fkey" FOREIGN KEY ("adGroupId") REFERENCES "google_ads_ad_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_campaign_daily" ADD CONSTRAINT "google_ads_campaign_daily_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "google_ads_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_ad_group_daily" ADD CONSTRAINT "google_ads_ad_group_daily_adGroupId_fkey" FOREIGN KEY ("adGroupId") REFERENCES "google_ads_ad_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_ad_daily" ADD CONSTRAINT "google_ads_ad_daily_adGroupId_adId_fkey" FOREIGN KEY ("adGroupId", "adId") REFERENCES "google_ads_ads"("adGroupId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "google_ads_campaign_hourly" ADD CONSTRAINT "google_ads_campaign_hourly_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "google_ads_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

