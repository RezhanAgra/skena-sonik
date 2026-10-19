// POST /api/tickets/quote — hitung harga tanpa menyimpan
// POST /api/orders        — simpan order demo (tanpa pembayaran)
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

async function quoteFor(body: unknown) {
  const input = QuoteInput.parse(body);
  const tier = await prisma.ticketTier.findUnique({ where: { slug: input.tier } });
  if (!tier) throw new PricingError('Jenis tiket tidak ditemukan.', 404);
  return quote(tier, input.quantity, input.installment);
}

export const ticketsRouter = Router();

ticketsRouter.post('/quote', async (req, res) => {
  res.json(await quoteFor(req.body));
});

export const ordersRouter = Router();

ordersRouter.post('/', async (req, res) => {
  const q = await quoteFor(req.body);
  const order = await prisma.order.create({
    data: {
      tierSlug: q.tier,
      quantity: q.quantity,
      installment: q.installment,
      unitPrice: q.unitPrice,
      fee: q.fee,
      total: q.total
    }
  });
  res.status(201).json({ id: order.id, createdAt: order.createdAt, ...q });
});
