// POST /api/subscribers — daftar info presale
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';

const SubscribeInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email({ message: 'Format email belum benar.' }))
});

export const subscribersRouter = Router();

subscribersRouter.post('/', async (req, res) => {
  const { email } = SubscribeInput.parse(req.body);
  const existing = await prisma.subscriber.findUnique({ where: { email } });
  if (existing) {
    res.json({ status: 'exists', email });
    return;
  }
  await prisma.subscriber.create({ data: { email } });
  res.status(201).json({ status: 'created', email });
});
