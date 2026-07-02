-- CreateEnum
CREATE TYPE "PermitCategory" AS ENUM ('ENTRY_FEE', 'MOUNTAIN_PASS', 'WILDLIFE', 'BORDER_AREA', 'NATIONAL_PARK', 'FOREST', 'OTHER');

-- CreateEnum
CREATE TYPE "PermitValidityType" AS ENUM ('SINGLE_TRIP', 'PER_DAY', 'MULTI_DAY');

-- CreateTable
CREATE TABLE "permits" (
    "id"                  SERIAL          NOT NULL,
    "name"                TEXT            NOT NULL,
    "category"            "PermitCategory" NOT NULL DEFAULT 'OTHER',
    "location_id"         BIGINT,
    "issuing_authority"   TEXT,
    "price_per_vehicle"   DECIMAL(10,2)   NOT NULL DEFAULT 0,
    "price_per_person"    DECIMAL(10,2),
    "validity_type"       "PermitValidityType" NOT NULL DEFAULT 'SINGLE_TRIP',
    "validity_days"       INTEGER,
    "notes"               TEXT,
    "is_active"           BOOLEAN         NOT NULL DEFAULT true,
    "created_by"          TEXT,
    "updated_by"          TEXT,
    "created_at"          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP(3)    NOT NULL,

    CONSTRAINT "permits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "permits_location_id_idx"  ON "permits"("location_id");
CREATE INDEX "permits_category_idx"     ON "permits"("category");
CREATE INDEX "permits_is_active_idx"    ON "permits"("is_active");

-- AddForeignKey
ALTER TABLE "permits"
  ADD CONSTRAINT "permits_location_id_fkey"
  FOREIGN KEY ("location_id") REFERENCES "locations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
