-- Lets a sales exec pull an already-verified package back for another
-- costing look, with a free-text note explaining what needs revisiting.
ALTER TABLE "custom_packages" ADD COLUMN "revisionRequestedAt" TIMESTAMP(3);
ALTER TABLE "custom_packages" ADD COLUMN "revisionRequestedBy" TEXT;
ALTER TABLE "custom_packages" ADD COLUMN "revisionRequestedByName" TEXT;
ALTER TABLE "custom_packages" ADD COLUMN "revisionNote" TEXT;
