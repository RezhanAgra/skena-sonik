// PDF e-tiket: satu halaman A4 per tiket + halaman Syarat & Ketentuan.
// pdf-lib dipakai karena murni JavaScript (tanpa baca file font), aman di-bundle esbuild.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import { config } from '../../config.ts';
import { EVENT, TERMS, accessLabel, ticketDateLabel } from '../event.ts';
import { qrPng } from '../tickets.ts';

export interface PdfTicket { code: string; tierName: string; holderName: string; seq: number; daysAccess: number }
export interface PdfOrder { code: string; buyerName: string; tickets: PdfTicket[] }

/* ---------- aset (dibaca sekali) ---------- */
// dev: cwd = apps/api · Docker: WORKDIR /app/apps/api (folder assets disalin di Dockerfile)
const ASSETS = path.resolve('assets');
let assets: { banner: Buffer; logo: Buffer; logoDark: Buffer } | null = null;
function loadAssets() {
  assets ??= {
    banner: readFileSync(path.join(ASSETS, 'ticket-banner.jpg')),
    logo: readFileSync(path.join(ASSETS, 'logo.png')),
    logoDark: readFileSync(path.join(ASSETS, 'logo-dark.png'))
  };
  return assets;
}

/* ---------- gaya ---------- */
const A4 = { w: 595.28, h: 841.89 };
const M = 34; // margin kartu
const INNER = 56; // margin isi
const C = {
  ink: rgb(0.02, 0.02, 0.02),
  text: rgb(0.08, 0.08, 0.09),
  muted: rgb(0.42, 0.42, 0.46),
  line: rgb(0.88, 0.88, 0.9),
  red: rgb(1, 0.12, 0.12),
  soft: rgb(0.965, 0.955, 0.955),
  white: rgb(1, 1, 1)
};

interface Fonts { regular: PDFFont; bold: PDFFont; italic: PDFFont; mono: PDFFont }

const siteHost = () => config.SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
const supportEmail = () => (config.EMAIL_FROM?.match(/<([^>]+)>/)?.[1] ?? config.EMAIL_FROM ?? config.SMTP_USER ?? '').trim();

/** Label dua bahasa: "Lokasi / Location" (bagian Inggris miring) */
function label(page: PDFPage, f: Fonts, id: string, en: string, x: number, y: number) {
  const size = 9.5;
  page.drawText(`${id} / `, { x, y, size, font: f.regular, color: C.muted });
  page.drawText(en, { x: x + f.regular.widthOfTextAtSize(`${id} / `, size), y, size, font: f.italic, color: C.muted });
}

/** Potong teks ke beberapa baris sesuai lebar */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Teks yang kepanjangan dipendekkan dengan "..." supaya tidak keluar kolom */
function fit(text: string, font: PDFFont, size: number, maxWidth: number) {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

function frame(page: PDFPage, f: Fonts, img: { logo: PDFImage; logoDark: PDFImage }, title: string) {
  const cardW = A4.w - M * 2;
  // kartu putih bergaris tipis
  page.drawRectangle({ x: M, y: M, width: cardW, height: A4.h - M * 2, color: C.white, borderColor: C.line, borderWidth: 1 });

  // header hitam: logo kiri, judul kanan
  const headH = 54;
  const headY = A4.h - M - headH;
  page.drawRectangle({ x: M, y: headY, width: cardW, height: headH, color: C.ink });
  page.drawRectangle({ x: M, y: headY - 3, width: cardW, height: 3, color: C.red });
  const logoH = 30;
  const logoW = (img.logo.width / img.logo.height) * logoH;
  page.drawImage(img.logo, { x: M + 18, y: headY + (headH - logoH) / 2, width: logoW, height: logoH });
  const tSize = 13;
  page.drawText(title, { x: M + cardW - 20 - f.bold.widthOfTextAtSize(title, tSize), y: headY + 21, size: tSize, font: f.bold, color: C.white });

  // footer abu muda: logo kecil + kontak
  const footH = 46;
  page.drawRectangle({ x: M, y: M, width: cardW, height: footH, color: C.soft });
  const fLogoH = 18;
  page.drawImage(img.logoDark, { x: M + 16, y: M + (footH - fLogoH) / 2, width: (img.logoDark.width / img.logoDark.height) * fLogoH, height: fLogoH });
  const contact = [supportEmail(), siteHost()].filter(Boolean).join('   |   ');
  const cSize = 8.5;
  page.drawText(contact, { x: M + cardW - 18 - f.regular.widthOfTextAtSize(contact, cSize), y: M + 19, size: cSize, font: f.regular, color: C.muted });

  return { contentTop: headY - 3, contentBottom: M + footH, cardW };
}

async function ticketPage(doc: PDFDocument, f: Fonts, img: { banner: PDFImage; logo: PDFImage; logoDark: PDFImage }, order: PdfOrder, t: PdfTicket, total: number) {
  const page = doc.addPage([A4.w, A4.h]);
  const { contentTop, contentBottom } = frame(page, f, img, 'E-TIKET');

  // watermark logo samar di tengah
  const wmW = 420;
  const wmH = (img.logoDark.height / img.logoDark.width) * wmW;
  page.drawImage(img.logoDark, { x: 120, y: 250, width: wmW, height: wmH, rotate: degrees(28), opacity: 0.07 });

  const contentW = A4.w - INNER * 2;
  let y = contentTop - 22;

  // banner acara
  const bannerH = (img.banner.height / img.banner.width) * contentW;
  y -= bannerH;
  page.drawImage(img.banner, { x: INNER, y, width: contentW, height: bannerH });

  // nama acara
  y -= 32;
  page.drawText(fit(EVENT.name, f.bold, 19, contentW), { x: INNER, y, size: 19, font: f.bold, color: C.text });

  // lokasi
  y -= 26;
  label(page, f, 'Lokasi', 'Location', INNER, y);
  y -= 17;
  page.drawText(fit(EVENT.location, f.bold, 12, contentW), { x: INNER, y, size: 12, font: f.bold, color: C.text });

  // tanggal & waktu
  const col2 = INNER + contentW / 2 + 10;
  y -= 26;
  label(page, f, 'Tanggal', 'Date', INNER, y);
  label(page, f, 'Waktu', 'Time', col2, y);
  y -= 17;
  page.drawText(ticketDateLabel(t.daysAccess), { x: INNER, y, size: 12, font: f.bold, color: C.text });
  page.drawText(EVENT.hours, { x: col2, y, size: 12, font: f.bold, color: C.text });

  // garis pemisah
  y -= 20;
  page.drawLine({ start: { x: INNER, y }, end: { x: INNER + contentW, y }, thickness: 1, color: C.line, dashArray: [4, 3] });

  // kolom kiri: data pesanan · kolom kanan: QR
  const qrSize = 156;
  const qrX = INNER + contentW - qrSize;
  const leftW = qrX - INNER - 24;
  const blockTop = y - 26;

  const rows: [string, string, string, string?][] = [
    ['ID Pesanan', 'Order ID', order.code],
    ['Nama', 'Name', t.holderName],
    ['Kategori Tiket', 'Ticket Category', t.tierName.toUpperCase(), accessLabel(t.daysAccess)]
  ];
  let ly = blockTop;
  for (const [id, en, value, note] of rows) {
    label(page, f, id, en, INNER, ly);
    ly -= 17;
    page.drawText(fit(value, f.bold, 12.5, leftW), { x: INNER, y: ly, size: 12.5, font: f.bold, color: C.text });
    if (note) {
      ly -= 15;
      page.drawText(note, { x: INNER, y: ly, size: 9.5, font: f.regular, color: C.red });
    }
    ly -= 26;
  }

  // QR + keterangan
  const seqText = `Tiket ${t.seq} dari ${total}`;
  page.drawText(seqText, { x: qrX + (qrSize - f.bold.widthOfTextAtSize(seqText, 11)) / 2, y: blockTop, size: 11, font: f.bold, color: C.text });
  const qrImg = await doc.embedPng(await qrPng(t.code));
  const qrY = blockTop - 14 - qrSize;
  page.drawRectangle({ x: qrX - 6, y: qrY - 6, width: qrSize + 12, height: qrSize + 12, color: C.white, borderColor: C.line, borderWidth: 1 });
  page.drawImage(qrImg, { x: qrX, y: qrY, width: qrSize, height: qrSize });
  const codeSize = 13;
  page.drawText(t.code, { x: qrX + (qrSize - f.mono.widthOfTextAtSize(t.code, codeSize)) / 2, y: qrY - 26, size: codeSize, font: f.mono, color: C.text });

  // catatan di bawah, selalu di atas footer
  const note = 'Tunjukkan QR ini di gerbang masuk. Satu QR untuk satu orang, maksimal 1 kali masuk per hari. Gerbang buka ' + EVENT.gatesOpen + '.';
  const noteLines = wrap(note, f.regular, 9.5, contentW);
  const noteY = Math.max(Math.min(ly, qrY - 26) - 26, contentBottom + 16 + (noteLines.length - 1) * 13);
  noteLines.forEach((line, i) => {
    page.drawText(line, { x: INNER, y: noteY - i * 13, size: 9.5, font: f.regular, color: C.muted });
  });
}

function termsPage(doc: PDFDocument, f: Fonts, img: { logo: PDFImage; logoDark: PDFImage }) {
  const page = doc.addPage([A4.w, A4.h]);
  const { contentTop } = frame(page, f, img, 'SYARAT & KETENTUAN');
  const contentW = A4.w - INNER * 2;

  // kotak judul seperti contoh
  let y = contentTop - 30 - 40;
  page.drawRectangle({ x: INNER, y, width: contentW, height: 40, color: rgb(1, 0.93, 0.93), borderColor: rgb(1, 0.75, 0.75), borderWidth: 1 });
  const title = 'Syarat & Ketentuan / Terms & Conditions';
  page.drawText(title, { x: INNER + (contentW - f.bold.widthOfTextAtSize(title, 13)) / 2, y: y + 14, size: 13, font: f.bold, color: rgb(0.6, 0, 0) });

  y -= 28;
  const size = 10;
  const numW = 18;
  TERMS.forEach((term, i) => {
    const lines = wrap(term, f.regular, size, contentW - numW);
    page.drawText(`${i + 1}.`, { x: INNER, y, size, font: f.bold, color: C.text });
    lines.forEach((line, k) => page.drawText(line, { x: INNER + numW, y: y - k * 14, size, font: f.regular, color: C.text }));
    y -= lines.length * 14 + 8;
  });
}

/** Buat PDF e-tiket. `onlyCode` = hanya satu tiket. */
export async function buildTicketsPdf(order: PdfOrder, onlyCode?: string) {
  const tickets = onlyCode ? order.tickets.filter(t => t.code === onlyCode) : order.tickets;
  const doc = await PDFDocument.create();
  doc.setTitle(`E-tiket ${EVENT.shortName} - ${order.code}`);
  doc.setAuthor('Skena Sonik');
  doc.setSubject(EVENT.name);
  doc.setCreator('Skena Sonik');

  const f: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
    italic: await doc.embedFont(StandardFonts.HelveticaOblique),
    mono: await doc.embedFont(StandardFonts.CourierBold)
  };
  const a = loadAssets();
  const img = {
    banner: await doc.embedJpg(a.banner),
    logo: await doc.embedPng(a.logo),
    logoDark: await doc.embedPng(a.logoDark)
  };

  for (const t of tickets) await ticketPage(doc, f, img, order, t, order.tickets.length);
  termsPage(doc, f, img);
  return doc.save();
}
