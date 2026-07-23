-- CreateTable
CREATE TABLE "custom_package_addons" (
    "id" TEXT NOT NULL,
    "customPackageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_package_addons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_package_addons_customPackageId_idx" ON "custom_package_addons"("customPackageId");

-- AddForeignKey
ALTER TABLE "custom_package_addons" ADD CONSTRAINT "custom_package_addons_customPackageId_fkey" FOREIGN KEY ("customPackageId") REFERENCES "custom_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
