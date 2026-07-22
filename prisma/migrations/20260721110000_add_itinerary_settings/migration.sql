-- CreateTable
CREATE TABLE "itinerary_settings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "companyPhone" TEXT NOT NULL DEFAULT '+91 7807727100',
    "companyEmail" TEXT NOT NULL DEFAULT 'hello@dreamyatri.com',
    "companyAddress" TEXT NOT NULL DEFAULT 'Shimla, Himachal Pradesh - 171001',
    "companyDescription" TEXT NOT NULL DEFAULT 'At Dreams Yatri, we turn journeys into stories. From Himalayan escapes to luxury international holidays, our experts design custom, budget-smart, worry-free trips — so you focus on memories, not logistics.',
    "documentDisclaimer" TEXT NOT NULL DEFAULT 'This is a custom itinerary, subject to availability at the time of booking.',
    "inclusions" TEXT[],
    "exclusions" TEXT[],
    "termsConditions" TEXT[],
    "paymentPolicy" TEXT[],
    "amendmentPolicy" TEXT[],
    "travelBenefits" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "updatedByName" TEXT,

    CONSTRAINT "itinerary_settings_pkey" PRIMARY KEY ("id")
);
