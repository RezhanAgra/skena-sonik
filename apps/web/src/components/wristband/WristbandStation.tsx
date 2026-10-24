// Booth penukaran gelang: pindai e-tiket → periksa → cetak gelang (atau cetak ulang dengan alasan)
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AuthUser, BoothTicket, WristbandView } from '../../lib/types';
import { useQrCamera } from '../../lib/useQrCamera';
import WristbandPrint, { bandColor } from './WristbandPrint';

type PrintMode = 'thermal' | 'a4';
const DAYS = [{ day: 1, label: 'Sabtu' }, { day: 2, label: 'Minggu' }];
const STORAGE = 'ss26-booth';
const inputClass = 'min-w-0 rounded-[10px] border border-line bg-black px-3.5 py-2.75 font-semibold text-paper focus:border-flare';

// ukuran halaman cetak; thermal = gelang 254 × 25,4 mm (landscape)
const PAGE_CSS: Record<PrintMode, string> = {
  thermal: '@page { size: 254mm 25.4mm; margin: 0; }',
  a4: '@page { size: A4 landscape; margin: 12mm; }'
};

function todayDay() {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  return local === '2026-12-13' ? 2 : 1;
}

export default function WristbandStation({ user }: { user: AuthUser }) {
  const [booth, setBooth] = useState('Booth 1');
  const [day, setDay] = useState(todayDay);
  const [mode, setMode] = useState<PrintMode>('thermal');
  const [ticket, setTicket] = useState<BoothTicket | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState('');
  const [reprintReason, setReprintReason] = useState('');
  const [printBand, setPrintBand] = useState<WristbandView | null>(null);
  const [printed, setPrinted] = useState<WristbandView[]>([]);
  const [stats, setStats] = useState<{ issued: number; reprinted: number; tickets: number } | null>(null);

  // simpan pengaturan booth di perangkat ini
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
      if (saved?.booth) setBooth(saved.booth);
      if (saved?.mode) setMode(saved.mode);
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem(STORAGE, JSON.stringify({ booth, mode })); } catch {} }, [booth, mode]);

  const loadStats = useCallback(() => { api.wristbands.stats().then(setStats).catch(() => {}); }, []);
  useEffect(loadStats, [loadStats]);

  const lookup = useCallback(async (qr: string) => {
    setBusy(true);
    setError('');
    setReprintReason('');
    try {
      setTicket(await api.wristbands.lookup(qr));
    } catch (err) {
      setTicket(null);
      setError((err as Error).message);
    }
    setBusy(false);
  }, []);

  const camera = useQrCamera(lookup, busy || Boolean(ticket));

  // cetak setelah gelang dirender ke area cetak
  useEffect(() => {
    if (!printBand) return;
    const t = setTimeout(() => window.print(), 150);
    return () => clearTimeout(t);
  }, [printBand]);

  const issue = async (reprint: boolean) => {
    if (!ticket) return;
    setBusy(true);
    setError('');
    try {
      const band = await api.wristbands.issue({ ticketCode: ticket.code, day, booth, reprint, reason: reprint ? reprintReason : undefined });
      setPrintBand(band);
      setPrinted(p => [band, ...p].slice(0, 10));
      setTicket(await api.wristbands.lookup(ticket.code));
      loadStats();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const next = () => { setTicket(null); setError(''); setReprintReason(''); };
  const paid = ticket?.orderStatus === 'PAID';
  const active = ticket?.activeWristband;
  const color = ticket ? bandColor(ticket.tierSlug) : null;

  return (
    <>
      <style>{`${PAGE_CSS[mode]}
        @media print {
          body * { visibility: hidden !important; }
          #print-area, #print-area * { visibility: visible !important; }
          #print-area { position: fixed; left: 0; top: 0; display: block !important; }
          html, body { background: #fff !important; }
        }`}</style>

      <div className="mx-auto grid w-full max-w-[1000px] gap-5 print:hidden">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span className="eyebrow">Booth penukaran gelang</span>
            <h1 className="text-[clamp(1.6rem,5vw,2.4rem)]">Tukar e-tiket → gelang</h1>
            <p className="m-0 text-sm text-muted">Petugas: {user.name}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="/gate" className="btn btn-ghost px-4 py-3 text-xs">Scanner gerbang</a>
            <a href={user.role === 'ORGANIZER' ? '/dashboard' : '/akun'} className="btn btn-ghost px-4 py-3 text-xs">{user.role === 'ORGANIZER' ? 'Dasbor' : 'Akun'}</a>
          </div>
        </header>

        <section className="card grid gap-3 rounded-[14px] p-4 sm:grid-cols-3">
          <label className="grid gap-1.5"><span className="font-mono text-[0.66rem] uppercase tracking-widest text-muted">Nama booth</span>
            <input value={booth} maxLength={40} onChange={e => setBooth(e.target.value)} className={inputClass} /></label>
          <div className="grid gap-1.5"><span className="font-mono text-[0.66rem] uppercase tracking-widest text-muted">Hari penukaran</span>
            <div className="flex gap-1 rounded-xl border border-line bg-black p-1" role="radiogroup" aria-label="Hari penukaran">
              {DAYS.map(d => (
                <button key={d.day} type="button" role="radio" aria-checked={day === d.day} onClick={() => setDay(d.day)}
                  className={`flex-1 cursor-pointer rounded-[9px] border-0 px-3 py-2 text-xs font-extrabold uppercase ${day === d.day ? 'bg-flare text-white' : 'bg-transparent text-muted'}`}>{d.label}</button>
              ))}
            </div>
          </div>
          <label className="grid gap-1.5"><span className="font-mono text-[0.66rem] uppercase tracking-widest text-muted">Printer</span>
            <select value={mode} onChange={e => setMode(e.target.value as PrintMode)} className={inputClass}>
              <option value="thermal">Gelang thermal 25,4 × 254 mm</option>
              <option value="a4">Kertas A4 (berwarna, gunting)</option>
            </select></label>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* pemindai */}
          <section className="grid gap-3">
            <div className="relative aspect-square overflow-hidden rounded-[18px] border border-line bg-black">
              <video ref={camera.videoRef} playsInline muted className={`size-full object-cover ${camera.state === 'on' ? '' : 'hidden'}`} />
              <canvas ref={camera.canvasRef} className="hidden" />
              {camera.state === 'on' && <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" aria-hidden="true" />}
              {camera.state !== 'on' && (
                <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-6 text-center">
                  <p className="m-0 text-muted">{camera.state === 'error' ? camera.error : 'Pindai QR e-tiket dari HP penonton atau hasil cetak PDF.'}</p>
                  <button type="button" className="btn btn-red" onClick={camera.start} disabled={camera.state === 'starting'}>
                    {camera.state === 'starting' ? 'Membuka kamera…' : 'Nyalakan kamera'}
                  </button>
                </div>
              )}
              {ticket && camera.state === 'on' && (
                <div className="absolute inset-x-0 bottom-0 bg-black/80 p-3 text-center text-xs text-muted">Pemindaian dijeda. Tekan "Tiket berikutnya" untuk memindai lagi.</div>
              )}
            </div>
            {camera.state === 'on' && <button type="button" className="btn btn-ghost" onClick={camera.stop}>Matikan kamera</button>}
            <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (manual.trim()) { lookup(manual.trim()); setManual(''); } }}>
              <input value={manual} onChange={e => setManual(e.target.value)} placeholder="Ketik kode tiket, mis. TKT-AB12-CD34" aria-label="Kode tiket"
                className={`${inputClass} flex-1 font-mono uppercase placeholder:normal-case`} />
              <button type="submit" className="btn btn-white" disabled={busy}>Cek</button>
            </form>
            {stats && (
              <div className="card grid grid-cols-3 gap-2 rounded-[14px] p-3 text-center">
                <div><b className="block text-2xl font-black tabular-nums text-flare">{stats.issued}</b><span className="text-[0.7rem] text-muted">gelang aktif</span></div>
                <div><b className="block text-2xl font-black tabular-nums">{stats.tickets}</b><span className="text-[0.7rem] text-muted">tiket terbit</span></div>
                <div><b className="block text-2xl font-black tabular-nums">{stats.reprinted}</b><span className="text-[0.7rem] text-muted">cetak ulang</span></div>
              </div>
            )}
          </section>

          {/* hasil */}
          <section className="grid gap-3" aria-live="polite">
            {error && <p className="m-0 rounded-[12px] border border-flare/60 bg-flare/10 p-4 font-semibold text-[#ffb3b3]" role="alert">{error}</p>}
            {!ticket && !error && (
              <div className="card grid min-h-60 place-content-center rounded-[18px] p-6 text-center text-muted">
                Belum ada tiket dipindai.
              </div>
            )}
            {ticket && (
              <div className={`card grid gap-4 rounded-[18px] border-2 p-5 ${!paid ? 'border-flare' : active ? 'border-amber-400' : 'border-emerald-500'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={`tag border ${!paid ? 'border-flare text-flare' : active ? 'border-amber-400 text-amber-300' : 'border-emerald-400 text-emerald-300'}`}>
                      {!paid ? `Pesanan ${ticket.orderStatus}` : active ? 'Sudah ditukar' : 'Siap ditukar'}
                    </span>
                    <h2 className="mt-2 text-2xl">{ticket.holderName}</h2>
                    <p className="m-0 text-sm text-muted">{ticket.tierName} · {ticket.access} · tiket {ticket.seq} dari {ticket.totalInOrder}</p>
                    <p className="m-0 font-mono text-xs text-muted">{ticket.code} · pesanan {ticket.orderCode}</p>
                  </div>
                  {color && (
                    <div className="grid justify-items-center gap-1 text-center">
                      <span className="size-12 rounded-full border-2 border-white/30" style={{ background: color.hex }} aria-hidden="true" />
                      <span className="text-xs font-bold">Gelang {color.name}</span>
                    </div>
                  )}
                </div>

                {!paid && <p className="m-0 text-sm text-[#ffb3b3]">Tiket ini tidak bisa ditukar karena pesanannya belum/tidak lunas.</p>}

                {paid && !active && (
                  <button type="button" className="btn btn-red py-4 text-base" disabled={busy} onClick={() => issue(false)}>
                    {busy ? 'Menerbitkan…' : 'Cetak gelang'}
                  </button>
                )}

                {paid && active && (
                  <div className="grid gap-3 rounded-[12px] border border-amber-400/40 bg-amber-400/5 p-4">
                    <p className="m-0 text-sm">
                      Sudah ditukar dengan gelang <b className="font-mono">{active.code}</b> ({active.validLabel})
                      {active.issuedByName ? ` oleh ${active.issuedByName}` : ''} pada {new Date(active.createdAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}.
                    </p>
                    <p className="m-0 text-xs text-muted">Cetak ulang hanya untuk gelang rusak/hilang. Gelang lama otomatis tidak berlaku di gerbang.</p>
                    <div className="flex flex-wrap gap-2">
                      <input value={reprintReason} onChange={e => setReprintReason(e.target.value)} placeholder="Alasan, mis. gelang robek" aria-label="Alasan cetak ulang"
                        className={`${inputClass} flex-1 basis-48`} />
                      <button type="button" className="btn btn-ghost" disabled={busy || !reprintReason.trim()} onClick={() => issue(true)}>Cetak ulang</button>
                      <button type="button" className="btn btn-ghost" onClick={() => setPrintBand({ ...active })}>Cetak lagi (sama)</button>
                    </div>
                  </div>
                )}

                {ticket.history.length > 1 && (
                  <details className="text-xs text-muted">
                    <summary className="cursor-pointer">Riwayat gelang ({ticket.history.length})</summary>
                    <ul className="m-0 mt-2 grid gap-1 pl-4">
                      {ticket.history.map(h => (
                        <li key={h.code}><span className="font-mono">{h.code}</span> · {h.voidedAt ? 'nonaktif' : 'aktif'}{h.reason ? ` · ${h.reason}` : ''}{h.issuedByName ? ` · ${h.issuedByName}` : ''}</li>
                      ))}
                    </ul>
                  </details>
                )}

                <button type="button" className="btn btn-white" onClick={next}>Tiket berikutnya</button>
              </div>
            )}

            {printBand && (
              <div className="card grid gap-2 rounded-[14px] p-4">
                <span className="text-sm font-bold">Pratinjau gelang terakhir</span>
                <div className="overflow-x-auto rounded-lg bg-white p-2">
                  <div style={{ zoom: 0.55 }}><WristbandPrint band={printBand} color /></div>
                </div>
                <button type="button" className="btn btn-ghost justify-self-start px-3 py-2 text-xs" onClick={() => window.print()}>Buka dialog cetak lagi</button>
              </div>
            )}

            {printed.length > 0 && (
              <div className="card grid gap-2 rounded-[14px] p-4 text-sm">
                <b>Dicetak di perangkat ini</b>
                <ol className="m-0 grid list-none gap-1 p-0">
                  {printed.map(b => <li key={b.code} className="flex justify-between gap-2 text-muted"><span className="font-mono">{b.code}</span><span className="truncate">{b.holderName} · {b.tierName}</span></li>)}
                </ol>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* hanya muncul saat dicetak */}
      <div id="print-area" className="hidden" aria-hidden="true">
        {printBand && <WristbandPrint band={printBand} color={mode === 'a4'} />}
      </div>
    </>
  );
}
