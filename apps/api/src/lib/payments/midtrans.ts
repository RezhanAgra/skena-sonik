// Midtrans Snap: https://docs.midtrans.com/reference/backend-integration
import { createHash, timingSafeEqual } from 'node:crypto';
import { OrderStatus } from '../../generated/prisma/client.ts';
import { PaymentError, type PaymentOrder, type PaymentProvider, type PaymentUpdate } from './types.ts';

interface MidtransOptions {
  serverKey: string;
  clientKey: string;
  isProduction: boolean;
  siteUrl: string;
}

/** Field notifikasi/status Midtrans yang kita pakai */
export interface MidtransStatus {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key?: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
}

// https://docs.midtrans.com/docs/https-notification-webhooks#status-definition
export function mapMidtransStatus(s: Pick<MidtransStatus, 'transaction_status' | 'fraud_status'>): OrderStatus {
  switch (s.transaction_status) {
    case 'capture':
      return s.fraud_status === 'accept' || !s.fraud_status ? OrderStatus.PAID : OrderStatus.PENDING;
    case 'settlement':
      return OrderStatus.PAID;
    case 'pending':
    case 'authorize':
      return OrderStatus.PENDING;
    case 'deny':
    case 'failure':
      return OrderStatus.FAILED;
    case 'cancel':
      return OrderStatus.CANCELLED;
    case 'expire':
      return OrderStatus.EXPIRED;
    case 'refund':
    case 'partial_refund':
      return OrderStatus.REFUNDED;
    default:
      return OrderStatus.PENDING;
  }
}

export function toUpdate(s: MidtransStatus): PaymentUpdate {
  return {
    status: mapMidtransStatus(s),
    paymentType: s.payment_type ?? null,
    grossAmount: Math.round(Number(s.gross_amount))
  };
}

/** signature_key = SHA512(order_id + status_code + gross_amount + server_key) */
export function verifyMidtransSignature(n: MidtransStatus, serverKey: string): boolean {
  if (!n.signature_key) return false;
  const expected = createHash('sha512').update(n.order_id + n.status_code + n.gross_amount + serverKey).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(n.signature_key);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createMidtrans(opts: MidtransOptions): PaymentProvider {
  const snapBase = opts.isProduction ? 'https://app.midtrans.com' : 'https://app.sandbox.midtrans.com';
  const apiBase = opts.isProduction ? 'https://api.midtrans.com' : 'https://api.sandbox.midtrans.com';
  const auth = 'Basic ' + Buffer.from(opts.serverKey + ':').toString('base64');

  async function call<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: auth, ...init?.headers },
      signal: AbortSignal.timeout(15_000)
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 404) {
      console.error('Midtrans error', res.status, body);
      throw new PaymentError('Payment gateway sedang bermasalah. Coba lagi sebentar lagi.');
    }
    return body as T;
  }

  return {
    name: 'midtrans',

    async createSession(order: PaymentOrder) {
      // total harga item harus sama persis dengan gross_amount, jadi biaya layanan ikut jadi item
      const itemDetails = [
        ...order.items.map(i => ({ id: i.tierSlug, name: i.tierName.slice(0, 50), price: i.unitPrice, quantity: i.quantity })),
        ...(order.fee ? [{ id: 'service-fee', name: 'Biaya layanan', price: order.fee, quantity: 1 }] : [])
      ];
      const body = await call<{ token?: string; redirect_url?: string }>(`${snapBase}/snap/v1/transactions`, {
        method: 'POST',
        body: JSON.stringify({
          transaction_details: { order_id: order.code, gross_amount: order.total },
          item_details: itemDetails,
          customer_details: { first_name: order.buyerName.slice(0, 50), email: order.buyerEmail, phone: order.buyerPhone },
          callbacks: { finish: `${opts.siteUrl}/pesanan/${order.code}` },
          expiry: { unit: 'hours', duration: 24 }
        })
      });
      if (!body.token || !body.redirect_url) throw new PaymentError('Gagal membuat sesi pembayaran Midtrans.');
      return {
        token: body.token,
        redirectUrl: body.redirect_url,
        snap: { clientKey: opts.clientKey, scriptUrl: `${snapBase}/snap/snap.js` }
      };
    },

    async fetchStatus(code: string) {
      const s = await call<MidtransStatus & { status_code: string }>(`${apiBase}/v2/${encodeURIComponent(code)}/status`);
      // 404 = pembeli belum memilih metode pembayaran di Snap
      if (!s.transaction_status || s.status_code === '404') return null;
      return toUpdate(s);
    }
  };
}
