// Sesi login berbasis cookie HttpOnly. Token acak hanya ada di cookie; database menyimpan hash-nya.
import { createHash, randomBytes } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { config } from '../../config.ts';
import { prisma } from '../../db.ts';
import { Role, type User } from '../../generated/prisma/client.ts';

export const SESSION_COOKIE = 'ss_session';
export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'phone' | 'role' | 'emailVerifiedAt'>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals { user?: SessionUser; sessionId?: number }
  }
}

function readCookie(req: Request, name: string) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function cookieOptions(maxAgeMs: number) {
  return { httpOnly: true, secure: config.secureCookies, sameSite: 'lax' as const, path: '/', maxAge: maxAgeMs };
}

export async function startSession(res: Response, req: Request, userId: number) {
  const token = randomBytes(32).toString('base64url');
  const maxAge = config.SESSION_DAYS * 86_400_000;
  await prisma.session.create({
    data: { tokenHash: sha256(token), userId, userAgent: req.get('user-agent')?.slice(0, 200), expiresAt: new Date(Date.now() + maxAge) }
  });
  res.cookie(SESSION_COOKIE, token, cookieOptions(maxAge));
}

export async function endSession(res: Response, req: Request) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) await prisma.session.deleteMany({ where: { tokenHash: sha256(token) } });
  res.clearCookie(SESSION_COOKIE, { ...cookieOptions(0), maxAge: undefined });
}

const USER_SELECT = { id: true, email: true, name: true, phone: true, role: true, emailVerifiedAt: true } as const;

/** Baca cookie sesi di setiap request; kalau valid, isi res.locals.user */
export const loadUser: RequestHandler = async (req, res, next) => {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) return next();
  const session = await prisma.session.findUnique({ where: { tokenHash: sha256(token) }, include: { user: { select: USER_SELECT } } });
  if (!session || session.expiresAt < new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    res.clearCookie(SESSION_COOKIE, { ...cookieOptions(0), maxAge: undefined });
    return next();
  }
  res.locals.user = session.user;
  res.locals.sessionId = session.id;
  next();
};

export const requireUser: RequestHandler = (_req, res, next) => {
  if (!res.locals.user) {
    res.status(401).json({ error: 'Silakan masuk dulu.' });
    return;
  }
  next();
};

export const requireRole = (...roles: Role[]): RequestHandler => (_req, res, next) => {
  const user = res.locals.user;
  if (!user) {
    res.status(401).json({ error: 'Silakan masuk dulu.' });
    return;
  }
  if (!roles.includes(user.role)) {
    res.status(403).json({ error: 'Akunmu tidak punya akses ke halaman ini.' });
    return;
  }
  next();
};

/**
 * Perlindungan CSRF: permintaan yang mengubah data (POST/PATCH/DELETE) dari browser
 * harus berasal dari situs kita sendiri. Cookie SameSite=Lax sudah memblokir sebagian besar,
 * ini lapisan kedua. Request tanpa header Origin (curl, server-ke-server, webhook) tetap lolos.
 */
export const checkOrigin: RequestHandler = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next();
  const allowed = new Set([config.siteOrigin, ...config.corsOrigins.map(o => new URL(o).origin)]);
  // development: Astro bisa pindah ke port lain (4322, 4323, ...) kalau 4321 sedang dipakai
  const localDev = !config.isProduction && /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  if (!allowed.has(origin) && !localDev) {
    res.status(403).json({ error: 'Permintaan ditolak (asal tidak dikenal).' });
    return;
  }
  next();
};

/** Data akun yang aman dikirim ke browser */
export const publicUser = (u: SessionUser) => ({
  id: u.id,
  email: u.email,
  name: u.name,
  phone: u.phone,
  role: u.role,
  emailVerified: Boolean(u.emailVerifiedAt)
});
