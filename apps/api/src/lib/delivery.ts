// Setelah pesanan lunas: terbitkan tiket lalu kirim e-tiket ke email pembeli.
import { config } from '../config.ts';
import { prisma } from '../db.ts';
import { OrderStatus } from '../generated/prisma/client.ts';
import { buildETicketEmail } from './email/eticket.ts';
import { sendMail } from './email/mailer.ts';
import { issueTickets } from './tickets.ts';

const siteUrl = config.SITE_URL.replace(/\/$/, '');

/** Terbitkan tiket (kalau belum) dan kirim email. Kesalahan kirim dicatat di pesanan, tidak dilempar ulang. */
export async function deliverTickets(orderCode: string) {
  const order = await prisma.order.findUnique({ where: { code: orderCode } });
  if (!order || order.status !== OrderStatus.PAID) return { sent: false, reason: 'Pesanan belum lunas.' };

  await issueTickets(order.id);
  const full = await prisma.order.findUniqueOrThrow({
    where: { id: order.id },
    include: { tickets: { orderBy: { seq: 'asc' } } }
  });

  try {
    const mail = await buildETicketEmail(full, `${siteUrl}/pesanan/${full.code}`);
    await sendMail(mail);
    await prisma.order.update({ where: { id: order.id }, data: { ticketsEmailedAt: new Date(), ticketsEmailError: null } });
    return { sent: true };
  } catch (err) {
    const message = (err as Error).message.slice(0, 300);
    console.error(`Gagal mengirim e-tiket ${orderCode}:`, message);
    await prisma.order.update({ where: { id: order.id }, data: { ticketsEmailError: message } });
    return { sent: false, reason: 'Email gagal terkirim.' };
  }
}

/** Jalankan di belakang layar supaya webhook pembayaran tetap cepat dibalas */
export function deliverTicketsInBackground(orderCode: string) {
  deliverTickets(orderCode).catch(err => console.error(`Penerbitan tiket ${orderCode} gagal:`, err));
}
