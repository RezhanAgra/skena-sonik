// POST /api/cart/quote                       — hitung harga isi keranjang
// POST /api/checkout                         — buat pesanan + sesi pembayaran
// GET  /api/orders/:code                     — status pesanan (dicek ulang ke gateway kalau masih PENDING)
// POST /api/payments/midtrans/notification   — webhook Midtrans
// POST /api/orders/:code/resend-tickets      — kirim ulang e-tiket ke email pembeli
// GET  /api/orders/:code/tickets.pdf         — download PDF e-tiket (?ticket=TKT-... untuk satu tiket)
// POST /api/payments/mock/:code              — simulasi bayar (hanya PAYMENT_PROVIDER=mock)
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.ts';
import { prisma } from '../db.ts';
import { OrderStatus } from '../generated/prisma/client.ts';
import { rateLimit } from 'express-rate-limit';
import { deliverTickets } from '../lib/delivery.ts';
import { buildTicketsPdf } from '../lib/pdf/eticket-pdf.ts';
import { ORDER_INCLUDE, applyPaymentUpdate, generateOrderCode, publicOrder } from '../lib/orders.ts';
import { payments, PaymentError } from '../lib/payments/index.ts';
import { toUpdate, verifyMidtransSignature, type MidtransStatus } from '../lib/payments/midtrans.ts';
import { PRICING, quoteCart } from '../lib/pricing.ts';

const qtyMessage = `Jumlah tiket harus 1–${PRICING.maxQuantity}.`;
const CartInput = z.object({
  items: z.array(z.object({
    tier: z.string().min(1, 'Jenis tiket tidak valid.'),
    quantity: z.coerce.number().int(qtyMessage).min(1, qtyMessage).max(PRICING.maxQuantity, qtyMessage)
  })).min(1, 'Keranjang masih kosong.').max(10, 'Terlalu banyak jenis tiket.')
});

const BuyerInput = z.object({
  name: z.string().trim().min(2, 'Nama minimal 2 huruf.').max(80, 'Nama terlalu panjang.'),
  email: z.string().trim().toLowerCase().pipe(z.email({ message: 'Format email belum benar.' })),
  phone: z.string()
    .transform(s => s.replace(/[\s-]/g, '').replace(/^\+?62/, '0'))
    .pipe(z.string().regex(/^08\d{7,12}$/, 'Nomor HP harus nomor Indonesia, contoh 0812xxxxxxx.'))
});

const CheckoutInput = CartInput.extend({ buyer: BuyerInput });

async function priceCart(items: z.infer<typeof CartInput>['items']) {
  const tiers = await prisma.ticketTier.findMany({ where: { slug: { in: items.map(i => i.tier) } } });
  return quoteCart(items, tiers);
}

export const cartRouter = Router();

cartRouter.post('/quote', async (req, res) => {
  const { items } = CartInput.parse(req.body);
  res.json(await priceCart(items));
});

export const checkoutRouter = Router();

checkoutRouter.post('/', async (req, res) => {
  const { items, buyer } = CheckoutInput.parse(req.body);
  const cart = await priceCart(items);

  const order = await prisma.order.create({
    data: {
      code: generateOrderCode(),
      // pesanan dikaitkan ke akun kalau pembeli sedang masuk
      userId: res.locals.user?.id ?? null,
      buyerName: buyer.name,
      buyerEmail: buyer.email,
      buyerPhone: buyer.phone,
      subtotal: cart.subtotal,
      fee: cart.fee,
      total: cart.total,
      paymentProvider: payments.name,
      items: {
        create: cart.lines.map(l => ({
          tierSlug: l.tier, tierName: l.tierName, quantity: l.quantity, unitPrice: l.unitPrice, subtotal: l.subtotal
        }))
      }
    },
    include: { items: true }
  });

  let session;
  try {
    session = await payments.createSession(order);
  } catch (err) {
    await prisma.order.update({ where: { id: order.id }, data: { status: OrderStatus.FAILED } });
    throw err;
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { paymentToken: session.token, paymentUrl: session.redirectUrl }
  });

  res.status(201).json({ code: order.code, total: order.total, provider: payments.name, ...session });
});

export const ordersRouter = Router();

ordersRouter.get('/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();
  let order = await prisma.order.findUnique({ where: { code }, include: ORDER_INCLUDE });
  if (!order) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }

  // webhook bisa terlambat (atau tidak sampai ke localhost): tanyakan langsung ke gateway
  if (order.status === OrderStatus.PENDING && order.paymentProvider === payments.name) {
    try {
      const update = await payments.fetchStatus(code);
      if (update) {
        await applyPaymentUpdate(code, update);
        order = await prisma.order.findUniqueOrThrow({ where: { code }, include: ORDER_INCLUDE });
      }
    } catch (err) {
      if (!(err instanceof PaymentError)) throw err;
    }
  }

  res.json(await publicOrder(order));
});

// maksimal 3 kali per 10 menit per IP supaya tidak dipakai untuk spam email
const resendLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 3,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Kirim ulang dibatasi 3 kali per 10 menit. Cek folder Spam/Promosi dulu ya.' }
});

ordersRouter.post('/:code/resend-tickets', resendLimiter, async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const order = await prisma.order.findUnique({ where: { code } });
  if (!order) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }
  if (order.status !== OrderStatus.PAID) {
    res.status(409).json({ error: 'E-tiket hanya bisa dikirim untuk pesanan yang sudah lunas.' });
    return;
  }
  const result = await deliverTickets(code);
  if (!result.sent) {
    res.status(502).json({ error: 'Email gagal terkirim. Coba lagi beberapa saat lagi.' });
    return;
  }
  const updated = await prisma.order.findUniqueOrThrow({ where: { code }, include: ORDER_INCLUDE });
  res.json(await publicOrder(updated));
});

ordersRouter.get('/:code/tickets.pdf', async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const only = typeof req.query.ticket === 'string' ? req.query.ticket.toUpperCase() : undefined;
  const order = await prisma.order.findUnique({ where: { code }, include: { tickets: { orderBy: { seq: 'asc' } } } });
  if (!order || order.status !== OrderStatus.PAID || !order.tickets.length) {
    res.status(404).json({ error: 'E-tiket belum tersedia untuk pesanan ini.' });
    return;
  }
  if (only && !order.tickets.some(t => t.code === only)) {
    res.status(404).json({ error: 'Tiket tidak ditemukan di pesanan ini.' });
    return;
  }
  const pdf = await buildTicketsPdf(order, only);
  const filename = only ? `E-tiket-${only}.pdf` : `E-tiket-${order.code}.pdf`;
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': String(pdf.length),
    'Cache-Control': 'no-store'
  });
  res.end(Buffer.from(pdf));
});

export const paymentsRouter = Router();

// Midtrans mengirim notifikasi setiap status berubah, dan mengulang kalau respons bukan 2xx
paymentsRouter.post('/midtrans/notification', async (req, res) => {
  if (config.PAYMENT_PROVIDER !== 'midtrans' || !config.MIDTRANS_SERVER_KEY) {
    res.status(404).json({ error: 'Midtrans tidak aktif.' });
    return;
  }
  const body = req.body as MidtransStatus;
  if (!body?.order_id || !verifyMidtransSignature(body, config.MIDTRANS_SERVER_KEY)) {
    res.status(403).json({ error: 'Signature tidak valid.' });
    return;
  }
  const order = await applyPaymentUpdate(body.order_id, toUpdate(body));
  // notifikasi tes dari dashboard Midtrans memakai order_id acak: balas 200 supaya tidak diulang
  res.json({ ok: true, known: order !== null });
});

paymentsRouter.post('/mock/:code', async (req, res) => {
  if (payments.name !== 'mock') {
    res.status(404).json({ error: 'Mode pembayaran simulasi tidak aktif.' });
    return;
  }
  const { result } = z.object({ result: z.enum(['paid', 'failed', 'expired']) }).parse(req.body);
  const order = await prisma.order.findUnique({ where: { code: req.params.code.toUpperCase() } });
  if (!order) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }
  const status = { paid: OrderStatus.PAID, failed: OrderStatus.FAILED, expired: OrderStatus.EXPIRED }[result];
  await applyPaymentUpdate(order.code, { status, paymentType: 'simulasi', grossAmount: order.total });
  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, include: ORDER_INCLUDE });
  res.json(await publicOrder(updated));
});
