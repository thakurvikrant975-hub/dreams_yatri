-- Stay options get their own names.
--
-- The fixed Standard/Deluxe/Premium ladder could not express the distinction an
-- exec actually quotes against — "same class, better view", "Beachfront" — so
-- the enum becomes free text with those three offered as suggestions. Ordering
-- moves to an explicit column, since names no longer imply an order.
--
-- Written as add-backfill-drop rather than a type change so the existing rows
-- keep their meaning: a STANDARD row becomes "Standard", in first position.

-- AlterTable
ALTER TABLE "custom_package_stay_options" ADD COLUMN "label" TEXT;
ALTER TABLE "custom_package_stay_options" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "custom_package_stay_options"
SET "label" = CASE "category"::text
        WHEN 'STANDARD' THEN 'Standard'
        WHEN 'DELUXE'   THEN 'Deluxe'
        WHEN 'PREMIUM'  THEN 'Premium'
        ELSE 'Standard'
    END,
    "sortOrder" = CASE "category"::text
        WHEN 'STANDARD' THEN 0
        WHEN 'DELUXE'   THEN 1
        WHEN 'PREMIUM'  THEN 2
        ELSE 0
    END;

ALTER TABLE "custom_package_stay_options" ALTER COLUMN "label" SET NOT NULL;

-- DropIndex / DropColumn / DropEnum
DROP INDEX IF EXISTS "custom_package_stay_options_customPackageId_category_key";
ALTER TABLE "custom_package_stay_options" DROP COLUMN "category";
DROP TYPE IF EXISTS "StayCategory";

-- CreateIndex
CREATE UNIQUE INDEX "custom_package_stay_options_customPackageId_label_key" ON "custom_package_stay_options"("customPackageId", "label");
