-- CreateEnum
CREATE TYPE "LandingPageStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "seoTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "seoDescription" TEXT NOT NULL,
    "heroImageUrl" TEXT NOT NULL,
    "heroEyebrow" TEXT,
    "heroHeadline" TEXT,
    "destination" TEXT,
    "status" "LandingPageStatus" NOT NULL DEFAULT 'DRAFT',
    "popupDelaySeconds" INTEGER NOT NULL DEFAULT 15,
    "contactPhone" TEXT NOT NULL,
    "googleAdsSendToForm" TEXT,
    "googleAdsSendToCall" TEXT,
    "googleAdsSendToWhatsapp" TEXT,
    "faqs" JSONB NOT NULL DEFAULT '[]',
    "testimonials" JSONB NOT NULL DEFAULT '[]',
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPageItem" (
    "id" TEXT NOT NULL,
    "landingPageId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "packageId" INTEGER,
    "title" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "routeLabel" TEXT,
    "priceLabel" TEXT,
    "badgeLabel" TEXT,
    "showInHero" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingPageItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

-- CreateIndex
CREATE INDEX "LandingPage_slug_idx" ON "LandingPage"("slug");

-- CreateIndex
CREATE INDEX "LandingPage_status_idx" ON "LandingPage"("status");

-- CreateIndex
CREATE INDEX "LandingPageItem_landingPageId_idx" ON "LandingPageItem"("landingPageId");

-- AddForeignKey
ALTER TABLE "LandingPageItem" ADD CONSTRAINT "LandingPageItem_landingPageId_fkey" FOREIGN KEY ("landingPageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
