-- CreateTable
CREATE TABLE "package_template_timeline" (
    "id" TEXT NOT NULL,
    "packageTemplateId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT,
    "event" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_template_timeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "package_template_timeline_packageTemplateId_idx" ON "package_template_timeline"("packageTemplateId");

-- AddForeignKey
ALTER TABLE "package_template_timeline" ADD CONSTRAINT "package_template_timeline_packageTemplateId_fkey" FOREIGN KEY ("packageTemplateId") REFERENCES "package_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
