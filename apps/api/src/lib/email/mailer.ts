// Pengirim email. smtp = kirim sungguhan (mis. Gmail + App Password); log = simpan sebagai file HTML untuk dicek.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { config } from '../../config.ts';

export interface MailAttachment { filename: string; content: Buffer; cid: string; contentType: string }
export interface Mail { to: string; subject: string; html: string; text: string; attachments?: MailAttachment[] }

const LOG_DIR = path.resolve('tmp/emails');

const transport = config.EMAIL_PROVIDER === 'smtp'
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_PORT === 465,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS }
    })
  : null;

const from = config.EMAIL_FROM || (config.SMTP_USER ? `Skena Sonik <${config.SMTP_USER}>` : 'Skena Sonik <tiket@skenasonik.test>');

export async function sendMail(mail: Mail): Promise<{ id: string; preview?: string }> {
  if (transport) {
    const info = await transport.sendMail({ from, ...mail });
    return { id: info.messageId };
  }

  // mode log: gambar cid: diganti data URI supaya file HTML bisa dibuka langsung di browser
  let html = mail.html;
  for (const a of mail.attachments ?? []) {
    html = html.replaceAll(`cid:${a.cid}`, `data:${a.contentType};base64,${a.content.toString('base64')}`);
  }
  await mkdir(LOG_DIR, { recursive: true });
  const file = path.join(LOG_DIR, `${new Date().toISOString().replace(/[:.]/g, '-')}-${mail.to.replace(/[^a-z0-9@.]/gi, '_')}.html`);
  await writeFile(file, `<!-- To: ${mail.to} | Subject: ${mail.subject} -->\n${html}`);
  console.log(`[email:log] "${mail.subject}" → ${mail.to} disimpan di ${file}`);
  return { id: path.basename(file), preview: file };
}

/** Cek koneksi & login SMTP (dipakai saat start supaya salah password langsung ketahuan) */
export async function verifyMailer() {
  if (!transport) return 'log';
  await transport.verify();
  return 'smtp';
}
