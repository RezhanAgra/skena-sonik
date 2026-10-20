// Akses ke API Express.
// - Browser: memanggil path relatif `/api` di domain yang sama. Di produksi reverse proxy (Caddy/Nginx)
//   meneruskannya ke container API; di dev, proxy Vite (astro.config.mjs) yang meneruskan.
//   PUBLIC_API_URL hanya perlu diisi kalau API sengaja di-host di domain lain (perlu CORS_ORIGIN di API).
// - Server (SSR): buat client sendiri dengan API_URL dari `astro:env/server` (dibaca saat runtime).
import type { Buyer, CartItem, CartQuote, CheckoutResult, Festival, OrderView, Quote } from './types';

export class ApiError extends Error {}

type TicketInput = { tier: string; quantity: number; installment: boolean };

export function createApi(base: string) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(base.replace(/\/$/, '') + path, {
        ...init,
        headers: { 'Content-Type': 'application/json', ...init?.headers }
      });
    } catch {
      throw new ApiError('Server API tidak bisa dihubungi. Coba lagi sebentar lagi.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body.error ?? `Permintaan gagal (${res.status}).`);
    return body as T;
  }

  const post = <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) });

  return {
    festival: () => request<Festival>('/api/festival'),
    quote: (input: TicketInput) => post<Quote>('/api/tickets/quote', input),
    cartQuote: (items: CartItem[]) => post<CartQuote>('/api/cart/quote', { items }),
    checkout: (items: CartItem[], buyer: Buyer) => post<CheckoutResult>('/api/checkout', { items, buyer }),
    order: (code: string) => request<OrderView>(`/api/orders/${encodeURIComponent(code)}`),
    mockPay: (code: string, result: 'paid' | 'failed' | 'expired') => post<OrderView>(`/api/payments/mock/${encodeURIComponent(code)}`, { result }),
    subscribe: (email: string) => post<{ status: 'created' | 'exists'; email: string }>('/api/subscribers', { email })
  };
}

// dipakai oleh island React di browser
export const api = createApi(import.meta.env.PUBLIC_API_URL ?? '');
