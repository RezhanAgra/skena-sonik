// Gerbang masuk (untuk petugas, butuh header Authorization: Bearer <GATE_TOKEN>)
// GET  /api/gate/me        — cek PIN petugas + info hari festival
// POST /api/gate/check-in  — pindai QR / ketik kode tiket { qr, day, gate }
// GET  /api/gate/stats     — jumlah tiket terbit & yang sudah masuk per hari
import { timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { prisma } from '../db.ts';
import { OrderStatus } from '../generated/prisma/client.ts';
import { EVENT, EVENT_DAYS, todayEventDay } from '../lib/event.ts';
import { checkIn } from '../lib/tickets.ts';

const requireGateToken: RequestHandler = (req, res, next) => {
  if (!config.GATE_TOKEN) {
    res.status(503).json({ error: 'Scanner gerbang belum diaktifkan. Isi GATE_TOKEN di konfigurasi API.' });
    return;
  }
  const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(config.GATE_TOKEN);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    res.status(401).json({ error: 'PIN petugas salah.' });
    return;
  }
  next();
};

export const gateRouter = Router();
gateRouter.use(requireGateToken);

gateRouter.get('/me', (_req, res) => {
  res.json({
    ok: true,
    event: EVENT.name,
    today: todayEventDay(),
    days: EVENT_DAYS.map(d => ({ day: d, label: EVENT.days[d].label }))
  });
});

const CheckInInput = z.object({
  qr: z.string().trim().min(1, 'QR kosong.').max(200, 'Isi QR terlalu panjang.'),
  day: z.coerce.number().int(),
  gate: z.string().trim().max(40).optional()
});

gateRouter.post('/check-in', async (req, res) => {
  const { qr, day, gate } = CheckInInput.parse(req.body);
  const result = await checkIn(qr, day, gate || null);
  console.log(`[gate] ${gate ?? '-'} hari ${day}: ${result.result} ${result.ticket?.code ?? ''}`);
  res.json(result);
});

gateRouter.get('/stats', async (_req, res) => {
  const [issued, perDay] = await Promise.all([
    prisma.ticket.count({ where: { order: { status: OrderStatus.PAID } } }),
    prisma.ticketCheckIn.groupBy({ by: ['day'], _count: { _all: true } })
  ]);
  res.json({
    issued,
    checkedIn: EVENT_DAYS.map(d => ({ day: d, count: perDay.find(p => p.day === d)?._count._all ?? 0 }))
  });
});
