-- CreateTable
CREATE TABLE "hotel_owner_notifications" (
    "id" SERIAL NOT NULL,
    "owner_id" TEXT NOT NULL,
    "hotel_id" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_owner_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_owner_notifications_owner_id_created_at_idx" ON "hotel_owner_notifications"("owner_id", "created_at");

-- AddForeignKey
ALTER TABLE "hotel_owner_notifications" ADD CONSTRAINT "hotel_owner_notifications_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "hotel_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_owner_notifications" ADD CONSTRAINT "hotel_owner_notifications_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE SET NULL ON UPDATE CASCADE;
