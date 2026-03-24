-- CreateTable
CREATE TABLE "regions" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'India',
    "region_id" INTEGER NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "base_destination_id" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_variants" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "title" TEXT,
    "duration_days" INTEGER NOT NULL,
    "duration_nights" INTEGER NOT NULL,
    "starting_price" DOUBLE PRECISION NOT NULL,
    "route" JSONB NOT NULL,
    "region_breakdown" JSONB NOT NULL,
    "stay_category" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "package_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_itineraries" (
    "id" SERIAL NOT NULL,
    "variant_id" INTEGER NOT NULL,
    "itinerary" JSONB NOT NULL,

    CONSTRAINT "package_itineraries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_slug_key" ON "regions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "destinations_slug_key" ON "destinations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "packages_slug_key" ON "packages"("slug");

-- AddForeignKey
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_base_destination_id_fkey" FOREIGN KEY ("base_destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_variants" ADD CONSTRAINT "package_variants_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_itineraries" ADD CONSTRAINT "package_itineraries_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "package_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
