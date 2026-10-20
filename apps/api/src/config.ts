// Konfigurasi dari environment variable, divalidasi sekali saat start.
// Di lokal dibaca dari apps/api/.env; di Docker/VPS diisi lewat docker-compose (env_file).
import { z } from 'zod';

try {
  process.loadEnvFile(); // .env opsional; variabel yang sudah ada di environment tidak ditimpa
} catch {}

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string({ message: 'DATABASE_URL belum diisi. Salin apps/api/.env.example menjadi apps/api/.env.' }).min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('0.0.0.0'),
  // daftar origin dipisah koma. Kosong = CORS mati (web & API di domain yang sama lewat reverse proxy)
  CORS_ORIGIN: z.string().optional(),
  // jumlah proxy di depan API (Caddy/Nginx) supaya IP pengunjung terbaca benar untuk rate limit
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),

  // URL publik web, dipakai untuk halaman kembali setelah bayar (/pesanan/KODE)
  SITE_URL: z.url({ message: 'SITE_URL harus berupa URL, contoh https://skenasonik.com' }).default('http://localhost:4321'),
  // midtrans = Midtrans Snap; mock = pembayaran simulasi untuk development/demo
  PAYMENT_PROVIDER: z.enum(['midtrans', 'mock']).default('mock'),
  MIDTRANS_SERVER_KEY: z.string().optional(),
  MIDTRANS_CLIENT_KEY: z.string().optional(),
  // false = sandbox (uang bohongan), true = produksi (uang sungguhan)
  MIDTRANS_IS_PRODUCTION: z.stringbool().default(false)
}).superRefine((env, ctx) => {
  if (env.PAYMENT_PROVIDER === 'midtrans') {
    for (const key of ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} wajib diisi kalau PAYMENT_PROVIDER=midtrans.` });
    }
  }
  if (env.PAYMENT_PROVIDER === 'mock' && env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENTS !== 'true') {
    ctx.addIssue({ code: 'custom', path: ['PAYMENT_PROVIDER'], message: 'Mode mock tidak boleh dipakai di produksi. Isi PAYMENT_PROVIDER=midtrans (atau ALLOW_MOCK_PAYMENTS=true untuk demo).' });
  }
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('Konfigurasi tidak valid:\n' + parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean) ?? [],
  isProduction: parsed.data.NODE_ENV === 'production'
};
