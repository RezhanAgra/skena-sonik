-- Checkout + pembayaran: Order sekarang punya data pembeli, status, info pembayaran,
-- dan banyak baris tiket (OrderItem). Order demo lama dipindahkan, tidak dihapus.

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED', 'REFUNDED');

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "tierSlug" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- Kolom baru, sementara boleh kosong supaya order lama bisa diisi dulu
ALTER TABLE "Order"
ADD COLUMN     "buyerEmail" TEXT,
ADD COLUMN     "buyerName" TEXT,
ADD COLUMN     "buyerPhone" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paymentProvider" TEXT,
ADD COLUMN     "paymentToken" TEXT,
ADD COLUMN     "paymentType" TEXT,
ADD COLUMN     "paymentUrl" TEXT,
ADD COLUMN     "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "subtotal" INTEGER,
ADD COLUMN     "updatedAt" TIMESTAMP(3);

-- Pindahkan order demo lama (satu tier per order) ke OrderItem
INSERT INTO "OrderItem" ("orderId", "tierSlug", "tierName", "quantity", "unitPrice", "subtotal")
SELECT o."id", o."tierSlug", t."name", o."quantity", o."unitPrice", o."unitPrice" * o."quantity"
FROM "Order" o
JOIN "TicketTier" t ON t."slug" = o."tierSlug";

-- Order lama tidak punya data pembeli dan tidak pernah dibayar: tandai sebagai demo yang dibatalkan
UPDATE "Order" SET
  "code" = 'LEGACY-' || "id",
  "buyerName" = 'Order demo lama',
  "buyerEmail" = '',
  "buyerPhone" = '',
  "subtotal" = "total" - "fee",
  "paymentProvider" = 'legacy',
  "status" = 'CANCELLED',
  "updatedAt" = "createdAt";

-- Sekarang kolom wajib bisa dikunci, kolom lama dibuang
ALTER TABLE "Order"
ALTER COLUMN "buyerEmail" SET NOT NULL,
ALTER COLUMN "buyerName" SET NOT NULL,
ALTER COLUMN "buyerPhone" SET NOT NULL,
ALTER COLUMN "code" SET NOT NULL,
ALTER COLUMN "paymentProvider" SET NOT NULL,
ALTER COLUMN "subtotal" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_tierSlug_fkey";

ALTER TABLE "Order" DROP COLUMN "installment",
DROP COLUMN "quantity",
DROP COLUMN "tierSlug",
DROP COLUMN "unitPrice";

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_tierSlug_fkey" FOREIGN KEY ("tierSlug") REFERENCES "TicketTier"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
