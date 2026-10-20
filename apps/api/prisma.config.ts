import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts'
  },
  // CLI (migrate, studio, seed) memakai koneksi langsung; pooler transaksi Supabase (port 6543)
  // tidak cocok untuk migrasi. Kalau DIRECT_URL kosong, pakai DATABASE_URL.
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL
  }
});
