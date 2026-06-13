-- Permits required for a duration's itinerary (e.g. wildlife sanctuary entry).
CREATE TABLE "package_permits" (
    "id" SERIAL NOT NULL,
    "package_id" INTEGER NOT NULL,
    "duration_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "is_included" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "package_permits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "package_permits_package_id_duration_id_idx" ON "package_permits"("package_id", "duration_id");

ALTER TABLE "package_permits" ADD CONSTRAINT "package_permits_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "package_permits" ADD CONSTRAINT "package_permits_duration_id_fkey" FOREIGN KEY ("duration_id") REFERENCES "package_durations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
