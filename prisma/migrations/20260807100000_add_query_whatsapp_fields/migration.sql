-- Add optional WhatsApp number (separate from phone) to package_queries.
ALTER TABLE "package_queries" ADD COLUMN "whatsapp" TEXT;
ALTER TABLE "package_queries" ADD COLUMN "whatsappSameAsPhone" BOOLEAN NOT NULL DEFAULT true;

-- Index for live duplicate-phone lookups while typing in Add Query.
CREATE INDEX "package_queries_phone_idx" ON "package_queries"("phone");
