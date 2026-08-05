-- Costing-team per-package vetoes of standard inclusion/exclusion lines,
-- reviewed on verify-packages — see the schema comment on custom_packages.
ALTER TABLE "custom_packages" ADD COLUMN "removedInclusions" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "custom_packages" ADD COLUMN "removedExclusions" TEXT[] NOT NULL DEFAULT '{}';
