// Satu instance Prisma Client untuk seluruh API (Prisma 7 memakai driver adapter pg)
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from './config.ts';
import { PrismaClient } from './generated/prisma/client.ts';

const adapter = new PrismaPg({ connectionString: config.DATABASE_URL, max: config.DATABASE_POOL_MAX });
export const prisma = new PrismaClient({ adapter });
