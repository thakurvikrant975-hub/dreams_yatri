-- AlterTable
ALTER TABLE "custom_packages" ADD COLUMN     "readyAt" TIMESTAMP(3),
ADD COLUMN     "readyBy" TEXT,
ADD COLUMN     "readyByName" TEXT,
ADD COLUMN     "execNotifiedAt" TIMESTAMP(3),
ADD COLUMN     "followUpAutoCreated" BOOLEAN NOT NULL DEFAULT false;
