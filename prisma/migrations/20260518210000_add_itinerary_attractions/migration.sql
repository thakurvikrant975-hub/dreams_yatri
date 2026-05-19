-- CreateTable
CREATE TABLE "itinerary_attractions" (
    "id" SERIAL NOT NULL,
    "itinerary_id" INTEGER NOT NULL,
    "image_key" TEXT NOT NULL,
    "caption" VARCHAR(50) NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "itinerary_attractions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "itinerary_attractions_itinerary_id_idx" ON "itinerary_attractions"("itinerary_id");

-- AddForeignKey
ALTER TABLE "itinerary_attractions" ADD CONSTRAINT "itinerary_attractions_itinerary_id_fkey" FOREIGN KEY ("itinerary_id") REFERENCES "package_itineraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
