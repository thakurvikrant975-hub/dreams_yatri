-- Which ad produced a lead, recorded on the lead itself.
--
-- Until now a lead could be credited to Google (via `gclid`) but never to a
-- campaign or an ad group, so "which ad group converts" was unanswerable. The
-- ids are captured at write time from the ValueTrack parameters Google appends
-- through the account's final URL suffix, because resolving a click id back to
-- its ad group afterwards works for 90 days at most and not for every campaign
-- type — a lead untagged on arrival can never be attributed later.
--
-- All nullable with no backfill: existing rows keep their current attribution,
-- `gclid` is untouched and still written, and nothing that reads this table
-- changes behaviour.

-- AlterTable
ALTER TABLE "package_queries" ADD COLUMN "adsPlatform" VARCHAR(16),
ADD COLUMN "adsCampaignId" VARCHAR(32),
ADD COLUMN "adsAdGroupId" VARCHAR(32),
ADD COLUMN "adsCreativeId" VARCHAR(32),
ADD COLUMN "adsKeyword" VARCHAR(255),
ADD COLUMN "adsMatchType" VARCHAR(16),
ADD COLUMN "adsNetwork" VARCHAR(16),
ADD COLUMN "adsDevice" VARCHAR(16),
ADD COLUMN "adsTargetId" VARCHAR(64),
ADD COLUMN "adsClickId" VARCHAR(255),
ADD COLUMN "adsClickIdType" VARCHAR(16),
ADD COLUMN "adsClickAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "package_queries_adsCampaignId_createdAt_idx" ON "package_queries"("adsCampaignId", "createdAt");

-- CreateIndex
CREATE INDEX "package_queries_adsAdGroupId_createdAt_idx" ON "package_queries"("adsAdGroupId", "createdAt");

-- CreateIndex
CREATE INDEX "package_queries_adsClickId_idx" ON "package_queries"("adsClickId");
