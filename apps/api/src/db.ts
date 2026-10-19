// Satu instance Prisma Client untuk seluruh API (Prisma 7 memakai driver adapter pg)
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL belum diisi. Salin apps/api/.env.example menjadi apps/api/.env.');
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
export const prisma = new PrismaClient({ adapter });
