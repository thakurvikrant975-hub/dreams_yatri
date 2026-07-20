-- Adds short, removable bullet-list fields for common per-package policy
-- content (terms & conditions, payment policy, amendment policy) and a new
-- "Benefits of Travelling With Us" marketing list, editable/removable in the
-- package builder the same way inclusions/exclusions already are.
ALTER TABLE "custom_packages"
  ADD COLUMN "termsConditions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "paymentPolicy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "amendmentPolicy" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "travelBenefits" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
