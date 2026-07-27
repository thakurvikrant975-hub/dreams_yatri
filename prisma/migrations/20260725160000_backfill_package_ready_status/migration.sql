-- Backfill for the costing-review workflow added in
-- 20260725150000_add_package_ready_workflow.
--
-- readyAt was added with no default and no backfill, so every package that
-- was already SENT before that migration ran has readyAt = NULL. Both the
-- Verify Packages queue (filtered on readyAt IS NOT NULL) and its detail
-- page (404s when readyAt is NULL) key off that column, so those packages
-- would otherwise silently disappear from the costing team's queue and
-- history. Using sentAt as the readyAt value is the closest true fact we
-- have for these rows — under the old flow, a package was reviewed/ready
-- at essentially the same moment it was sent.
UPDATE "custom_packages"
SET "readyAt" = "sentAt"
WHERE "sentAt" IS NOT NULL AND "readyAt" IS NULL;

-- followUpAutoCreated also defaulted to false for every existing row, so the
-- package-followups cron (checks in 1h after send) would otherwise treat
-- every package ever sent, no matter how long ago, as newly eligible the
-- first time it runs and flood execs with "sent 1 hour ago" reminders for
-- old sends. Anything already sent more than an hour ago is long past that
-- window and should be treated as already handled.
UPDATE "custom_packages"
SET "followUpAutoCreated" = true
WHERE "sentAt" IS NOT NULL
  AND "sentAt" <= NOW() - INTERVAL '1 hour'
  AND "followUpAutoCreated" = false;
