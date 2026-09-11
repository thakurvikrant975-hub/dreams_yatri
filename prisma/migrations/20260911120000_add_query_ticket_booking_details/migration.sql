-- AlterTable
ALTER TABLE "package_queries" ADD COLUMN     "ticketBooked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ticketDateTime" TIMESTAMP(3),
ADD COLUMN     "ticketFrom" TEXT,
ADD COLUMN     "ticketTo" TEXT,
ADD COLUMN     "ticketType" "TicketType";
