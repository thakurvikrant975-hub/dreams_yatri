-- CreateEnum
CREATE TYPE "SyncEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "hotel_sync_event" (
    "id" TEXT NOT NULL,
    "hotel_id" INTEGER NOT NULL,
    "connection_id" TEXT,
    "room_id" INTEGER,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "SyncEventStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 8,
    "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_error" TEXT,
    "idempotency_key" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "hotel_sync_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hotel_channel_webhook" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_type" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "hotel_channel_webhook_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hotel_sync_event_idempotency_key_key" ON "hotel_sync_event"("idempotency_key");

-- CreateIndex
CREATE INDEX "hotel_sync_event_status_next_attempt_at_idx" ON "hotel_sync_event"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "hotel_sync_event_hotel_id_idx" ON "hotel_sync_event"("hotel_id");

-- CreateIndex
CREATE UNIQUE INDEX "hotel_channel_webhook_provider_event_id_key" ON "hotel_channel_webhook"("provider", "event_id");

-- CreateIndex
CREATE INDEX "hotel_channel_webhook_processed_idx" ON "hotel_channel_webhook"("processed");
