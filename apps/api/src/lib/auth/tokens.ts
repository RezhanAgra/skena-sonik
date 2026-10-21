// Token sekali pakai untuk link di email (verifikasi email & reset password)
import { randomBytes } from 'node:crypto';
import { prisma } from '../../db.ts';
import { EmailTokenType } from '../../generated/prisma/client.ts';
import { sha256 } from './session.ts';

const TTL_MS: Record<EmailTokenType, number> = {
  VERIFY_EMAIL: 3 * 86_400_000, // 3 hari
  RESET_PASSWORD: 60 * 60_000 // 1 jam
};

export async function createEmailToken(userId: number, type: EmailTokenType) {
  // token lama yang belum dipakai untuk tujuan yang sama dibatalkan
  await prisma.emailToken.deleteMany({ where: { userId, type, usedAt: null } });
  const token = randomBytes(32).toString('base64url');
  await prisma.emailToken.create({ data: { tokenHash: sha256(token), type, userId, expiresAt: new Date(Date.now() + TTL_MS[type]) } });
  return token;
}

/** Tandai token terpakai dan kembalikan userId, atau null kalau token salah/kedaluwarsa/sudah dipakai */
export async function consumeEmailToken(token: string, type: EmailTokenType) {
  const row = await prisma.emailToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!row || row.type !== type || row.usedAt || row.expiresAt < new Date()) return null;
  const { count } = await prisma.emailToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? row.userId : null;
}

export { EmailTokenType };
