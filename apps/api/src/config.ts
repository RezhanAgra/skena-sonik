// Konfigurasi dari environment variable, divalidasi sekali saat start.
// Di lokal dibaca dari apps/api/.env; di Docker/VPS diisi lewat docker-compose (env_file).
import { z } from 'zod';

try {
  process.loadEnvFile(); // .env opsional; variabel yang sudah ada di environment tidak ditimpa
} catch {}

const Env = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string({ message: 'DATABASE_URL belum diisi. Salin apps/api/.env.example menjadi apps/api/.env.' }).min(1),
  // jumlah koneksi database maksimum per proses API (Supabase gratis membatasi koneksi pooler)
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  // Port API. API_PORT diutamakan; PORT hanya dipakai di produksi (Docker), karena saat development
  // PORT biasanya milik server web (preview/IDE sering mengisinya untuk Astro).
  API_PORT: z.coerce.number().int().positive().optional(),
  PORT: z.coerce.number().int().positive().optional(),
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
  MIDTRANS_IS_PRODUCTION: z.stringbool().default(false),

  // kunci rahasia untuk menandatangani QR e-tiket. Ganti dengan string acak panjang di produksi.
  TICKET_SECRET: z.string().min(32, 'TICKET_SECRET minimal 32 karakter.').default('dev-only-ticket-secret-ganti-di-produksi!!'),
  // PIN/token petugas gerbang untuk halaman /gate. Kosong = scanner gerbang nonaktif.
  GATE_TOKEN: z.string().min(6, 'GATE_TOKEN minimal 6 karakter.').optional(),

  // log = email tidak dikirim, disimpan sebagai file HTML di apps/api/tmp/emails (development)
  // smtp = kirim lewat SMTP (mis. Gmail dengan App Password)
  EMAIL_PROVIDER: z.enum(['smtp', 'log']).default('log'),
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  // pengirim, contoh: "Skena Sonik <skenasonik.tiket@gmail.com>". Default: SMTP_USER
  EMAIL_FROM: z.string().optional()
}).superRefine((env, ctx) => {
  if (env.NODE_ENV === 'production' && env.TICKET_SECRET.startsWith('dev-only')) {
    ctx.addIssue({ code: 'custom', path: ['TICKET_SECRET'], message: 'Isi TICKET_SECRET dengan string acak (mis. `openssl rand -hex 32`) di produksi.' });
  }
  if (env.EMAIL_PROVIDER === 'smtp') {
    for (const key of ['SMTP_USER', 'SMTP_PASS'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} wajib diisi kalau EMAIL_PROVIDER=smtp.` });
    }
  }
  if (env.PAYMENT_PROVIDER === 'midtrans') {
    for (const key of ['MIDTRANS_SERVER_KEY', 'MIDTRANS_CLIENT_KEY'] as const) {
      if (!env[key]) ctx.addIssue({ code: 'custom', path: [key], message: `${key} wajib diisi kalau PAYMENT_PROVIDER=midtrans.` });
    }
  }
  if (env.PAYMENT_PROVIDER === 'mock' && env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_PAYMENTS !== 'true') {
    ctx.addIssue({ code: 'custom', path: ['PAYMENT_PROVIDER'], message: 'Mode mock tidak boleh dipakai di produksi. Isi PAYMENT_PROVIDER=midtrans (atau ALLOW_MOCK_PAYMENTS=true untuk demo).' });
  }
});

// `KEY=` (kosong) di .env / docker-compose diperlakukan sama dengan tidak diisi, supaya default & opsional berlaku
const env = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined && v.trim() !== ''));
const parsed = Env.safeParse(env);
if (!parsed.success) {
  console.error('Konfigurasi tidak valid:\n' + parsed.error.issues.map(i => `- ${i.path.join('.')}: ${i.message}`).join('\n'));
  process.exit(1);
}

export const config = {
  ...parsed.data,
  PORT: parsed.data.API_PORT ?? (parsed.data.NODE_ENV === 'production' ? parsed.data.PORT : undefined) ?? 4000,
  corsOrigins: parsed.data.CORS_ORIGIN?.split(',').map(s => s.trim()).filter(Boolean) ?? [],
  isProduction: parsed.data.NODE_ENV === 'production'
};
