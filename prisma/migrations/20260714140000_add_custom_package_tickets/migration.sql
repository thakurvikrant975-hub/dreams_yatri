-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('FLIGHT', 'TRAIN');

-- CreateTable
CREATE TABLE "custom_package_tickets" (
    "id" TEXT NOT NULL,
    "customPackageId" TEXT NOT NULL,
    "type" "TicketType" NOT NULL,
    "provider" TEXT,
    "ticketNumber" TEXT,
    "fromPlace" TEXT,
    "toPlace" TEXT,
    "departureTime" TEXT,
    "arrivalTime" TEXT,
    "durationText" TEXT,
    "pickupPoint" TEXT,
    "dropPoint" TEXT,
    "adults" INTEGER NOT NULL DEFAULT 0,
    "children" INTEGER NOT NULL DEFAULT 0,
    "infants" INTEGER NOT NULL DEFAULT 0,
    "ticketCount" INTEGER NOT NULL DEFAULT 1,
    "fare" DOUBLE PRECISION,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_package_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "custom_package_tickets_customPackageId_idx" ON "custom_package_tickets"("customPackageId");

-- AddForeignKey
ALTER TABLE "custom_package_tickets" ADD CONSTRAINT "custom_package_tickets_customPackageId_fkey" FOREIGN KEY ("customPackageId") REFERENCES "custom_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
