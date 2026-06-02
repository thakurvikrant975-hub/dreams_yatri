-- Phase 2.5: payment idempotency + audit hardening.
-- payments table verified empty / no duplicate gatewayOrderId before adding uniques.

ALTER TABLE "payments" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "payments" ADD COLUMN "rawResponse" JSONB;
ALTER TABLE "payments" ADD COLUMN "webhookEventId" TEXT;

-- gatewayOrderId: drop the old non-unique index, replace with a unique one.
DROP INDEX IF EXISTS "payments_gatewayOrderId_idx";
CREATE UNIQUE INDEX "payments_gatewayOrderId_key" ON "payments"("gatewayOrderId");
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");
CREATE INDEX "payments_webhookEventId_idx" ON "payments"("webhookEventId");
