-- CreateEnum
CREATE TYPE "CityStatus" AS ENUM ('SOLD_OUT', 'LOW', 'ON_SALE', 'SOON');

-- CreateTable
CREATE TABLE "City" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(3) NOT NULL,
    "name" TEXT NOT NULL,
    "dateLabel" TEXT NOT NULL,
    "status" "CityStatus" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Stage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "personaName" TEXT NOT NULL,
    "personaStage" TEXT NOT NULL,
    "personaDesc" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Artist" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "headliner" BOOLEAN NOT NULL DEFAULT false,
    "genreSlug" TEXT NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Performance" (
    "id" SERIAL NOT NULL,
    "artistSlug" TEXT NOT NULL,
    "stageId" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "Performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Song" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "artistSlug" TEXT NOT NULL,
    "speed" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Song_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTier" (
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "perks" TEXT[],
    "badge" TEXT,
    "soldOut" BOOLEAN NOT NULL DEFAULT false,
    "squadPrice" INTEGER,
    "squadMin" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("slug")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "tierSlug" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "installment" BOOLEAN NOT NULL DEFAULT false,
    "unitPrice" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "City_code_key" ON "City"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Stage_name_key" ON "Stage"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Performance_artistSlug_key" ON "Performance"("artistSlug");

-- CreateIndex
CREATE INDEX "Performance_day_stageId_idx" ON "Performance"("day", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_genreSlug_fkey" FOREIGN KEY ("genreSlug") REFERENCES "Genre"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_artistSlug_fkey" FOREIGN KEY ("artistSlug") REFERENCES "Artist"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Performance" ADD CONSTRAINT "Performance_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "Stage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Song" ADD CONSTRAINT "Song_artistSlug_fkey" FOREIGN KEY ("artistSlug") REFERENCES "Artist"("slug") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tierSlug_fkey" FOREIGN KEY ("tierSlug") REFERENCES "TicketTier"("slug") ON DELETE RESTRICT ON UPDATE CASCADE;
