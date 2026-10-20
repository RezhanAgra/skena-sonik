// POST /api/tickets/quote — hitung harga satu jenis tiket untuk kalkulator patungan (tanpa menyimpan)
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { PRICING, PricingError, quote } from '../lib/pricing.ts';

const quantityMessage = `Jumlah tiket harus 1–${PRICING.maxQuantity}.`;
const QuoteInput = z.object({
  tier: z.string({ message: 'Pilih jenis tiket dulu.' }).min(1, 'Pilih jenis tiket dulu.'),
  quantity: z.coerce.number().int(quantityMessage).min(1, quantityMessage).max(PRICING.maxQuantity, quantityMessage),
  installment: z.boolean().default(false)
});

export const ticketsRouter = Router();

ticketsRouter.post('/quote', async (req, res) => {
  const input = QuoteInput.parse(req.body);
  const tier = await prisma.ticketTier.findUnique({ where: { slug: input.tier } });
  if (!tier) throw new PricingError('Jenis tiket tidak ditemukan.', 404);
  res.json(quote(tier, input.quantity, input.installment));
});
