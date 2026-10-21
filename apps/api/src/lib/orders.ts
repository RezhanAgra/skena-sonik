// Logika pesanan: kode pesanan, perubahan status dari payment gateway, dan bentuk data publik.
import { randomBytes } from 'node:crypto';
import { config } from '../config.ts';
import { prisma } from '../db.ts';
import { OrderStatus, type Order, type OrderItem, type Ticket, type TicketCheckIn } from '../generated/prisma/client.ts';
import { deliverTicketsInBackground } from './delivery.ts';
import { EVENT, accessLabel, ticketDateLabel } from './event.ts';
import type { PaymentUpdate } from './payments/index.ts';
import { qrSvg } from './tickets.ts';

// tanpa huruf yang mirip angka (0/O, 1/I/L) supaya mudah dibacakan ke CS
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function generateOrderCode() {
  const bytes = randomBytes(10);
  return 'SKN-' + [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('');
}

// status mana yang boleh berganti ke status apa (notifikasi gateway bisa datang tidak berurutan)
const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'FAILED', 'EXPIRED', 'CANCELLED'],
  PAID: ['REFUNDED'],
  FAILED: ['PAID'],
  EXPIRED: ['PAID'],
  CANCELLED: ['PAID'],
  REFUNDED: []
};

/** Terapkan status dari gateway ke pesanan. Mengembalikan pesanan terbaru, atau null kalau pesanan tidak ada. */
export async function applyPaymentUpdate(code: string, update: PaymentUpdate) {
  const order = await prisma.order.findUnique({ where: { code } });
  if (!order) return null;

  if (update.grossAmount !== order.total) {
    console.error(`Nominal pembayaran ${code} tidak cocok: gateway ${update.grossAmount}, pesanan ${order.total}`);
    return order;
  }

  const wantsChange = update.status !== order.status && ALLOWED[order.status].includes(update.status);
  if (wantsChange) {
    // atomik: hanya berubah kalau status di DB masih sama dengan yang kita baca.
    // Webhook dan polling halaman bisa datang bersamaan; hanya satu yang "menang".
    const { count } = await prisma.order.updateMany({
      where: { code, status: order.status },
      data: {
        status: update.status,
        ...(update.status === OrderStatus.PAID ? { paidAt: new Date() } : {}),
        paymentType: update.paymentType ?? order.paymentType
      }
    });
    if (count === 1) {
      console.log(`Pesanan ${code}: ${order.status} → ${update.status}`);
      if (update.status === OrderStatus.PAID) deliverTicketsInBackground(code);
    }
  } else if (update.paymentType && update.paymentType !== order.paymentType) {
    await prisma.order.update({ where: { code }, data: { paymentType: update.paymentType } });
  }
  return prisma.order.findUniqueOrThrow({ where: { code } });
}

const maskEmail = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, (_, a, b) => `${a}***${b}`);

type FullOrder = Order & { items: OrderItem[]; tickets: (Ticket & { checkIns: TicketCheckIn[] })[] };

export const ORDER_INCLUDE = {
  items: true,
  tickets: { orderBy: { seq: 'asc' }, include: { checkIns: { orderBy: { day: 'asc' } } } }
} as const;

/** Data pesanan yang aman ditampilkan ke siapa pun yang tahu kodenya (kode pesanan = tautan rahasia) */
export async function publicOrder(order: FullOrder) {
  const paid = order.status === OrderStatus.PAID;
  return {
    code: order.code,
    status: order.status,
    buyerName: order.buyerName,
    buyerEmail: maskEmail(order.buyerEmail),
    items: order.items.map(i => ({ tier: i.tierSlug, tierName: i.tierName, quantity: i.quantity, unitPrice: i.unitPrice, subtotal: i.subtotal })),
    subtotal: order.subtotal,
    fee: order.fee,
    total: order.total,
    paymentProvider: order.paymentProvider,
    paymentType: order.paymentType,
    paymentUrl: order.status === OrderStatus.PENDING ? order.paymentUrl : null,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    ticketsEmailedAt: order.ticketsEmailedAt,
    // log = mode development: email hanya disimpan sebagai file, tidak benar-benar dikirim
    emailDelivery: config.EMAIL_PROVIDER,
    ticketsEmailFailed: Boolean(order.ticketsEmailError) && !order.ticketsEmailedAt,
    event: { name: EVENT.name, location: EVENT.location, hours: EVENT.hours },
    // QR hanya ditampilkan untuk pesanan lunas
    tickets: paid
      ? await Promise.all(order.tickets.map(async t => ({
          code: t.code,
          tierName: t.tierName,
          holderName: t.holderName,
          seq: t.seq,
          access: accessLabel(t.daysAccess),
          dateLabel: ticketDateLabel(t.daysAccess),
          checkIns: t.checkIns.map(c => ({ day: c.day, at: c.createdAt })),
          qrSvg: await qrSvg(t.code)
        })))
      : []
  };
}
