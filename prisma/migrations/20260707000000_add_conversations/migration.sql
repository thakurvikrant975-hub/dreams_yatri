-- CreateEnum
CREATE TYPE "ConversationSender" AS ENUM ('HOST', 'GUEST', 'SYSTEM');

-- CreateTable
CREATE TABLE "conversation" (
    "id" SERIAL NOT NULL,
    "booking_id" TEXT NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_message" (
    "id" SERIAL NOT NULL,
    "conversation_id" INTEGER NOT NULL,
    "sender" "ConversationSender" NOT NULL,
    "body" TEXT NOT NULL,
    "read_by_host" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversation_hotel_id_idx" ON "conversation"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_booking_id_hotel_id_key" ON "conversation"("booking_id", "hotel_id");

-- CreateIndex
CREATE INDEX "conversation_message_conversation_id_idx" ON "conversation_message"("conversation_id");

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_message" ADD CONSTRAINT "conversation_message_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
