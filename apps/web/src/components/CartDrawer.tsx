// Laci keranjang: daftar tiket → data pembeli → bayar lewat Midtrans Snap (atau simulasi di mode mock)
import { useStore } from '@nanostores/react';
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { rupiah } from '../lib/format';
import { paySnap } from '../lib/snap';
import type { Buyer, CartQuote, Tier } from '../lib/types';
import {
  $cartOpen, MAX_TICKETS, clearCart, closeCart, rememberOrder, removeFromCart, setQuantity, useCart
} from '../stores/cart';

type Step = 'cart' | 'buyer';

const inputClass = 'w-full min-w-0 rounded-[10px] border border-line bg-black px-3.5 py-3 font-semibold text-paper placeholder:text-muted/70 focus:border-flare';

export default function CartDrawer({ tiers }: { tiers: Tier[] }) {
  const open = useStore($cartOpen);
  const items = useCart();
  const [step, setStep] = useState<Step>('cart');
  const [quote, setQuote] = useState<CartQuote | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [buyer, setBuyer] = useState<Buyer>({ name: '', email: '', phone: '' });
  const panelRef = useRef<HTMLDivElement>(null);
  const tierBySlug = Object.fromEntries(tiers.map(t => [t.slug, t]));
  const count = items.reduce((n, i) => n + i.quantity, 0);

  // harga selalu dihitung ulang oleh API setiap isi keranjang berubah
  useEffect(() => {
    if (!items.length) { setQuote(null); setError(''); return; }
    let cancelled = false;
    const t = setTimeout(() => {
      api.cartQuote(items)
        .then(q => { if (!cancelled) { setQuote(q); setError(''); } })
        .catch(err => { if (!cancelled) setError(err.message); });
    }, 150);
    return () => { cancelled = true; clearTimeout(t); };
  }, [items]);

  // buka/tutup: kunci scroll halaman, Esc menutup, fokus pindah ke laci lalu kembali ke tombol keranjang
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCart(); };
    addEventListener('keydown', onKey);
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('[data-autofocus], button, input')?.focus());
    return () => {
      document.body.style.overflow = prevOverflow;
      removeEventListener('keydown', onKey);
      document.getElementById('cart-button')?.focus();
    };
  }, [open]);

  useEffect(() => { if (!items.length) setStep('cart'); }, [items.length]);

  const pay = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api.checkout(items, buyer);
      rememberOrder(result.code);
      const orderPage = `/pesanan/${result.code}`;

      if (!result.snap || !result.token) {
        location.href = orderPage; // mode mock: bayar simulasi di halaman pesanan
        return;
      }
      const outcome = await paySnap(result.token, result.snap);
      if (outcome === 'closed') {
        setError(`Pembayaran belum selesai. Pesanan ${result.code} tetap tersimpan, kamu bisa lanjut bayar dari halaman pesanan.`);
        setBusy(false);
        return;
      }
      location.href = orderPage;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" id="cart-drawer">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={closeCart} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
        className="absolute inset-y-0 right-0 flex w-full max-w-[440px] flex-col border-l border-flare/40 bg-panel shadow-[0_0_60px_rgb(255_31_31/0.25)]"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <span className="eyebrow">{step === 'cart' ? `${count} / ${MAX_TICKETS} tiket` : 'Langkah 2 dari 2'}</span>
            <h2 id="cart-title" className="text-2xl">{step === 'cart' ? 'Keranjang' : 'Data pembeli'}</h2>
          </div>
          <button type="button" onClick={closeCart} aria-label="Tutup keranjang"
            className="grid size-10 cursor-pointer place-items-center rounded-full border border-line bg-transparent text-xl text-paper hover:border-flare hover:bg-flare">✕</button>
        </header>

        {!items.length ? (
          <div className="grid flex-1 content-center justify-items-center gap-4 px-6 text-center">
            <span className="logo-type text-6xl" aria-hidden="true">?!</span>
            <p className="m-0 text-muted">Keranjangmu masih kosong. Pilih tiket dulu, terus ajak squad-mu.</p>
            <a href="#tiket" className="btn btn-red" onClick={closeCart} data-autofocus>Pilih tiket</a>
          </div>
        ) : step === 'cart' ? (
          <>
            <ul className="m-0 grid flex-1 list-none content-start gap-3 overflow-y-auto p-5">
              {items.map(item => {
                const tier = tierBySlug[item.tier];
                const line = quote?.lines.find(l => l.tier === item.tier);
                return (
                  <li key={item.tier} className="card grid gap-3 rounded-[14px] bg-panel-2 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <b className="block font-extrabold uppercase">{tier?.name ?? item.tier}</b>
                        <span className="text-sm text-muted tabular-nums">
                          {line ? `${rupiah(line.unitPrice)} / orang` : tier ? `${rupiah(tier.price)} / orang` : ''}
                        </span>
                      </div>
                      <button type="button" onClick={() => removeFromCart(item.tier)} aria-label={`Hapus ${tier?.name ?? item.tier}`}
                        className="cursor-pointer border-0 bg-transparent p-1 text-sm font-bold text-muted underline-offset-2 hover:text-flare hover:underline">Hapus</button>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <button type="button" aria-label="Kurangi" onClick={() => setQuantity(item.tier, item.quantity - 1)}
                          className="size-9 cursor-pointer rounded-lg border border-line bg-panel text-lg font-extrabold text-paper">−</button>
                        <output className="min-w-[2ch] text-center text-xl font-black tabular-nums" aria-live="polite">{item.quantity}</output>
                        <button type="button" aria-label="Tambah" disabled={count >= MAX_TICKETS} onClick={() => setQuantity(item.tier, item.quantity + 1)}
                          className="size-9 cursor-pointer rounded-lg border border-line bg-panel text-lg font-extrabold text-paper disabled:cursor-not-allowed disabled:opacity-40">+</button>
                      </div>
                      <b className="font-black tabular-nums">{line ? rupiah(line.subtotal) : '…'}</b>
                    </div>
                    {line?.squadDeal && <span className="text-xs font-bold text-flare">Harga squad aktif</span>}
                    {line?.squadNeeded ? <span className="text-xs text-muted">Tambah {line.squadNeeded} lagi buat harga squad</span> : null}
                  </li>
                );
              })}
            </ul>

            <footer className="grid gap-2.5 border-t border-line p-5">
              {quote && (
                <>
                  <div className="flex justify-between text-sm text-muted tabular-nums"><span>Subtotal</span><b className="font-semibold text-paper">{rupiah(quote.subtotal)}</b></div>
                  <div className="flex justify-between text-sm text-muted tabular-nums"><span>Biaya layanan</span><b className="font-semibold text-paper">{rupiah(quote.fee)}</b></div>
                  <div className="flex items-end justify-between border-t border-dashed border-line pt-2.5">
                    <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">Total</span>
                    <b className="text-2xl font-black text-flare tabular-nums">{rupiah(quote.total)}</b>
                  </div>
                </>
              )}
              {error && <p className="m-0 text-sm text-[#ffb3b3]" role="alert">{error}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost" onClick={clearCart}>Kosongkan</button>
                <button type="button" className="btn btn-red flex-1" disabled={!quote || !!error} onClick={() => setStep('buyer')}>Lanjut</button>
              </div>
            </footer>
          </>
        ) : (
          <form onSubmit={pay} className="flex flex-1 flex-col overflow-hidden">
            <div className="grid flex-1 content-start gap-4 overflow-y-auto p-5">
              <p className="m-0 text-sm text-muted">Bukti pembelian dan kode pesanan dikaitkan ke data ini. Pastikan email dan nomor HP aktif.</p>
              {([
                { id: 'buyer-name', key: 'name', label: 'Nama lengkap', type: 'text', auto: 'name', placeholder: 'Sesuai KTP' },
                { id: 'buyer-email', key: 'email', label: 'Email', type: 'email', auto: 'email', placeholder: 'kamu@email.com' },
                { id: 'buyer-phone', key: 'phone', label: 'Nomor HP / WhatsApp', type: 'tel', auto: 'tel', placeholder: '0812xxxxxxxx' }
              ] as const).map(f => (
                <div key={f.id} className="grid gap-1.5">
                  <label htmlFor={f.id} className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">{f.label}</label>
                  <input id={f.id} type={f.type} required autoComplete={f.auto} placeholder={f.placeholder} className={inputClass}
                    data-autofocus={f.key === 'name' ? '' : undefined}
                    value={buyer[f.key]} onChange={e => setBuyer(b => ({ ...b, [f.key]: e.target.value }))} />
                </div>
              ))}

              {quote && (
                <div className="grid gap-1.5 rounded-[14px] border border-line bg-black p-4 text-sm">
                  {quote.lines.map(l => (
                    <div key={l.tier} className="flex justify-between gap-3 tabular-nums">
                      <span className="text-muted">{l.tierName} × {l.quantity}</span><span>{rupiah(l.subtotal)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-3 tabular-nums"><span className="text-muted">Biaya layanan</span><span>{rupiah(quote.fee)}</span></div>
                  <div className="mt-1 flex justify-between gap-3 border-t border-dashed border-line pt-2 font-black tabular-nums">
                    <span>Total</span><span className="text-flare">{rupiah(quote.total)}</span>
                  </div>
                </div>
              )}
            </div>

            <footer className="grid gap-2.5 border-t border-line p-5">
              {error && <p className="m-0 text-sm text-[#ffb3b3]" role="alert">{error}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn btn-ghost" onClick={() => { setStep('cart'); setError(''); }} disabled={busy}>Kembali</button>
                <button type="submit" className="btn btn-red flex-1" disabled={busy || !quote}>
                  {busy ? 'Memproses…' : quote ? `Bayar ${rupiah(quote.total)}` : 'Bayar'}
                </button>
              </div>
              <span className="text-center text-xs text-muted">Pembayaran diproses aman oleh Midtrans: QRIS, e-wallet, transfer bank, dan kartu.</span>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
