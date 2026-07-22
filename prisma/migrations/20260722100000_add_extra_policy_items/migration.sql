-- AlterTable
ALTER TABLE "custom_packages" ADD COLUMN "extraPolicyItems" JSONB NOT NULL DEFAULT '{}';
