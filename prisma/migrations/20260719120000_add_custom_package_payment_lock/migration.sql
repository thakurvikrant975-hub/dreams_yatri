-- Adds a manual per-package payment link (client-facing "Pay Now" target) and
-- a frozen pricing breakdown snapshot (hotel/cab/ticket/margin/GST), written
-- once when the package is sent to the client, so pricing can be rechecked
-- later independent of any subsequent catalog rate changes.
ALTER TABLE "custom_packages"
  ADD COLUMN "paymentLink" TEXT,
  ADD COLUMN "pricingSnapshot" JSONB;
