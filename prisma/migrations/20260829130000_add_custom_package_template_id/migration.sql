-- AlterTable
ALTER TABLE "custom_packages" ADD COLUMN "templateId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "custom_packages_templateId_key" ON "custom_packages"("templateId");
