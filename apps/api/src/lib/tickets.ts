// E-tiket: kode tiket, isi QR bertanda tangan, penerbitan tiket, dan aturan check-in gerbang.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { config } from '../config.ts';
import { prisma } from '../db.ts';
import { OrderStatus } from '../generated/prisma/client.ts';
import { EVENT, EVENT_DAYS } from './event.ts';
import { resolveWristband } from './wristbands.ts';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomChars = (n: number) => [...randomBytes(n)].map(b => ALPHABET[b % ALPHABET.length]).join('');

export const generateTicketCode = () => `TKT-${randomChars(4)}-${randomChars(4)}`;

/* ---------- isi QR ---------- */
// Format: SKS1.<kode tiket>.<tanda tangan>. Tanda tangan HMAC membuat QR tidak bisa dibuat-buat
// hanya dengan menebak kode tiket.
const PREFIX = 'SKS1';
const sign = (code: string) => createHmac('sha256', config.TICKET_SECRET).update(`${PREFIX}.${code}`).digest('base64url').slice(0, 22);

export const qrPayload = (code: string) => `${PREFIX}.${code}.${sign(code)}`;

/** Kembalikan kode tiket kalau isi QR asli, null kalau palsu/rusak */
export function verifyQrPayload(text: string): string | null {
  const [prefix, code, sig] = text.trim().split('.');
  if (prefix !== PREFIX || !code || !sig) return null;
  const expected = Buffer.from(sign(code));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? code : null;
}

/** Kode tiket dari isi QR e-tiket atau kode yang diketik petugas (TKT-XXXX-XXXX), null kalau bukan e-tiket */
export function ticketCodeFromInput(text: string) {
  const typed = text.trim().toUpperCase();
  if (/^TKT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(typed)) return typed;
  return verifyQrPayload(text);
}

const QR_OPTIONS = { errorCorrectionLevel: 'M' as const, margin: 2, color: { dark: '#050505', light: '#ffffff' } };
export const qrSvg = (code: string) => QRCode.toString(qrPayload(code), { ...QR_OPTIONS, type: 'svg' });
export const qrPng = (code: string) => QRCode.toBuffer(qrPayload(code), { ...QR_OPTIONS, type: 'png', width: 480 });

/* ---------- penerbitan ---------- */

/** Terbitkan satu tiket per orang untuk pesanan lunas. Aman dipanggil berulang (tidak menggandakan tiket). */
export async function issueTickets(orderId: number) {
  return prisma.$transaction(async tx => {
    const existing = await tx.ticket.count({ where: { orderId } });
    if (existing) return existing;

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { orderBy: { id: 'asc' }, include: { tier: true } } }
    });
    let seq = 0;
    const data = order.items.flatMap(item =>
      Array.from({ length: item.quantity }, () => ({
        code: generateTicketCode(),
        orderId,
        orderItemId: item.id,
        tierSlug: item.tierSlug,
        tierName: item.tierName,
        holderName: order.buyerName,
        seq: ++seq,
        daysAccess: item.tier.daysAccess
      }))
    );
    await tx.ticket.createMany({ data });
    return data.length;
  });
}

/* ---------- check-in gerbang ---------- */

export type CheckInResult =
  | { result: 'ok'; day: number; ticket: GateTicket; message: string }
  | { result: 'used' | 'wrong_day' | 'invalid'; day: number; ticket?: GateTicket; message: string };

export interface GateTicket {
  code: string;
  tierName: string;
  holderName: string;
  seq: number;
  totalInOrder: number;
  orderCode: string;
  daysAccess: number;
  checkIns: { day: number; at: Date; gate: string | null }[];
}

export async function checkIn(qrText: string, day: number, gate: string | null): Promise<CheckInResult> {
  if (!EVENT_DAYS.includes(day)) return { result: 'invalid', day, message: 'Hari festival tidak valid.' };

  // QR / kode gelang (hasil penukaran di booth) dipetakan ke tiketnya, dengan aturan hari gelang
  let code: string | null = null;
  const band = await resolveWristband(qrText);
  if (band) {
    if (band.voidedAt) return { result: 'invalid', day, message: `Gelang ${band.code} sudah dinonaktifkan (diganti gelang cetak ulang).` };
    if (!band.validDays.includes(day)) {
      return { result: 'wrong_day', day, message: `Gelang ${band.code} hanya berlaku ${band.validDays.map(d => EVENT.days[d]?.label.split(',')[0]).join(' & ')}.` };
    }
    code = band.ticket.code;
  }
  code ??= ticketCodeFromInput(qrText);
  if (!code) return { result: 'invalid', day, message: 'QR tidak dikenal. Bukan e-tiket atau gelang Skena Sonik, atau sudah dimodifikasi.' };

  const ticket = await prisma.ticket.findUnique({
    where: { code },
    include: { order: { include: { _count: { select: { tickets: true } } } }, checkIns: { orderBy: { day: 'asc' } } }
  });
  if (!ticket) return { result: 'invalid', day, message: 'Tiket tidak ditemukan.' };

  const view = (checkIns = ticket.checkIns): GateTicket => ({
    code: ticket.code,
    tierName: ticket.tierName,
    holderName: ticket.holderName,
    seq: ticket.seq,
    totalInOrder: ticket.order._count.tickets,
    orderCode: ticket.order.code,
    daysAccess: ticket.daysAccess,
    checkIns: checkIns.map(c => ({ day: c.day, at: c.createdAt, gate: c.gate }))
  });

  if (ticket.order.status !== OrderStatus.PAID) {
    return { result: 'invalid', day, ticket: view(), message: `Pesanan tiket ini berstatus ${ticket.order.status}, tidak berlaku untuk masuk.` };
  }

  const today = ticket.checkIns.find(c => c.day === day);
  if (today) {
    const at = today.createdAt.toLocaleTimeString('id-ID', { timeZone: EVENT.timeZone, hour: '2-digit', minute: '2-digit' });
    return { result: 'used', day, ticket: view(), message: `Sudah masuk hari ini pukul ${at} WIB${today.gate ? ` di ${today.gate}` : ''}.` };
  }
  if (ticket.checkIns.length >= ticket.daysAccess) {
    const used = ticket.checkIns.map(c => EVENT.days[c.day]?.label.split(',')[0]).join(' & ');
    return { result: 'wrong_day', day, ticket: view(), message: `${ticket.tierName} hanya untuk ${ticket.daysAccess} hari dan sudah dipakai ${used}.` };
  }

  try {
    const created = await prisma.ticketCheckIn.create({ data: { ticketId: ticket.id, day, gate } });
    return {
      result: 'ok',
      day,
      ticket: view([...ticket.checkIns, created]),
      message: `Silakan masuk. ${ticket.tierName}, tiket ${ticket.seq} dari ${ticket.order._count.tickets}.`
    };
  } catch (err) {
    // dua gerbang memindai tiket yang sama bersamaan: unique (ticketId, day) mencegah masuk dua kali
    if ((err as { code?: string }).code === 'P2002') {
      return { result: 'used', day, ticket: view(), message: 'Tiket ini baru saja dipindai di gerbang lain.' };
    }
    throw err;
  }
}
