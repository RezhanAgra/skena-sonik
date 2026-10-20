// Pilihan tiket + kalkulator patungan. Harga dihitung oleh API (/api/tickets/quote),
// tombol "Masukkan ke keranjang" menambah tiket ke keranjang (checkout & bayar ada di CartDrawer).
import { useEffect, useState } from 'react';
import type { Pricing, Quote, Tier } from '../lib/types';
import { api } from '../lib/api';
import { rupiah } from '../lib/format';
import { MAX_TICKETS, addToCart, openCart } from '../stores/cart';

const shortPrice = (n: number) => (n >= 1_000_000 ? `Rp${(n / 1_000_000).toLocaleString('id-ID')}jt` : `Rp${n / 1000}rb`);

export default function Tickets({ tiers, pricing }: { tiers: Tier[]; pricing: Pricing }) {
  const firstOnSale = tiers.find(t => t.squadPrice && !t.soldOut) ?? tiers.find(t => !t.soldOut);
  const [tier, setTier] = useState(firstOnSale?.slug ?? '');
  const [quantity, setQuantity] = useState(4);
  const [installment, setInstallment] = useState(true);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!tier) return;
    let cancelled = false;
    setMessage('');
    api.quote({ tier, quantity, installment })
      .then(q => { if (!cancelled) setQuote(q); })
      .catch(err => { if (!cancelled) setMessage(err.message); });
    return () => { cancelled = true; };
  }, [tier, quantity, installment]);

  const addSelected = () => {
    const added = addToCart(tier, quantity);
    if (!added) {
      setMessage(`Keranjang sudah penuh (maksimal ${MAX_TICKETS} tiket per pesanan).`);
      return;
    }
    setMessage(added < quantity
      ? `Hanya ${added} tiket yang masuk karena batas ${MAX_TICKETS} tiket per pesanan.`
      : `${added} tiket ${quote?.tierName ?? ''} masuk keranjang.`);
    openCart();
  };

  const squadNote = quote?.squadDeal
    ? `Harga squad aktif: hemat ${rupiah(quote.savings)}`
    : quote?.squadNeeded ? `Tambah ${quote.squadNeeded} orang lagi buat harga squad` : '';

  return (
    <>
      <div className="mb-5.5 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3" role="radiogroup" aria-label="Jenis tiket">
        {tiers.map(t => {
          const checked = tier === t.slug;
          return (
            <label
              key={t.slug}
              className={`card relative grid min-w-0 content-start gap-2 rounded-[14px] p-5 has-focus-visible:outline-3 has-focus-visible:outline-flare ${
                t.soldOut ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
              } ${checked ? 'border-flare shadow-[0_0_0_1px_var(--color-flare),0_0_34px_rgb(255_31_31/0.25)]' : ''}`}
            >
              <input
                type="radio"
                name="tier"
                value={t.slug}
                checked={checked}
                disabled={t.soldOut}
                onChange={() => setTier(t.slug)}
                className="pointer-events-none absolute opacity-0"
              />
              {t.badge && <span className={`tag absolute top-3.5 right-3.5 ${t.soldOut ? 'text-muted' : ''}`}>{t.badge}</span>}
              <span className="font-extrabold uppercase">{t.name}</span>
              <span className={`text-[1.9rem] leading-none font-black tabular-nums ${t.soldOut ? 'line-through' : ''}`}>
                {shortPrice(t.price)} {!t.soldOut && <small className="text-xs font-medium text-muted">/ orang</small>}
              </span>
              <ul className="m-0 list-disc pl-4.5 text-sm text-muted">
                {t.perks.map(p => <li key={p}>{p}</li>)}
              </ul>
            </label>
          );
        })}
      </div>

      <div className="card grid gap-6 rounded-[18px] p-[clamp(18px,3vw,28px)] md:grid-cols-2">
        <div className="grid min-w-0 content-start gap-3">
          <div>
            <h3 className="mb-1.5 text-2xl">Kalkulator patungan</h3>
            <p className="m-0 text-muted">Berapa orang yang ikut?</p>
          </div>
          <div className="flex items-center gap-3.5">
            <button type="button" aria-label="Kurangi orang" disabled={quantity <= 1} onClick={() => setQuantity(q => q - 1)}
              className="size-11.5 cursor-pointer rounded-xl border border-line bg-panel-2 text-2xl font-extrabold text-paper disabled:cursor-not-allowed disabled:opacity-40">−</button>
            <output aria-live="polite" className="min-w-[2ch] text-center text-[2.6rem] font-black text-flare tabular-nums">{quantity}</output>
            <button type="button" aria-label="Tambah orang" disabled={quantity >= pricing.maxQuantity} onClick={() => setQuantity(q => q + 1)}
              className="size-11.5 cursor-pointer rounded-xl border border-line bg-panel-2 text-2xl font-extrabold text-paper disabled:cursor-not-allowed disabled:opacity-40">+</button>
          </div>
          <div className="flex min-h-7.5 flex-wrap gap-1.5" aria-hidden="true">
            {Array.from({ length: quantity }, (_, i) => (
              <span key={i} className={`grid size-7 place-items-center rounded-full border-2 border-ink text-xs font-extrabold ${i % 2 ? 'bg-ember' : 'bg-flare'}`}>
                {i === 0 ? 'U' : i + 1}
              </span>
            ))}
          </div>
          <label className="flex cursor-pointer items-center gap-2.5 font-semibold">
            <input type="checkbox" checked={installment} onChange={e => setInstallment(e.target.checked)} className="size-4.5 accent-flare" />
            Hitung patungan per bulan ({pricing.installments}×)
          </label>
        </div>

        <div className="grid min-w-0 content-start gap-2.5 rounded-[14px] border border-line bg-black p-4.5">
          {quote ? (
            <>
              <div className="flex justify-between gap-2.5 text-sm text-muted tabular-nums">
                <span>{quote.tierName} × {quote.quantity}</span><b className="font-semibold text-paper">{rupiah(quote.subtotal)}</b>
              </div>
              <div className="flex justify-between gap-2.5 text-sm text-muted tabular-nums">
                <span>Biaya layanan ({shortPrice(pricing.feePerTicket)}/tiket)</span><b className="font-semibold text-paper">{rupiah(quote.fee)}</b>
              </div>
              {squadNote && <span className="text-sm font-bold text-flare">{squadNote}</span>}
              <div className="grid gap-0.5 border-t border-dashed border-line pt-3">
                <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">Total squad</span>
                <b className="text-[clamp(1.8rem,4.6vw,2.5rem)] leading-none font-black tabular-nums wrap-anywhere">{rupiah(quote.total)}</b>
              </div>
              <div className="grid gap-0.5 border-t border-dashed border-line pt-3">
                <span className="font-mono text-[0.68rem] uppercase tracking-widest text-muted">
                  {installment ? `Per orang, per bulan (${pricing.installments}×)` : 'Per orang'}
                </span>
                <b className="text-[clamp(1.8rem,4.6vw,2.5rem)] leading-none font-black text-flare tabular-nums wrap-anywhere">
                  {rupiah(installment ? quote.perMonth : quote.perPerson)}
                </b>
              </div>
              <span className="text-sm text-muted">
                {installment ? `Total per orang ${rupiah(quote.perPerson)}, kalau patungannya dicicil ${pricing.installments} bulan ke teman yang bayar. Checkout tetap dibayar lunas.` : 'Checkout dibayar lunas sekali bayar.'}
              </span>
            </>
          ) : (
            <span className="text-sm text-muted">Menghitung harga…</span>
          )}
          <button type="button" className="btn btn-red justify-self-start" onClick={addSelected} disabled={!quote}>
            Masukkan ke keranjang
          </button>
          <p className="m-0 min-h-[1.3em] text-sm text-[#ffb3b3]" aria-live="polite">{message}</p>
        </div>
      </div>
    </>
  );
}
