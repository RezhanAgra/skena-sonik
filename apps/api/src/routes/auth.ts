// Akun: daftar, masuk, keluar, profil, verifikasi email, lupa/reset password
// POST  /api/auth/register            { name, email, password, phone? }
// POST  /api/auth/login               { email, password }
// POST  /api/auth/logout
// GET   /api/auth/me
// PATCH /api/auth/me                  { name, phone }
// POST  /api/auth/change-password     { currentPassword, newPassword }
// POST  /api/auth/verify-email        { token }
// POST  /api/auth/resend-verification
// POST  /api/auth/forgot-password     { email }
// POST  /api/auth/reset-password      { token, password }
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { config } from '../config.ts';
import { prisma } from '../db.ts';
import { Role } from '../generated/prisma/client.ts';
import { DUMMY_HASH, hashPassword, verifyPassword } from '../lib/auth/password.ts';
import { endSession, publicUser, requireUser, startSession } from '../lib/auth/session.ts';
import { EmailTokenType, consumeEmailToken, createEmailToken } from '../lib/auth/tokens.ts';
import { buildResetEmail, buildVerifyEmail } from '../lib/email/account.ts';
import { sendMail } from '../lib/email/mailer.ts';

const siteUrl = config.SITE_URL.replace(/\/$/, '');

const limit = (windowMinutes: number, max: number, message: string) => rateLimit({
  windowMs: windowMinutes * 60_000, limit: max, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: message }
});
const loginLimiter = limit(15, 10, 'Terlalu banyak percobaan masuk. Coba lagi 15 menit lagi.');
const registerLimiter = limit(60, 10, 'Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.');
const emailLimiter = limit(60, 5, 'Terlalu banyak permintaan email. Coba lagi 1 jam lagi.');

/* ---------- validasi ---------- */
const email = z.string().trim().toLowerCase().pipe(z.email({ message: 'Format email belum benar.' }));
const password = z.string()
  .min(8, 'Password minimal 8 karakter.')
  .max(128, 'Password terlalu panjang.')
  .refine(p => /[A-Za-z]/.test(p) && /\d/.test(p), 'Password harus berisi huruf dan angka.');
const name = z.string().trim().min(2, 'Nama minimal 2 huruf.').max(80, 'Nama terlalu panjang.');
const phone = z.string()
  .transform(s => s.replace(/[\s-]/g, '').replace(/^\+?62/, '0'))
  .pipe(z.string().regex(/^08\d{7,12}$/, 'Nomor HP harus nomor Indonesia, contoh 0812xxxxxxx.'))
  .optional()
  .or(z.literal('').transform(() => undefined));

/** Email di ORGANIZER_EMAILS otomatis jadi penyelenggara, tapi hanya setelah emailnya terverifikasi */
async function promoteIfOrganizer(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.emailVerifiedAt && config.organizerEmails.has(user.email) && user.role !== Role.ORGANIZER) {
    await prisma.user.update({ where: { id: userId }, data: { role: Role.ORGANIZER } });
    console.log(`Akun ${user.email} dijadikan ORGANIZER (ORGANIZER_EMAILS).`);
  }
}

async function sendVerification(user: { id: number; email: string; name: string }) {
  const token = await createEmailToken(user.id, EmailTokenType.VERIFY_EMAIL);
  await sendMail(buildVerifyEmail(user.email, user.name, `${siteUrl}/verifikasi?token=${token}`));
}

export const authRouter = Router();

authRouter.post('/register', registerLimiter, async (req, res) => {
  const input = z.object({ name, email, password, phone }).parse(req.body);
  const exists = await prisma.user.findUnique({ where: { email: input.email } });
  if (exists) {
    res.status(409).json({ error: 'Email ini sudah terdaftar. Silakan masuk, atau pakai "Lupa password".' });
    return;
  }
  const user = await prisma.user.create({
    data: { name: input.name, email: input.email, phone: input.phone, passwordHash: await hashPassword(input.password) }
  });
  await startSession(res, req, user.id);
  try {
    await sendVerification(user);
  } catch (err) {
    console.error('Email verifikasi gagal dikirim:', (err as Error).message);
  }
  res.status(201).json({ user: publicUser(user) });
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const input = z.object({ email, password: z.string().min(1, 'Isi password.') }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // tetap hitung hash walau email tidak ada, supaya waktu respons tidak membocorkan email terdaftar
  const ok = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    res.status(401).json({ error: 'Email atau password salah.' });
    return;
  }
  await promoteIfOrganizer(user.id);
  await startSession(res, req, user.id);
  const fresh = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  res.json({ user: publicUser(fresh) });
});

authRouter.post('/logout', async (req, res) => {
  await endSession(res, req);
  res.json({ ok: true });
});

authRouter.get('/me', (_req, res) => {
  if (!res.locals.user) {
    res.status(401).json({ error: 'Belum masuk.' });
    return;
  }
  res.json({ user: publicUser(res.locals.user) });
});

authRouter.patch('/me', requireUser, async (req, res) => {
  const input = z.object({ name, phone }).parse(req.body);
  const user = await prisma.user.update({ where: { id: res.locals.user!.id }, data: { name: input.name, phone: input.phone ?? null } });
  res.json({ user: publicUser(user) });
});

authRouter.post('/change-password', requireUser, loginLimiter, async (req, res) => {
  const input = z.object({ currentPassword: z.string().min(1, 'Isi password lama.'), newPassword: password }).parse(req.body);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: res.locals.user!.id } });
  if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
    res.status(400).json({ error: 'Password lama salah.' });
    return;
  }
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.newPassword) } });
  // keluarkan sesi lain (perangkat lain), sesi sekarang tetap aktif
  await prisma.session.deleteMany({ where: { userId: user.id, NOT: { id: res.locals.sessionId } } });
  res.json({ ok: true });
});

authRouter.post('/verify-email', async (req, res) => {
  const { token } = z.object({ token: z.string().min(10, 'Link verifikasi tidak valid.') }).parse(req.body);
  const userId = await consumeEmailToken(token, EmailTokenType.VERIFY_EMAIL);
  if (!userId) {
    res.status(400).json({ error: 'Link verifikasi tidak valid atau sudah kedaluwarsa. Minta link baru dari halaman akun.' });
    return;
  }
  await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  await promoteIfOrganizer(userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  res.json({ user: publicUser(user) });
});

authRouter.post('/resend-verification', requireUser, emailLimiter, async (_req, res) => {
  const user = res.locals.user!;
  if (user.emailVerifiedAt) {
    res.json({ ok: true, alreadyVerified: true });
    return;
  }
  await sendVerification(user);
  res.json({ ok: true });
});

authRouter.post('/forgot-password', emailLimiter, async (req, res) => {
  const input = z.object({ email }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (user) {
    const token = await createEmailToken(user.id, EmailTokenType.RESET_PASSWORD);
    await sendMail(buildResetEmail(user.email, user.name, `${siteUrl}/reset-password?token=${token}`)).catch(err =>
      console.error('Email reset password gagal dikirim:', (err as Error).message));
  }
  // jawaban selalu sama supaya tidak bisa dipakai untuk mengecek email terdaftar
  res.json({ ok: true, message: 'Kalau email itu terdaftar, link untuk membuat password baru sudah dikirim. Cek juga folder Spam.' });
});

authRouter.post('/reset-password', loginLimiter, async (req, res) => {
  const input = z.object({ token: z.string().min(10, 'Link tidak valid.'), password }).parse(req.body);
  const userId = await consumeEmailToken(input.token, EmailTokenType.RESET_PASSWORD);
  if (!userId) {
    res.status(400).json({ error: 'Link reset password tidak valid atau sudah kedaluwarsa. Minta link baru.' });
    return;
  }
  // membuka link dari email = bukti pemilik email, jadi sekalian dianggap terverifikasi
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.password), emailVerifiedAt: new Date() }
  });
  await prisma.session.deleteMany({ where: { userId } }); // keluarkan semua sesi lama
  await promoteIfOrganizer(userId);
  await startSession(res, req, userId);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  res.json({ user: publicUser(user) });
});
