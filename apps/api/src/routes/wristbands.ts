// Booth penukaran gelang (akun STAFF/ORGANIZER, atau PIN bersama GATE_TOKEN)
// POST /api/wristbands/lookup { qr }                                   — cek e-tiket yang dipindai
// POST /api/wristbands        { ticketCode, day, booth?, reprint?, reason? } — terbitkan / cetak ulang gelang
// GET  /api/wristbands/stats                                           — jumlah gelang tercetak
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { OrderStatus } from '../generated/prisma/client.ts';
import { issueWristband, lookupTicket, WristbandError } from '../lib/wristbands.ts';
import { requireGateToken } from './gate.ts';

export const wristbandsRouter = Router();
wristbandsRouter.use(requireGateToken);

const sendError = (res: import('express').Response, err: unknown) => {
  if (err instanceof WristbandError) {
    res.status(err.status).json({ error: err.message });
    return true;
  }
  return false;
};

wristbandsRouter.post('/lookup', async (req, res) => {
  const { qr } = z.object({ qr: z.string().trim().min(1, 'QR kosong.').max(200) }).parse(req.body);
  try {
    res.json(await lookupTicket(qr));
  } catch (err) {
    if (!sendError(res, err)) throw err;
  }
});

wristbandsRouter.post('/', async (req, res) => {
  const input = z.object({
    ticketCode: z.string().trim().toUpperCase().regex(/^TKT-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Kode tiket tidak valid.'),
    day: z.coerce.number().int(),
    booth: z.string().trim().max(40).optional(),
    reprint: z.boolean().default(false),
    reason: z.string().trim().max(200).optional()
  }).parse(req.body);
  const user = res.locals.user;
  try {
    const band = await issueWristband({
      ticketCode: input.ticketCode,
      day: input.day,
      booth: input.booth || null,
      issuer: user ? { id: user.id, name: user.name } : null,
      reprint: input.reprint,
      reason: input.reason
    });
    res.status(201).json(band);
  } catch (err) {
    if (!sendError(res, err)) throw err;
  }
});

wristbandsRouter.get('/stats', async (_req, res) => {
  const [issued, reprinted, tickets] = await Promise.all([
    prisma.wristband.count({ where: { voidedAt: null } }),
    prisma.wristband.count({ where: { reprintOf: { not: null } } }),
    prisma.ticket.count({ where: { order: { status: OrderStatus.PAID } } })
  ]);
  res.json({ issued, reprinted, tickets });
});
