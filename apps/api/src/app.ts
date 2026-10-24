import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { config } from './config.ts';
import { prisma } from './db.ts';
import { PricingError } from './lib/pricing.ts';
import { PaymentError } from './lib/payments/index.ts';
import { festivalRouter } from './routes/festival.ts';
import { ticketsRouter } from './routes/tickets.ts';
import { cartRouter, checkoutRouter, ordersRouter, paymentsRouter } from './routes/checkout.ts';
import { subscribersRouter } from './routes/subscribers.ts';
import { gateRouter } from './routes/gate.ts';
import { wristbandsRouter } from './routes/wristbands.ts';
import { authRouter } from './routes/auth.ts';
import { accountRouter } from './routes/account.ts';
import { adminRouter } from './routes/admin.ts';
import { checkOrigin, loadUser } from './lib/auth/session.ts';

export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.TRUST_PROXY);

app.use(helmet());
if (config.corsOrigins.length) app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '10kb' }));
app.use('/api', checkOrigin);
app.use('/api', loadUser);

// log singkat per request: method, path, status, durasi
const logRequests: RequestHandler = (req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Math.round(performance.now() - start)}ms`);
  });
  next();
};
app.use(logRequests);

const limiter = (limit: number) => rateLimit({
  windowMs: 60_000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Terlalu banyak permintaan. Coba lagi sebentar lagi.' }
});

app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false, error: 'Database tidak bisa dihubungi.' });
  }
});

app.use('/api/festival', festivalRouter);
app.use('/api/tickets', limiter(120), ticketsRouter);
app.use('/api/cart', limiter(120), cartRouter);
app.use('/api/checkout', limiter(10), checkoutRouter);
app.use('/api/orders', limiter(60), ordersRouter);
// webhook Midtrans tidak dibatasi (Midtrans mengulang notifikasi yang gagal)
app.use('/api/payments', paymentsRouter);
app.use('/api/subscribers', limiter(5), subscribersRouter);
// scanner gerbang bisa memindai ratusan tiket per menit, jadi batasnya longgar
app.use('/api/gate', limiter(600), gateRouter);
app.use('/api/wristbands', limiter(600), wristbandsRouter);
app.use('/api/auth', limiter(60), authRouter);
app.use('/api/me', limiter(60), accountRouter);
app.use('/api/admin', limiter(120), adminRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
});

// Express 5 meneruskan error dari handler async ke sini secara otomatis
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Input tidak valid.' });
    return;
  }
  if (err instanceof PricingError || err instanceof PaymentError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  // error dari body-parser (JSON rusak, body terlalu besar, dll.)
  if (typeof err?.status === 'number' && err.status >= 400 && err.status < 500) {
    res.status(err.status).json({ error: err.type === 'entity.too.large' ? 'Data yang dikirim terlalu besar.' : 'Format data tidak valid.' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server.' });
};
app.use(errorHandler);
