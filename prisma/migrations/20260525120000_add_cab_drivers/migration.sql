-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('FIXED_MONTHLY', 'PER_TRIP', 'PER_DAY', 'COMMISSION');

-- CreateTable
CREATE TABLE "cab_drivers" (
    "id"                    SERIAL NOT NULL,
    "name"                  TEXT NOT NULL,
    "mobile"                TEXT NOT NULL,
    "mobile_secondary"      TEXT,
    "profile_image_key"     TEXT,
    "city"                  TEXT,
    "state"                 TEXT,
    "vehicle_id"            INTEGER,
    "license_number"        TEXT,
    "license_expiry"        TIMESTAMP(3),
    "license_image_key"     TEXT,
    "vehicle_reg_number"    TEXT,
    "vehicle_reg_expiry"    TIMESTAMP(3),
    "insurance_expiry"      TIMESTAMP(3),
    "vehicle_image_keys"    TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bank_name"             TEXT,
    "bank_account_number"   TEXT,
    "bank_ifsc"             TEXT,
    "bank_account_holder"   TEXT,
    "upi_id"                TEXT,
    "salary_type"           "SalaryType",
    "salary_amount"         DECIMAL(10,2),
    "is_active"             BOOLEAN NOT NULL DEFAULT true,
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cab_drivers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cab_drivers_vehicle_id_idx" ON "cab_drivers"("vehicle_id");

-- AddForeignKey
ALTER TABLE "cab_drivers" ADD CONSTRAINT "cab_drivers_vehicle_id_fkey"
    FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
