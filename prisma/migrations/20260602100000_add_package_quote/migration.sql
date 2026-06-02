-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "QuoteStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONSUMED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "package_quote" (
  "id" TEXT NOT NULL,
  "package_id" INTEGER NOT NULL,
  "duration_id" INTEGER NOT NULL,
  "route_id" INTEGER NOT NULL,
  "stay_category_id" INTEGER NOT NULL,
  "package_slug" TEXT NOT NULL,
  "duration_slug" TEXT NOT NULL,
  "route_slug" TEXT NOT NULL,
  "stay_slug" TEXT NOT NULL,
  "adults" INTEGER NOT NULL,
  "children" INTEGER NOT NULL DEFAULT 0,
  "infants" INTEGER NOT NULL DEFAULT 0,
  "child_ages" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "cab_type_ids" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  "travel_date" TIMESTAMP(3) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "breakdown" JSONB NOT NULL,
  "base_cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "margin_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "gst_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total_amount" DECIMAL(10,2) NOT NULL,
  "price_per_adult" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "inputs_hash" TEXT NOT NULL,
  "signature" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3) NOT NULL,
  "user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "package_quote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "package_quote_package_id_idx" ON "package_quote"("package_id");
CREATE INDEX IF NOT EXISTS "package_quote_status_idx" ON "package_quote"("status");
CREATE INDEX IF NOT EXISTS "package_quote_expires_at_idx" ON "package_quote"("expires_at");
CREATE INDEX IF NOT EXISTS "package_quote_inputs_hash_idx" ON "package_quote"("inputs_hash");
CREATE INDEX IF NOT EXISTS "package_quote_user_id_idx" ON "package_quote"("user_id");
