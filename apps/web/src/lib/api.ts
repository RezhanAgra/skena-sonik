// Akses ke API Express. Server (SSR) memakai API_URL, browser memakai PUBLIC_API_URL.
import type { Festival, Quote } from './types';

const base = import.meta.env.SSR
  ? (import.meta.env.API_URL ?? 'http://localhost:4000')
  : (import.meta.env.PUBLIC_API_URL ?? 'http://localhost:4000');

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(base + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers }
    });
  } catch {
    throw new ApiError('Server API tidak bisa dihubungi. Pastikan `npm run dev` berjalan.');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.error ?? `Permintaan gagal (${res.status}).`);
  return body as T;
}

const post = <T>(path: string, data: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(data) });

export const api = {
  festival: () => request<Festival>('/api/festival'),
  quote: (input: { tier: string; quantity: number; installment: boolean }) => post<Quote>('/api/tickets/quote', input),
  order: (input: { tier: string; quantity: number; installment: boolean }) => post<Quote & { id: number }>('/api/orders', input),
  subscribe: (email: string) => post<{ status: 'created' | 'exists'; email: string }>('/api/subscribers', { email })
};
