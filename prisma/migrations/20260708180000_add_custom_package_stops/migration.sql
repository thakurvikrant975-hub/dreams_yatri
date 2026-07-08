-- CreateTable: custom_package_stops — route stops (destination + nights) for a custom package
CREATE TABLE "custom_package_stops" (
    "id" TEXT NOT NULL,
    "customPackageId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nights" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_package_stops_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "custom_package_stops_customPackageId_idx" ON "custom_package_stops"("customPackageId");

ALTER TABLE "custom_package_stops"
  ADD CONSTRAINT "custom_package_stops_customPackageId_fkey"
  FOREIGN KEY ("customPackageId") REFERENCES "custom_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
