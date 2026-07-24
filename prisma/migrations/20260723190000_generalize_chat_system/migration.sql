-- Add AGENT to ConversationSender (future support/help conversations)
ALTER TYPE "ConversationSender" ADD VALUE 'AGENT';

-- New enum for conversation "kind" — forward-compat marker, only HOTEL_BOOKING exists today
CREATE TYPE "ConversationKind" AS ENUM ('HOTEL_BOOKING');

-- conversation: kind marker
ALTER TABLE "conversation" ADD COLUMN "kind" "ConversationKind" NOT NULL DEFAULT 'HOTEL_BOOKING';

-- conversation_message: sender snapshot, attachments, soft-delete
ALTER TABLE "conversation_message"
  ADD COLUMN "sender_id" TEXT,
  ADD COLUMN "sender_name" TEXT,
  ADD COLUMN "attachment_url" TEXT,
  ADD COLUMN "attachment_name" TEXT,
  ADD COLUMN "attachment_type" TEXT,
  ADD COLUMN "attachment_size" INTEGER,
  ADD COLUMN "deleted_at" TIMESTAMP(3),
  ADD COLUMN "deleted_by" TEXT,
  ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "conversation_message_is_deleted_idx" ON "conversation_message"("is_deleted");
