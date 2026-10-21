// Akses ke API Express.
// - Browser: memanggil path relatif `/api` di domain yang sama. Di produksi reverse proxy (Caddy/Nginx)
//   meneruskannya ke container API; di dev, proxy Vite (astro.config.mjs) yang meneruskan.
//   PUBLIC_API_URL hanya perlu diisi kalau API sengaja di-host di domain lain (perlu CORS_ORIGIN di API).
// - Server (SSR): buat client sendiri dengan API_URL dari `astro:env/server` (dibaca saat runtime).
import type { AdminOrderPage, AdminStats, AuthUser, Buyer, CartItem, CartQuote, CheckInResult, CheckoutResult, Festival, GateInfo, GateStats, MyOrders, OrderView, Quote, Role, TeamMember } from './types';

export class ApiError extends Error {}

type TicketInput = { tier: string; quantity: number; installment: boolean };

/** `extraHeaders`: dipakai SSR untuk meneruskan cookie sesi pengunjung ke API */
export function createApi(base: string, extraHeaders: Record<string, string> = {}) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(base.replace(/\/$/, '') + path, {
        ...init,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', ...extraHeaders, ...init?.headers }
      });
    } catch {
      throw new ApiError('Server API tidak bisa dihubungi. Coba lagi sebentar lagi.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body.error ?? `Permintaan gagal (${res.status}).`);
    return body as T;
  }

  const post = <T>(path: string, data: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(data) });
  const patch = <T>(path: string, data: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(data) });

  return {
    festival: () => request<Festival>('/api/festival'),
    quote: (input: TicketInput) => post<Quote>('/api/tickets/quote', input),
    cartQuote: (items: CartItem[]) => post<CartQuote>('/api/cart/quote', { items }),
    checkout: (items: CartItem[], buyer: Buyer) => post<CheckoutResult>('/api/checkout', { items, buyer }),
    order: (code: string) => request<OrderView>(`/api/orders/${encodeURIComponent(code)}`),
    mockPay: (code: string, result: 'paid' | 'failed' | 'expired') => post<OrderView>(`/api/payments/mock/${encodeURIComponent(code)}`, { result }),
    resendTickets: (code: string) => post<OrderView>(`/api/orders/${encodeURIComponent(code)}/resend-tickets`, {}),
    // token = PIN bersama GATE_TOKEN; kosong = pakai sesi akun petugas/penyelenggara
    gate: (token?: string) => {
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      return {
        me: () => request<GateInfo>('/api/gate/me', { headers }),
        stats: () => request<GateStats>('/api/gate/stats', { headers }),
        checkIn: (qr: string, day: number, gate: string) =>
          request<CheckInResult>('/api/gate/check-in', { method: 'POST', headers, body: JSON.stringify({ qr, day, gate }) })
      };
    },
    subscribe: (email: string) => post<{ status: 'created' | 'exists'; email: string }>('/api/subscribers', { email }),

    auth: {
      me: () => request<{ user: AuthUser }>('/api/auth/me'),
      register: (input: { name: string; email: string; password: string; phone?: string }) => post<{ user: AuthUser }>('/api/auth/register', input),
      login: (email: string, password: string) => post<{ user: AuthUser }>('/api/auth/login', { email, password }),
      logout: () => post<{ ok: true }>('/api/auth/logout'),
      updateMe: (input: { name: string; phone: string }) => patch<{ user: AuthUser }>('/api/auth/me', input),
      changePassword: (currentPassword: string, newPassword: string) => post<{ ok: true }>('/api/auth/change-password', { currentPassword, newPassword }),
      verifyEmail: (token: string) => post<{ user: AuthUser }>('/api/auth/verify-email', { token }),
      resendVerification: () => post<{ ok: true; alreadyVerified?: boolean }>('/api/auth/resend-verification'),
      forgotPassword: (email: string) => post<{ ok: true; message: string }>('/api/auth/forgot-password', { email }),
      resetPassword: (token: string, password: string) => post<{ user: AuthUser }>('/api/auth/reset-password', { token, password })
    },
    myOrders: () => request<MyOrders>('/api/me/orders'),
    admin: {
      stats: () => request<AdminStats>('/api/admin/stats'),
      orders: (params: { q?: string; status?: string; page?: number }) =>
        request<AdminOrderPage>(`/api/admin/orders?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))}`),
      resend: (code: string) => post<{ ok: true; sentTo: string }>(`/api/admin/orders/${encodeURIComponent(code)}/resend`),
      team: () => request<{ team: TeamMember[] }>('/api/admin/team'),
      setRole: (email: string, role: Role) => post<{ ok: true; user: { email: string; name: string; role: Role } }>('/api/admin/team', { email, role })
    }
  };
}

// dipakai oleh island React di browser
export const api = createApi(import.meta.env.PUBLIC_API_URL ?? '');
