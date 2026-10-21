-- E-tiket: satu tiket per orang + catatan check-in per hari festival.
-- AlterTable
ALTER TABLE "TicketTier" ADD COLUMN     "daysAccess" INTEGER NOT NULL DEFAULT 2;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "ticketsEmailError" TEXT,
ADD COLUMN     "ticketsEmailedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Ticket" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderItemId" INTEGER NOT NULL,
    "tierSlug" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "holderName" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "daysAccess" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketCheckIn" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "gate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TicketCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_code_key" ON "Ticket"("code");

-- CreateIndex
CREATE INDEX "Ticket_orderId_idx" ON "Ticket"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketCheckIn_ticketId_day_key" ON "TicketCheckIn"("ticketId", "day");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketCheckIn" ADD CONSTRAINT "TicketCheckIn_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Daily Pass hanya untuk satu hari pilihan
UPDATE "TicketTier" SET "daysAccess" = 1 WHERE "slug" = 'daily';
