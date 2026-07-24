-- Symmetric to read_by_host: lets the guest-facing chat show an unread badge
-- for HOST-sent messages, the same way the owner inbox already does for GUEST ones.
ALTER TABLE "conversation_message" ADD COLUMN "read_by_guest" BOOLEAN NOT NULL DEFAULT false;
