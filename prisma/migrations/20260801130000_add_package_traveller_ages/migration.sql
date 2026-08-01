-- Per-traveller ages for children/infants on a custom package — costing
-- needs the actual age, not just the count, to check hotel child-policy
-- brackets against what's been priced in.
ALTER TABLE "custom_packages" ADD COLUMN "childrenAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "custom_packages" ADD COLUMN "infantAges" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[];
