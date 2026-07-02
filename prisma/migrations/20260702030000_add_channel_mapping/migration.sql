-- CreateEnum
CREATE TYPE "ChannelConnectionStatus" AS ENUM ('DRAFT', 'CONNECTED', 'ERROR', 'PAUSED');

-- CreateTable
CREATE TABLE "hotel_channel_connection" (
    "id" TEXT NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'channex',
    "external_id" TEXT,
    "status" "ChannelConnectionStatus" NOT NULL DEFAULT 'DRAFT',
    "settings" JSONB,
    "last_synced_at" TIMESTAMP(3),
    "last_error" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_channel_connection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_channel_room_mapping" (
    "id" TEXT NOT NULL,
    "connection_id" TEXT NOT NULL,
    "room_id" INTEGER NOT NULL,
    "pricing_id" INTEGER,
    "channel_room_id" TEXT NOT NULL,
    "channel_rate_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hotel_channel_room_mapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_channel_connection_hotel_id_channel_key" ON "hotel_channel_connection"("hotel_id", "channel");

-- CreateIndex
CREATE INDEX "hotel_channel_connection_hotel_id_idx" ON "hotel_channel_connection"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_channel_room_mapping_connection_id_room_id_pricing_id_key" ON "hotel_channel_room_mapping"("connection_id", "room_id", "pricing_id");

-- CreateIndex
CREATE INDEX "hotel_channel_room_mapping_connection_id_idx" ON "hotel_channel_room_mapping"("connection_id");

-- CreateIndex
CREATE INDEX "hotel_channel_room_mapping_room_id_idx" ON "hotel_channel_room_mapping"("room_id");

-- AddForeignKey
ALTER TABLE "hotel_channel_connection" ADD CONSTRAINT "hotel_channel_connection_hotel_id_fkey" FOREIGN KEY ("hotel_id") REFERENCES "hotels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_channel_room_mapping" ADD CONSTRAINT "hotel_channel_room_mapping_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "hotel_channel_connection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hotel_channel_room_mapping" ADD CONSTRAINT "hotel_channel_room_mapping_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "hotel_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
