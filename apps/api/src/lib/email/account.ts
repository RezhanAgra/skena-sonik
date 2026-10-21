// Email akun: verifikasi alamat email & reset password
import type { Mail } from './mailer.ts';

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const font = "font-family:'Helvetica Neue',Arial,sans-serif;";

function layout(title: string, body: string, button: { label: string; url: string }, footnote: string) {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;background:#0a0a0a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#141416;border:1px solid #2a2a2e;border-radius:14px;">
    <tr><td style="padding:22px 24px 6px;${font}">
      <div style="font-family:Georgia,serif;font-size:28px;color:#ff1f1f;text-transform:uppercase;">Skena Sonik</div>
    </td></tr>
    <tr><td style="padding:8px 24px 0;${font}color:#f5f3f3;">
      <h1 style="margin:0 0 10px;font-size:22px;">${esc(title)}</h1>
      <div style="font-size:15px;line-height:1.6;color:#c9c4c4;">${body}</div>
    </td></tr>
    <tr><td style="padding:22px 24px;">
      <a href="${button.url}" style="${font}display:inline-block;background:#ff1f1f;color:#fff;font-weight:700;font-size:14px;text-decoration:none;padding:13px 22px;border-radius:10px;">${esc(button.label)}</a>
    </td></tr>
    <tr><td style="padding:0 24px 22px;${font}font-size:12px;line-height:1.6;color:#8d8888;">
      ${footnote}<br>Kalau tombol tidak bisa diklik, salin link ini ke browser:<br><span style="color:#c9c4c4;word-break:break-all;">${button.url}</span>
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}

export function buildVerifyEmail(to: string, name: string, url: string): Mail {
  return {
    to,
    subject: 'Verifikasi email akun Skena Sonik',
    html: layout(
      `Halo ${name.split(' ')[0]}, satu langkah lagi`,
      'Klik tombol di bawah untuk memverifikasi email akunmu. Setelah terverifikasi, semua tiket yang pernah dibeli dengan email ini akan muncul di halaman <b>Tiket saya</b>.',
      { label: 'Verifikasi email', url },
      'Link ini berlaku 3 hari. Abaikan email ini kalau kamu tidak merasa mendaftar.'
    ),
    text: `Halo ${name},\n\nVerifikasi email akun Skena Sonik kamu lewat link berikut (berlaku 3 hari):\n${url}\n\nAbaikan email ini kalau kamu tidak merasa mendaftar.`
  };
}

export function buildResetEmail(to: string, name: string, url: string): Mail {
  return {
    to,
    subject: 'Atur ulang password Skena Sonik',
    html: layout(
      'Atur ulang password',
      `Halo ${esc(name.split(' ')[0])}, kami menerima permintaan untuk mengatur ulang password akunmu. Klik tombol di bawah untuk membuat password baru.`,
      { label: 'Buat password baru', url },
      'Link ini berlaku 1 jam dan hanya bisa dipakai sekali. Kalau kamu tidak meminta reset password, abaikan email ini; password lamamu tetap aman.'
    ),
    text: `Halo ${name},\n\nBuat password baru lewat link berikut (berlaku 1 jam):\n${url}\n\nAbaikan email ini kalau kamu tidak meminta reset password.`
  };
}
