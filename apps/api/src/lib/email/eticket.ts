// Template email e-tiket. Ditulis dengan tabel + inline style supaya tampil rapi di Gmail, Outlook, dan aplikasi mail HP.
import { EVENT, accessLabel } from '../event.ts';
import { qrPng } from '../tickets.ts';
import type { Mail, MailAttachment } from './mailer.ts';

export interface ETicketOrder {
  code: string;
  buyerName: string;
  buyerEmail: string;
  total: number;
  paidAt: Date | null;
  tickets: { code: string; tierName: string; holderName: string; seq: number; daysAccess: number }[];
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID');

const C = { bg: '#0a0a0a', panel: '#141416', line: '#2a2a2e', red: '#ff1f1f', text: '#f5f3f3', muted: '#a9a3a3' };
const font = "font-family:'Archivo','Helvetica Neue',Arial,sans-serif;";
const mono = "font-family:'JetBrains Mono',Menlo,Consolas,monospace;";

export async function buildETicketEmail(order: ETicketOrder, orderUrl: string): Promise<Mail> {
  const total = order.tickets.length;
  const attachments: MailAttachment[] = await Promise.all(order.tickets.map(async t => ({
    filename: `${t.code}.png`,
    content: await qrPng(t.code),
    cid: `qr-${t.code}@skenasonik`,
    contentType: 'image/png'
  })));

  const ticketBlocks = order.tickets.map(t => `
    <tr><td style="padding:0 0 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.panel};border:1px solid ${C.line};border-radius:14px;">
        <tr><td style="padding:18px 20px 6px;${font}">
          <span style="${mono}font-size:11px;letter-spacing:2px;color:${C.red};text-transform:uppercase;">Tiket ${t.seq} dari ${total}</span>
          <div style="font-size:22px;font-weight:900;color:${C.text};text-transform:uppercase;margin-top:4px;">${esc(t.tierName)}</div>
          <div style="font-size:13px;color:${C.muted};margin-top:2px;">${esc(accessLabel(t.daysAccess))}</div>
        </td></tr>
        <tr><td align="center" style="padding:14px 20px;">
          <img src="cid:qr-${t.code}@skenasonik" width="220" height="220" alt="QR tiket ${t.code}" style="display:block;width:220px;height:220px;border-radius:10px;background:#ffffff;" />
        </td></tr>
        <tr><td align="center" style="padding:0 20px 18px;${font}">
          <div style="${mono}font-size:18px;font-weight:700;letter-spacing:2px;color:${C.text};">${t.code}</div>
          <div style="font-size:13px;color:${C.muted};margin-top:4px;">Atas nama ${esc(t.holderName)}</div>
        </td></tr>
      </table>
    </td></tr>`).join('');

  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark light"><title>E-tiket ${order.code}</title></head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;">${total} e-tiket ${esc(EVENT.shortName)} untuk pesanan ${order.code}. Tunjukkan QR di gerbang.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};">
  <tr><td align="center" style="padding:28px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
      <tr><td align="center" style="padding-bottom:20px;${font}">
        <div style="font-family:'Pirata One',Georgia,serif;font-size:40px;line-height:1;color:${C.red};text-transform:uppercase;">Skena Sonik</div>
        <div style="${mono}font-size:11px;letter-spacing:4px;color:${C.muted};margin-top:6px;">TOUR 2026</div>
      </td></tr>
      <tr><td style="padding:0 0 20px;${font}color:${C.text};">
        <h1 style="margin:0 0 8px;font-size:26px;font-weight:900;text-transform:uppercase;">Tiketmu sudah aman, ${esc(order.buyerName.split(' ')[0])}!</h1>
        <p style="margin:0;font-size:15px;line-height:1.6;color:${C.muted};">Pembayaran untuk pesanan <b style="color:${C.text};">${order.code}</b> sudah kami terima (${rupiah(order.total)}). Berikut ${total} e-tiket kamu. Setiap QR berlaku untuk satu orang.</p>
      </td></tr>
      <tr><td style="padding:0 0 20px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.red};border-radius:14px;">
          <tr><td style="padding:16px 20px;${font}font-size:14px;line-height:1.7;color:${C.text};">
            <b style="text-transform:uppercase;">${esc(EVENT.name)}</b><br>
            ${Object.values(EVENT.days).map(d => esc(d.label)).join(' &amp; ')}<br>
            ${esc(EVENT.venue)} · Gerbang buka ${esc(EVENT.gatesOpen)}
          </td></tr>
        </table>
      </td></tr>
      ${ticketBlocks}
      <tr><td style="padding:4px 0 20px;${font}font-size:14px;line-height:1.7;color:${C.muted};">
        <b style="color:${C.text};">Cara masuk</b><br>
        1. Tunjukkan QR di HP (atau hasil cetak) ke petugas gerbang.<br>
        2. Naikkan kecerahan layar supaya QR mudah dipindai.<br>
        3. Setiap QR hanya bisa dipakai sekali per hari. Jangan bagikan foto QR ke orang lain.
      </td></tr>
      <tr><td align="center" style="padding:0 0 24px;">
        <a href="${orderUrl}" style="${font}display:inline-block;background:${C.red};color:#ffffff;font-weight:800;font-size:14px;text-transform:uppercase;letter-spacing:1px;text-decoration:none;padding:14px 24px;border-radius:10px;">Lihat tiket di website</a>
      </td></tr>
      <tr><td style="border-top:1px solid ${C.line};padding-top:16px;${font}font-size:12px;line-height:1.6;color:${C.muted};">
        Email ini dikirim ke ${esc(order.buyerEmail)} karena kamu membeli tiket ${esc(EVENT.shortName)}. Simpan email ini sampai hari acara.<br>
        Skena Sonik Tour 2026 adalah proyek mockup; acara dan tiket tidak sungguhan.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;

  const text = [
    `Tiketmu sudah aman, ${order.buyerName}!`,
    '',
    `Pesanan ${order.code} sudah lunas (${rupiah(order.total)}).`,
    `${EVENT.name}`,
    `${Object.values(EVENT.days).map(d => d.label).join(' & ')} · ${EVENT.venue} · Gerbang buka ${EVENT.gatesOpen}`,
    '',
    ...order.tickets.map(t => `Tiket ${t.seq}/${total} · ${t.tierName} · ${t.code} (${accessLabel(t.daysAccess)})`),
    '',
    'QR setiap tiket ada di versi HTML email ini dan di halaman pesanan:',
    orderUrl
  ].join('\n');

  return {
    to: order.buyerEmail,
    subject: `E-tiket ${EVENT.shortName} · Pesanan ${order.code}`,
    html,
    text,
    attachments
  };
}
