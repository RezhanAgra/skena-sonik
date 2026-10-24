-- Gelang masuk: ditukar dari e-tiket di booth, bisa dicetak ulang (gelang lama dinonaktifkan).
-- CreateTable
CREATE TABLE "Wristband" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "validDays" INTEGER[],
    "issuedById" INTEGER,
    "issuedByName" TEXT,
    "booth" TEXT,
    "reprintOf" TEXT,
    "reason" TEXT,
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Wristband_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Wristband_code_key" ON "Wristband"("code");

-- CreateIndex
CREATE INDEX "Wristband_ticketId_idx" ON "Wristband"("ticketId");

-- AddForeignKey
ALTER TABLE "Wristband" ADD CONSTRAINT "Wristband_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Wristband" ADD CONSTRAINT "Wristband_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

