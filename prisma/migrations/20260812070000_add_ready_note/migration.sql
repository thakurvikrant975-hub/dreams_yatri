-- Optional message the sales exec leaves for costing when submitting a
-- package for review ("Mark Ready"), shown on verify-packages.
ALTER TABLE "custom_packages" ADD COLUMN "readyNote" TEXT;
