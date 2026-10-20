import type { OrderStatus } from '../../generated/prisma/client.ts';

export interface PaymentOrder {
  code: string;
  total: number;
  fee: number;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  items: { tierSlug: string; tierName: string; quantity: number; unitPrice: number }[];
}

/** Data yang dikirim ke browser untuk membuka pembayaran */
export interface PaymentSession {
  token: string | null;
  redirectUrl: string;
  /** Midtrans Snap: client key + URL snap.js untuk membuka popup. Null untuk mock. */
  snap: { clientKey: string; scriptUrl: string } | null;
}

/** Status terbaru dari gateway, sudah dipetakan ke OrderStatus */
export interface PaymentUpdate {
  status: OrderStatus;
  paymentType: string | null;
  grossAmount: number;
}

export interface PaymentProvider {
  name: 'midtrans' | 'mock';
  createSession(order: PaymentOrder): Promise<PaymentSession>;
  /** Tanyakan status langsung ke gateway (dipakai kalau webhook belum sampai). Null = tidak didukung. */
  fetchStatus(code: string): Promise<PaymentUpdate | null>;
}

export class PaymentError extends Error {
  status = 502;
}
