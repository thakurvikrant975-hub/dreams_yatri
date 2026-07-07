-- CreateTable
CREATE TABLE "hotel_review" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "booking_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "guest_name" TEXT NOT NULL,
    "host_response" TEXT,
    "host_response_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_review_hotel_id_idx" ON "hotel_review"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_review_booking_id_hotel_id_key" ON "hotel_review"("booking_id", "hotel_id");

-- AddForeignKey
ALTER TABLE "hotel_review" ADD CONSTRAINT "hotel_review_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_review" ADD CONSTRAINT "hotel_review_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
