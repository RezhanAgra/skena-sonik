// Status pesanan + rincian. Selama PENDING, status dicek ulang ke API setiap beberapa detik.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { rupiah } from '../lib/format';
import type { OrderStatus as Status, OrderView } from '../lib/types';
import { clearCartIfPaid } from '../stores/cart';

const POLL_MS = 4000;
const POLL_LIMIT = 150; // ±10 menit

const STATUS: Record<Status, { label: string; title: string; desc: string; tone: string }> = {
  PENDING: { label: 'Menunggu pembayaran', title: 'Selesaikan pembayaranmu', desc: 'Halaman ini akan berubah otomatis begitu pembayaran diterima.', tone: 'border-amber-400/60 text-amber-300' },
  PAID: { label: 'Lunas', title: 'Tiketmu sudah aman!', desc: 'Pembayaran diterima. Simpan kode pesanan ini dan tunjukkan saat penukaran gelang di venue.', tone: 'border-emerald-400/60 text-emerald-300' },
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
