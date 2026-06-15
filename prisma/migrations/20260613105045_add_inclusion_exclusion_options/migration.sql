-- Reusable library of package inclusion/exclusion phrases with usage tracking.
CREATE TABLE "inclusion_exclusion_options" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "usage_count" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "inclusion_exclusion_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inclusion_exclusion_options_type_text_key" ON "inclusion_exclusion_options"("type", "text");

CREATE INDEX "inclusion_exclusion_options_type_usage_count_idx" ON "inclusion_exclusion_options"("type", "usage_count");
