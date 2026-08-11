-- Soft-delete for package_queries: "Delete Query" hides the row instead of
-- removing it, so history is retained and existing FK references (booking,
-- custom_packages) keep resolving normally.
ALTER TABLE "package_queries" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "package_queries" ADD COLUMN "deletedBy" TEXT;

CREATE INDEX "package_queries_deletedAt_idx" ON "package_queries"("deletedAt");
