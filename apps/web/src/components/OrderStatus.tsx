// Status pesanan + rincian. Selama PENDING, status dicek ulang ke API setiap beberapa detik.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupiah } from '../lib/format';
import type { OrderStatus as Status, OrderView } from '../lib/types';
import ETicketCard, { pdfUrl } from './ETicketCard';
import { clearCartIfPaid } from '../stores/cart';

const POLL_MS = 4000;
const POLL_LIMIT = 150; // ±10 menit

const STATUS: Record<Status, { label: string; title: string; desc: string; tone: string }> = {
  PENDING: { label: 'Menunggu pembayaran', title: 'Selesaikan pembayaranmu', desc: 'Halaman ini akan berubah otomatis begitu pembayaran diterima.', tone: 'border-amber-400/60 text-amber-300' },
  PAID: { label: 'Lunas', title: 'Tiketmu sudah aman!', desc: 'Pembayaran diterima. E-tiket ber-QR ada di bawah dan juga dikirim ke email kamu. Tunjukkan QR di gerbang masuk.', tone: 'border-emerald-400/60 text-emerald-300' },
  FAILED: { label: 'Gagal', title: 'Pembayaran gagal', desc: 'Pembayaran ditolak atau gagal diproses. Tidak ada dana yang ditarik. Silakan pesan ulang.', tone: 'border-flare text-flare' },
  EXPIRED: { label: 'Kedaluwarsa', title: 'Batas waktu bayar habis', desc: 'Pesanan ini tidak dibayar sampai batas waktu. Silakan pesan ulang.', tone: 'border-line text-muted' },
  CANCELLED: { label: 'Dibatalkan', title: 'Pesanan dibatalkan', desc: 'Pesanan ini sudah dibatalkan.', tone: 'border-line text-muted' },
  REFUNDED: { label: 'Dikembalikan', title: 'Dana dikembalikan', desc: 'Pembayaran untuk pesanan ini sudah dikembalikan.', tone: 'border-line text-muted' }
};

const PAYMENT_LABEL: Record<string, string> = {
  qris: 'QRIS', gopay: 'GoPay', shopeepay: 'ShopeePay', bank_transfer: 'Transfer bank (VA)', echannel: 'Mandiri Bill',
  credit_card: 'Kartu kredit/debit', cstore: 'Gerai retail', akulaku: 'Akulaku', simulasi: 'Simulasi (mode demo)'
};

const dateTime = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export default function OrderStatus({ initial }: { initial: OrderView }) {
  const [order, setOrder] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const s = STATUS[order.status];

  useEffect(() => {
    if (order.status === 'PAID') clearCartIfPaid(order.code);
    if (order.status !== 'PENDING') return;
    let n = 0;
    const id = setInterval(async () => {
      if (++n > POLL_LIMIT) return clearInterval(id);
      try { setOrder(await api.order(order.code)); } catch {}
    }, POLL_MS);
    return () => clearInterval(id);
  }, [order.status, order.code]);

  const simulate = async (result: 'paid' | 'failed') => {
    setBusy(true);
    setError('');
    try { setOrder(await api.mockPay(order.code, result)); } catch (err) { setError((err as Error).message); }
    setBusy(false);
  };

  const [resendNote, setResendNote] = useState('');
  const resend = async () => {
    setBusy(true);
    setResendNote('');
    try {
      setOrder(await api.resendTickets(order.code));
      setResendNote(`E-tiket dikirim ulang ke ${order.buyerEmail}. Cek juga folder Spam/Promosi.`);
    } catch (err) {
      setResendNote((err as Error).message);
    }
    setBusy(false);
  };

  // tiket terbit beberapa detik setelah lunas: muat ulang sekali kalau belum ada
  useEffect(() => {
    if (order.status !== 'PAID' || order.tickets.length) return;
    const id = setTimeout(async () => { try { setOrder(await api.order(order.code)); } catch {} }, 2500);
    return () => clearTimeout(id);
  }, [order.status, order.tickets.length, order.code]);

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(order.code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <article className="card mx-auto grid w-full max-w-[560px] gap-5 rounded-[18px] p-[clamp(20px,4vw,32px)] shadow-[0_0_60px_rgb(255_31_31/0.2)]">
      <div className="grid gap-3">
        <span className={`tag justify-self-start border ${s.tone}`} role="status">{s.label}</span>
        <h1 className="text-[clamp(1.6rem,5vw,2.4rem)]">{s.title}</h1>
        <p className="m-0 text-muted">{s.desc}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-dashed border-line bg-black px-4 py-3">
        <div>
          <span className="block font-mono text-[0.66rem] uppercase tracking-widest text-muted">Kode pesanan</span>
          <b className="font-mono text-lg tracking-wider">{order.code}</b>
        </div>
        <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={copyCode}>{copied ? 'Tersalin ✓' : 'Salin'}</button>
      </div>

      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-muted">Atas nama</dt><dd className="m-0 text-right font-semibold">{order.buyerName}</dd>
        <dt className="text-muted">Email</dt><dd className="m-0 text-right">{order.buyerEmail}</dd>
        <dt className="text-muted">Dipesan</dt><dd className="m-0 text-right">{dateTime(order.createdAt)}</dd>
        {order.paymentType && (<><dt className="text-muted">Metode</dt><dd className="m-0 text-right">{PAYMENT_LABEL[order.paymentType] ?? order.paymentType}</dd></>)}
        {order.paidAt && (<><dt className="text-muted">Dibayar</dt><dd className="m-0 text-right">{dateTime(order.paidAt)}</dd></>)}
      </dl>

      <div className="grid gap-1.5 border-t border-line pt-4 text-sm">
        {order.items.map(i => (
          <div key={i.tier} className="flex justify-between gap-3 tabular-nums">
            <span className="text-muted">{i.tierName} × {i.quantity}</span><span>{rupiah(i.subtotal)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 tabular-nums"><span className="text-muted">Biaya layanan</span><span>{rupiah(order.fee)}</span></div>
        <div className="mt-1 flex justify-between gap-3 border-t border-dashed border-line pt-2 text-lg font-black tabular-nums">
          <span>Total</span><span className="text-flare">{rupiah(order.total)}</span>
        </div>
      </div>

      {order.status === 'PAID' && (
        <section className="grid gap-3 border-t border-line pt-4" aria-labelledby="eticket-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 id="eticket-title" className="text-xl">E-tiket kamu</h2>
              <span className="text-xs text-muted">{order.tickets.length} tiket · 1 QR = 1 orang</span>
            </div>
            {order.tickets.length > 0 && (
              <a href={pdfUrl(order.code)} download className="btn btn-red px-4 py-3 text-xs">
                <svg viewBox="0 0 24 24" className="size-4 fill-current" aria-hidden="true"><path d="M12 3a1 1 0 011 1v9.6l3.3-3.3a1 1 0 111.4 1.4l-5 5a1 1 0 01-1.4 0l-5-5a1 1 0 111.4-1.4l3.3 3.3V4a1 1 0 011-1zM5 19a1 1 0 100 2h14a1 1 0 100-2H5z" /></svg>
                {order.tickets.length > 1 ? 'Download semua tiket (PDF)' : 'Download tiket (PDF)'}
              </a>
            )}
          </div>
          {order.tickets.length ? (
            <ul className="m-0 grid list-none gap-5 p-0">
              {order.tickets.map(t => <ETicketCard key={t.code} order={order} ticket={t} />)}
            </ul>
          ) : (
            <p className="m-0 text-sm text-muted" role="status">Tiket sedang diterbitkan…</p>
          )}
          <div className="grid gap-2 rounded-[12px] border border-line bg-black p-3.5 text-sm">
            {order.emailDelivery === 'log' ? (
              <span className="text-amber-300">
                Mode development: email tidak benar-benar dikirim ke {order.buyerEmail}. Salinannya disimpan sebagai file
                di server (apps/api/tmp/emails). Isi pengaturan SMTP supaya e-tiket terkirim.
              </span>
            ) : order.ticketsEmailedAt ? (
              <span>✉️ E-tiket sudah dikirim ke <b>{order.buyerEmail}</b> pada {dateTime(order.ticketsEmailedAt)}.</span>
            ) : order.ticketsEmailFailed ? (
              <span className="text-[#ffb3b3]">Email e-tiket ke {order.buyerEmail} belum berhasil terkirim. Coba kirim ulang.</span>
            ) : (
              <span className="text-muted">E-tiket sedang dikirim ke {order.buyerEmail}…</span>
            )}
            <button type="button" className="btn btn-ghost justify-self-start px-3 py-2 text-xs" disabled={busy} onClick={resend}>
              Kirim ulang e-tiket
            </button>
            {resendNote && <span className="text-xs text-muted" role="status">{resendNote}</span>}
          </div>
        </section>
      )}

      {order.status === 'PENDING' && order.paymentProvider === 'mock' && (
        <div className="grid gap-2.5 rounded-[12px] border border-amber-400/40 bg-amber-400/5 p-4">
          <b className="text-sm">Mode demo: belum tersambung ke payment gateway</b>
          <span className="text-xs text-muted">Tombol di bawah hanya menyimulasikan hasil pembayaran. Tidak ada uang yang ditarik.</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-red" disabled={busy} onClick={() => simulate('paid')}>Simulasikan bayar berhasil</button>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => simulate('failed')}>Simulasikan gagal</button>
          </div>
        </div>
      )}

      {order.status === 'PENDING' && order.paymentProvider === 'midtrans' && order.paymentUrl && (
        <a className="btn btn-red" href={order.paymentUrl}>Lanjutkan pembayaran</a>
      )}

      {error && <p className="m-0 text-sm text-[#ffb3b3]" role="alert">{error}</p>}

      <div className="flex flex-wrap gap-2">
        <a className="btn btn-white flex-1" href="/">Kembali ke beranda</a>
        {['FAILED', 'EXPIRED', 'CANCELLED'].includes(order.status) && <a className="btn btn-ghost flex-1" href="/#tiket">Pesan ulang</a>}
      </div>
    </article>
  );
}
