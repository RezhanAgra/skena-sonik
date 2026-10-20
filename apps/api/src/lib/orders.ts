// Logika pesanan: kode pesanan, perubahan status dari payment gateway, dan bentuk data publik.
import { randomBytes } from 'node:crypto';
import { prisma } from '../db.ts';
import { OrderStatus, type Order, type OrderItem } from '../generated/prisma/client.ts';
import type { PaymentUpdate } from './payments/index.ts';

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

  const statusChanges = update.status !== order.status && ALLOWED[order.status].includes(update.status);
  if (!statusChanges && (update.paymentType ?? order.paymentType) === order.paymentType) return order;

  const updated = await prisma.order.update({
    where: { code },
    data: {
      ...(statusChanges ? { status: update.status } : {}),
      ...(statusChanges && update.status === OrderStatus.PAID ? { paidAt: new Date() } : {}),
      paymentType: update.paymentType ?? order.paymentType
    }
  });
  if (statusChanges) console.log(`Pesanan ${code}: ${order.status} → ${update.status}`);
  return updated;
}

const maskEmail = (email: string) => email.replace(/^(.{2})[^@]*(@.*)$/, (_, a, b) => `${a}***${b}`);

/** Data pesanan yang aman ditampilkan ke siapa pun yang tahu kodenya */
export function publicOrder(order: Order & { items: OrderItem[] }) {
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
    createdAt: order.createdAt
  };
}
