-- Document templates and theme overrides.
--
-- Two layers, deliberately different in their defaults:
--
--   itinerary_settings — the house template every package inherits. NOT NULL
--   with a default, because there is always exactly one singleton row and it
--   always has to resolve to something renderable.
--
--   custom_packages — the per-package override. Nullable, and specifically NOT
--   defaulted to 'classic': a NULL here means "follow the house default", so
--   changing the company template later restyles every package that never made
--   an explicit choice. Backfilling 'classic' would freeze all existing
--   packages onto today's default forever and silently break that.
--
-- Both additive and nullable-or-defaulted, so this is safe to apply while the
-- builder is in use — in-flight packages keep rendering on the house template
-- until someone picks something else.
ALTER TABLE "itinerary_settings" ADD COLUMN "defaultTemplate" TEXT NOT NULL DEFAULT 'classic';
ALTER TABLE "itinerary_settings" ADD COLUMN "themeOverrides" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "custom_packages" ADD COLUMN "template" TEXT;
ALTER TABLE "custom_packages" ADD COLUMN "themeOverrides" JSONB;
