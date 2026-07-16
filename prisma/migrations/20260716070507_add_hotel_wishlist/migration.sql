-- CreateTable
CREATE TABLE "hotel_wishlist" (
    "id" SERIAL NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_wishlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_wishlist_user_id_idx" ON "hotel_wishlist"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_wishlist_user_id_hotel_id_key" ON "hotel_wishlist"("user_id", "hotel_id");

-- AddForeignKey
ALTER TABLE "hotel_wishlist" ADD CONSTRAINT "hotel_wishlist_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;
