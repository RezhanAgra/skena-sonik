// Helper SSR: baca akun yang sedang masuk dengan meneruskan cookie pengunjung ke API
import type { AstroGlobal } from 'astro';
import { API_URL } from 'astro:env/server';
import { createApi } from './api';
import type { AuthUser, Role } from './types';

export function serverApi(Astro: AstroGlobal) {
  const cookie = Astro.request.headers.get('cookie');
  return createApi(API_URL, cookie ? { cookie } : {});
}

export async function getUser(Astro: AstroGlobal): Promise<AuthUser | null> {
  if (!Astro.request.headers.get('cookie')?.includes('ss_session=')) return null;
  try {
    return (await serverApi(Astro).auth.me()).user;
  } catch {
    return null;
  }
}

/** Arahkan ke halaman masuk kalau belum login (atau perannya tidak cukup) */
export async function requireUser(Astro: AstroGlobal, roles?: Role[]) {
  const user = await getUser(Astro);
  const next = Astro.url.pathname + Astro.url.search;
  if (!user) return { user: null, redirect: Astro.redirect(`/masuk?next=${encodeURIComponent(next)}`) } as const;
  if (roles && !roles.includes(user.role)) return { user, redirect: null, forbidden: true } as const;
  return { user, redirect: null, forbidden: false } as const;
}

/** Hanya izinkan redirect ke path di situs sendiri (cegah open redirect) */
export const safeNext = (next: string | null, fallback = '/akun') =>
  next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
