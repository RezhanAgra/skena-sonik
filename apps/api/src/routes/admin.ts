// Dasbor penyelenggara (hanya ORGANIZER)
// GET  /api/admin/stats                  — ringkasan penjualan & check-in
// GET  /api/admin/orders?q=&status=&page= — daftar pesanan
// POST /api/admin/orders/:code/resend    — kirim ulang e-tiket
// GET  /api/admin/team                   — akun petugas & penyelenggara
// POST /api/admin/team { email, role }   — ubah peran akun (AUDIENCE | STAFF | ORGANIZER)
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.ts';
import { OrderStatus, Prisma, Role } from '../generated/prisma/client.ts';
import { requireRole } from '../lib/auth/session.ts';
import { deliverTickets } from '../lib/delivery.ts';
import { EVENT, EVENT_DAYS } from '../lib/event.ts';

export const adminRouter = Router();
adminRouter.use(requireRole(Role.ORGANIZER));

adminRouter.get('/stats', async (_req, res) => {
  const since = new Date(Date.now() - 13 * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const [byStatus, revenue, perTier, tickets, checkIns, paidRecent, users, wristbands] = await Promise.all([
    prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.order.aggregate({ where: { status: OrderStatus.PAID }, _sum: { total: true, fee: true } }),
    prisma.orderItem.groupBy({
      by: ['tierSlug', 'tierName'],
      where: { order: { status: OrderStatus.PAID } },
      _sum: { quantity: true, subtotal: true }
    }),
    prisma.ticket.count({ where: { order: { status: OrderStatus.PAID } } }),
    prisma.ticketCheckIn.groupBy({ by: ['day'], _count: { _all: true } }),
    prisma.order.findMany({ where: { status: OrderStatus.PAID, paidAt: { gte: since } }, select: { paidAt: true, total: true } }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.wristband.count({ where: { voidedAt: null } })
  ]);

  // penjualan per hari (14 hari terakhir, zona waktu Jakarta)
  const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: EVENT.timeZone }).format(d);
  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(since.getTime() + i * 86_400_000);
    return { date: dayKey(d), revenue: 0, orders: 0 };
  });
  for (const o of paidRecent) {
    const slot = daily.find(d => d.date === dayKey(o.paidAt!));
    if (slot) { slot.revenue += o.total; slot.orders += 1; }
  }

  res.json({
    revenue: revenue._sum.total ?? 0,
    serviceFees: revenue._sum.fee ?? 0,
    orders: Object.fromEntries(Object.values(OrderStatus).map(s => [s, byStatus.find(b => b.status === s)?._count._all ?? 0])),
    ticketsIssued: tickets,
    wristbandsIssued: wristbands,
    perTier: perTier.map(t => ({ tier: t.tierSlug, name: t.tierName, sold: t._sum.quantity ?? 0, revenue: t._sum.subtotal ?? 0 })),
    checkIns: EVENT_DAYS.map(d => ({ day: d, label: EVENT.days[d].label, count: checkIns.find(c => c.day === d)?._count._all ?? 0 })),
    daily,
    accounts: Object.fromEntries(Object.values(Role).map(r => [r, users.find(u => u.role === r)?._count._all ?? 0]))
  });
});

const PAGE_SIZE = 20;

adminRouter.get('/orders', async (req, res) => {
  const q = z.object({
    q: z.string().trim().max(80).optional(),
    status: z.enum(OrderStatus).optional().or(z.literal('').transform(() => undefined)),
    page: z.coerce.number().int().min(1).default(1)
  }).parse(req.query);

  const where: Prisma.OrderWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.q ? {
      OR: [
        { code: { contains: q.q.toUpperCase() } },
        { buyerEmail: { contains: q.q.toLowerCase() } },
        { buyerName: { contains: q.q, mode: 'insensitive' } },
        { buyerPhone: { contains: q.q.replace(/\D/g, '') || q.q } },
        { tickets: { some: { code: q.q.toUpperCase() } } }
      ]
    } : {})
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { items: true, _count: { select: { tickets: true } } }
    })
  ]);

  res.json({
    page: q.page,
    pageSize: PAGE_SIZE,
    total,
    orders: orders.map(o => ({
      code: o.code,
      status: o.status,
      buyerName: o.buyerName,
      buyerEmail: o.buyerEmail,
      buyerPhone: o.buyerPhone,
      total: o.total,
      items: o.items.map(i => ({ tierName: i.tierName, quantity: i.quantity })),
      ticketCount: o._count.tickets,
      paymentType: o.paymentType,
      ticketsEmailedAt: o.ticketsEmailedAt,
      ticketsEmailError: o.ticketsEmailError,
      createdAt: o.createdAt,
      paidAt: o.paidAt,
      hasAccount: o.userId !== null
    }))
  });
});

adminRouter.post('/orders/:code/resend', async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  const order = await prisma.order.findUnique({ where: { code } });
  if (!order) {
    res.status(404).json({ error: 'Pesanan tidak ditemukan.' });
    return;
  }
  if (order.status !== OrderStatus.PAID) {
    res.status(409).json({ error: 'E-tiket hanya untuk pesanan lunas.' });
    return;
  }
  const result = await deliverTickets(code);
  if (!result.sent) {
    res.status(502).json({ error: 'Email gagal terkirim. Cek pengaturan SMTP.' });
    return;
  }
  res.json({ ok: true, sentTo: order.buyerEmail });
});

adminRouter.get('/team', async (_req, res) => {
  const team = await prisma.user.findMany({
    where: { role: { in: [Role.STAFF, Role.ORGANIZER] } },
    orderBy: [{ role: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, email: true, role: true, emailVerifiedAt: true, createdAt: true }
  });
  res.json({ team: team.map(u => ({ ...u, emailVerified: Boolean(u.emailVerifiedAt), emailVerifiedAt: undefined })) });
});

adminRouter.post('/team', async (req, res) => {
  const input = z.object({
    email: z.string().trim().toLowerCase().pipe(z.email({ message: 'Format email belum benar.' })),
    role: z.enum(Role)
  }).parse(req.body);

  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    res.status(404).json({ error: 'Belum ada akun dengan email ini. Minta orangnya mendaftar dulu di halaman Daftar.' });
    return;
  }
  if (user.id === res.locals.user!.id) {
    res.status(400).json({ error: 'Kamu tidak bisa mengubah peran akunmu sendiri.' });
    return;
  }
  if (input.role !== Role.AUDIENCE && !user.emailVerifiedAt) {
    res.status(400).json({ error: 'Email akun ini belum terverifikasi. Minta orangnya verifikasi email dulu.' });
    return;
  }
  const updated = await prisma.user.update({ where: { id: user.id }, data: { role: input.role } });
  // peran berubah: keluarkan sesi lama supaya hak akses baru langsung berlaku
  await prisma.session.deleteMany({ where: { userId: user.id } });
  console.log(`Peran ${updated.email} diubah menjadi ${updated.role} oleh ${res.locals.user!.email}`);
  res.json({ ok: true, user: { email: updated.email, name: updated.name, role: updated.role } });
});
