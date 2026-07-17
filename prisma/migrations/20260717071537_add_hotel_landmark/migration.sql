-- CreateTable
CREATE TABLE "hotel_landmark" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "distance_m" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_landmark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_landmark_hotel_id_idx" ON "hotel_landmark"("hotel_id");

-- AddForeignKey
ALTER TABLE "hotel_landmark" ADD CONSTRAINT "hotel_landmark_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
