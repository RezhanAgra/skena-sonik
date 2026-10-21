// GET /api/me/orders — "Tiket saya": pesanan milik akun yang sedang masuk
import { Router } from 'express';
import { prisma } from '../db.ts';
import { requireUser } from '../lib/auth/session.ts';

export const accountRouter = Router();
accountRouter.use(requireUser);

accountRouter.get('/orders', async (_req, res) => {
  const user = res.locals.user!;
  // Pesanan yang dibuat saat login, plus (kalau email sudah terverifikasi) pesanan lama
  // yang dibeli tanpa login dengan email yang sama. Email belum terverifikasi = belum terbukti pemiliknya.
  const orders = await prisma.order.findMany({
    where: user.emailVerifiedAt
      ? { OR: [{ userId: user.id }, { buyerEmail: user.email }] }
      : { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { items: true, _count: { select: { tickets: true } } }
  });

  res.json({
    emailVerified: Boolean(user.emailVerifiedAt),
    orders: orders.map(o => ({
      code: o.code,
      status: o.status,
      total: o.total,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      items: o.items.map(i => ({ tierName: i.tierName, quantity: i.quantity })),
      ticketCount: o._count.tickets
    }))
  });
});
