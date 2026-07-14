-- CreateTable
CREATE TABLE "hotel_owner_feedback" (
    "id" SERIAL NOT NULL,
    "owner_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "page_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hotel_owner_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hotel_owner_feedback_owner_id_idx" ON "hotel_owner_feedback"("owner_id");

-- AddForeignKey
ALTER TABLE "hotel_owner_feedback" ADD CONSTRAINT "hotel_owner_feedback_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "hotel_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
