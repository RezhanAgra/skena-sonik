// Gelang masuk: e-tiket ditukar di booth jadi gelang fisik ber-QR.
// QR gelang = SKW1.<kode gelang>.<tanda tangan HMAC>, bisa dipindai di gerbang seperti e-tiket.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import QRCode from 'qrcode';
import { config } from '../config.ts';
import { prisma } from '../db.ts';
import { OrderStatus } from '../generated/prisma/client.ts';
import { EVENT, EVENT_DAYS, accessLabel } from './event.ts';
import { ticketCodeFromInput } from './tickets.ts';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomChars = (n: number) => [...randomBytes(n)].map(b => ALPHABET[b % ALPHABET.length]).join('');
const generateWristbandCode = () => `WB-${randomChars(4)}-${randomChars(4)}`;

const PREFIX = 'SKW1';
const sign = (code: string) => createHmac('sha256', config.TICKET_SECRET).update(`${PREFIX}.${code}`).digest('base64url').slice(0, 22);
export const wristbandPayload = (code: string) => `${PREFIX}.${code}.${sign(code)}`;

function verifyWristbandPayload(text: string) {
  const [prefix, code, sig] = text.trim().split('.');
  if (prefix !== PREFIX || !code || !sig) return null;
  const a = Buffer.from(sign(code)), b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b) ? code : null;
}

/** Isi QR gelang atau kode gelang yang diketik (WB-XXXX-XXXX) → data gelang, null kalau bukan gelang */
export async function resolveWristband(text: string) {
  const typed = text.trim().toUpperCase();
  const code = /^WB-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(typed) ? typed : verifyWristbandPayload(text);
  if (!code) return null;
  return prisma.wristband.findUnique({ where: { code }, include: { ticket: true } });
}

// ukuran kecil supaya muat di gelang 25 mm; koreksi galat tinggi karena gelang bisa tertekuk/basah
export const wristbandQrSvg = (code: string) =>
  QRCode.toString(wristbandPayload(code), { type: 'svg', errorCorrectionLevel: 'Q', margin: 1, color: { dark: '#000000', light: '#ffffff' } });

export class WristbandError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

const TICKET_INCLUDE = {
  order: { select: { code: true, status: true, buyerName: true, _count: { select: { tickets: true } } } },
  checkIns: { orderBy: { day: 'asc' as const } },
  wristbands: { orderBy: { createdAt: 'desc' as const } }
};

/** Info tiket untuk layar booth penukaran */
export async function lookupTicket(input: string) {
  const code = ticketCodeFromInput(input);
  if (!code) {
    if (await resolveWristband(input)) throw new WristbandError('Ini QR gelang, bukan e-tiket. Pindai QR e-tiket dari email/HP penonton.');
    throw new WristbandError('QR tidak dikenal. Pindai QR e-tiket Skena Sonik.');
  }
  const ticket = await prisma.ticket.findUnique({ where: { code }, include: TICKET_INCLUDE });
  if (!ticket) throw new WristbandError('Tiket tidak ditemukan.', 404);
  return ticketView(ticket);
}

type TicketWithAll = NonNullable<Awaited<ReturnType<typeof prisma.ticket.findUnique<{ where: { code: string }; include: typeof TICKET_INCLUDE }>>>>;

async function ticketView(t: TicketWithAll) {
  const active = t.wristbands.find(w => !w.voidedAt) ?? null;
  return {
    code: t.code,
    tierSlug: t.tierSlug,
    tierName: t.tierName,
    holderName: t.holderName,
    seq: t.seq,
    totalInOrder: t.order._count.tickets,
    orderCode: t.order.code,
    orderStatus: t.order.status,
    access: accessLabel(t.daysAccess),
    daysAccess: t.daysAccess,
    checkIns: t.checkIns.map(c => ({ day: c.day, at: c.createdAt })),
    activeWristband: active && (await bandView(active, t)),
    history: t.wristbands.map(w => ({ code: w.code, createdAt: w.createdAt, voidedAt: w.voidedAt, reason: w.reason, issuedByName: w.issuedByName, booth: w.booth }))
  };
}

async function bandView(w: { code: string; validDays: number[]; createdAt: Date; issuedByName: string | null; reprintOf: string | null }, t: { tierSlug: string; tierName: string; holderName: string; seq: number; code: string }) {
  return {
    code: w.code,
    validDays: w.validDays,
    validLabel: w.validDays.map(d => EVENT.days[d]?.label.split(',')[0]).join(' & '),
    // ringkas untuk gelang: "12–13 Des 2026" atau "13 Des 2026"
    validDates: (() => {
      const dates = w.validDays.map(d => EVENT.days[d]?.date).filter(Boolean).sort();
      const dd = (iso: string) => Number(iso.slice(8, 10));
      const tail = new Date(`${dates[0]}T00:00:00`).toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
      return dates.length > 1 ? `${dd(dates[0])}–${dd(dates.at(-1)!)} ${tail}` : `${dd(dates[0])} ${tail}`;
    })(),
    createdAt: w.createdAt,
    issuedByName: w.issuedByName,
    reprintOf: w.reprintOf,
    tierSlug: t.tierSlug,
    tierName: t.tierName,
    holderName: t.holderName,
    ticketCode: t.code,
    qrSvg: await wristbandQrSvg(w.code)
  };
}

/**
 * Terbitkan gelang untuk tiket. Baris tiket dikunci (SELECT ... FOR UPDATE) supaya dua booth
 * yang memindai tiket yang sama bersamaan tidak menghasilkan dua gelang aktif.
 */
export async function issueWristband(opts: {
  ticketCode: string;
  day: number;
  booth: string | null;
  issuer: { id: number; name: string } | null;
  reprint: boolean;
  reason?: string;
}) {
  if (!EVENT_DAYS.includes(opts.day)) throw new WristbandError('Hari festival tidak valid.');

  const band = await prisma.$transaction(async tx => {
    const locked = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Ticket" WHERE code = ${opts.ticketCode} FOR UPDATE`;
    if (!locked.length) throw new WristbandError('Tiket tidak ditemukan.', 404);
    const ticket = await tx.ticket.findUniqueOrThrow({ where: { id: locked[0].id }, include: TICKET_INCLUDE });

    if (ticket.order.status !== OrderStatus.PAID) {
      throw new WristbandError(`Pesanan tiket ini berstatus ${ticket.order.status}, tidak bisa ditukar gelang.`, 409);
    }
    const active = ticket.wristbands.find(w => !w.voidedAt);
    if (active && !opts.reprint) {
      throw new WristbandError(`Tiket ini sudah ditukar dengan gelang ${active.code}. Gunakan "Cetak ulang" kalau gelang rusak/hilang.`, 409);
    }
    if (opts.reprint && !opts.reason?.trim()) throw new WristbandError('Tulis alasan cetak ulang (mis. gelang rusak).');

    // Daily Pass: gelang berlaku di hari tiketnya dipakai (atau hari penukaran); 2-Day/Pit: semua hari
    let validDays = EVENT_DAYS;
    if (ticket.daysAccess < EVENT_DAYS.length) {
      const usedDays = ticket.checkIns.map(c => c.day);
      if (usedDays.length && !usedDays.includes(opts.day)) {
        throw new WristbandError(`${ticket.tierName} ini sudah dipakai ${usedDays.map(d => EVENT.days[d]?.label.split(',')[0]).join(' & ')}; tidak berlaku untuk hari ini.`, 409);
      }
      validDays = usedDays.length ? usedDays.slice(0, ticket.daysAccess) : [opts.day];
    }

    if (active) await tx.wristband.update({ where: { id: active.id }, data: { voidedAt: new Date() } });
    const created = await tx.wristband.create({
      data: {
        code: generateWristbandCode(),
        ticketId: ticket.id,
        validDays,
        issuedById: opts.issuer?.id ?? null,
        issuedByName: opts.issuer?.name ?? null,
        booth: opts.booth,
        reprintOf: active?.code ?? null,
        reason: opts.reprint ? opts.reason!.trim().slice(0, 200) : null
      }
    });
    return { created, ticket };
  });

  console.log(`[gelang] ${band.created.code} untuk ${band.ticket.code}${band.created.reprintOf ? ` (cetak ulang ${band.created.reprintOf})` : ''}`);
  return bandView(band.created, band.ticket);
}
