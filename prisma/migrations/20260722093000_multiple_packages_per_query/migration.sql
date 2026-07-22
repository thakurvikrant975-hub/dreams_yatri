-- DropIndex
DROP INDEX IF EXISTS "custom_packages_queryId_key";

-- AlterTable
ALTER TABLE "custom_packages" ALTER COLUMN "queryId" DROP NOT NULL;
