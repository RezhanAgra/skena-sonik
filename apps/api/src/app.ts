import express, { type ErrorRequestHandler } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { prisma } from './db.ts';
import { PricingError } from './lib/pricing.ts';
import { festivalRouter } from './routes/festival.ts';
import { ordersRouter, ticketsRouter } from './routes/tickets.ts';
import { subscribersRouter } from './routes/subscribers.ts';

export const app = express();
app.disable('x-powered-by');

app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? 'http://localhost:4321' }));
app.use(express.json({ limit: '10kb' }));

app.get('/api/health', async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true });
});

app.use('/api/festival', festivalRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/subscribers', subscribersRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Endpoint tidak ditemukan.' });
});

// Express 5 meneruskan error dari handler async ke sini secara otomatis
const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? 'Input tidak valid.' });
    return;
  }
  if (err instanceof PricingError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Terjadi kesalahan di server.' });
};
app.use(errorHandler);
