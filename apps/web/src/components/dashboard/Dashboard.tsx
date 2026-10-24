// Dasbor penyelenggara: ringkasan penjualan, daftar pesanan, kelola tim
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { rupiah } from '../../lib/format';
import type { AdminOrderPage, AdminStats, AuthUser, OrderStatus, Role, TeamMember } from '../../lib/types';

type Tab = 'ringkasan' | 'pesanan' | 'tim';

const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Menunggu bayar', tone: 'border-amber-400/60 text-amber-300' },
  PAID: { label: 'Lunas', tone: 'border-emerald-400/60 text-emerald-300' },
  FAILED: { label: 'Gagal', tone: 'border-flare text-flare' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'border-line text-muted' },
  CANCELLED: { label: 'Dibatalkan', tone: 'border-line text-muted' },
  REFUNDED: { label: 'Dikembalikan', tone: 'border-line text-muted' }
};
const ROLE_LABEL: Record<Role, string> = { AUDIENCE: 'Penonton', STAFF: 'Petugas gerbang', ORGANIZER: 'Penyelenggara' };
const shortRp = (n: number) => n >= 1_000_000 ? `Rp${(n / 1_000_000).toLocaleString('id-ID', { maximumFractionDigits: 1 })}jt` : n >= 1000 ? `Rp${Math.round(n / 1000)}rb` : `Rp${n}`;
const dateTime = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
const inputClass = 'min-w-0 rounded-[10px] border border-line bg-black px-3.5 py-2.75 font-semibold text-paper focus:border-flare';

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card grid content-start gap-1 rounded-[14px] p-4">
      <span className="font-mono text-[0.66rem] uppercase tracking-widest text-muted">{label}</span>
      <b className="text-[clamp(1.4rem,4vw,1.9rem)] leading-tight font-black tabular-nums wrap-anywhere">{value}</b>
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="card grid gap-4 rounded-[18px] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg">{title}</h2>{action}</div>
      {children}
    </section>
  );
}

/* ---------- grafik pendapatan per hari (satu seri, bar) ---------- */

function niceMax(v: number) {
  if (v <= 0) return 1_000_000;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map(m => m * p).find(m => m >= v)!;
}

function DailyChart({ data }: { data: AdminStats['daily'] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 220, left = 56, right = 8, top = 12, bottom = 28;
  const max = niceMax(Math.max(...data.map(d => d.revenue)));
  const plotW = W - left - right, plotH = H - top - bottom;
  const slot = plotW / data.length;
  const barW = Math.min(28, slot - 6);
  const y = (v: number) => top + plotH - (v / max) * plotH;
  const ticks = [0, 0.5, 1].map(f => f * max);
  const label = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  const h = hover !== null ? data[hover] : null;

  return (
    <figure className="m-0 grid gap-2">
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Pendapatan lunas per hari, 14 hari terakhir">
          {ticks.map(t => (
            <g key={t}>
              <line x1={left} x2={W - right} y1={y(t)} y2={y(t)} stroke="rgb(255 255 255 / 0.08)" strokeWidth={1} />
              <text x={left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="#a9a3a3">{shortRp(t)}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = left + i * slot + (slot - barW) / 2;
            const bh = Math.max(d.revenue > 0 ? 2 : 0, top + plotH - y(d.revenue));
            const r = Math.min(4, bh / 2);
            return (
              <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                {/* area hover lebih lebar dari bar */}
                <rect x={left + i * slot} y={top} width={slot} height={plotH} fill="transparent" />
                {bh > 0 && (
                  <path
                    d={`M${x},${top + plotH} V${top + plotH - bh + r} q0,-${r} ${r},-${r} H${x + barW - r} q${r},0 ${r},${r} V${top + plotH} Z`}
                    fill={hover === i ? '#ff5a4a' : '#ff1f1f'}
                  />
                )}
                {(i % 2 === 0 || i === data.length - 1) && (
                  <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10.5} fill="#a9a3a3">{label(d.date)}</text>
                )}
              </g>
            );
          })}
          <line x1={left} x2={W - right} y1={top + plotH} y2={top + plotH} stroke="rgb(255 255 255 / 0.25)" strokeWidth={1} />
        </svg>
        {h && (
          <div className="pointer-events-none absolute top-1 right-2 rounded-lg border border-line bg-black/90 px-3 py-2 text-xs shadow-lg" role="status">
            <b className="block">{label(h.date)}</b>
            <span className="text-muted">{rupiah(h.revenue)} · {h.orders} pesanan</span>
          </div>
        )}
      </div>
      <figcaption className="text-xs text-muted">Pendapatan pesanan lunas per hari (WIB), 14 hari terakhir. Arahkan kursor ke batang untuk detail.</figcaption>
      <table className="sr-only">
        <caption>Pendapatan per hari</caption>
        <thead><tr><th>Tanggal</th><th>Pendapatan</th><th>Pesanan</th></tr></thead>
        <tbody>{data.map(d => <tr key={d.date}><td>{d.date}</td><td>{rupiah(d.revenue)}</td><td>{d.orders}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/* ---------- ringkasan ---------- */

function Overview() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(() => { api.admin.stats().then(setStats).catch(e => setError((e as Error).message)); }, []);
  useEffect(load, [load]);

  if (error) return <p className="m-0 text-[#ffb3b3]" role="alert">{error}</p>;
  if (!stats) return <p className="m-0 text-muted" role="status">Memuat ringkasan…</p>;

  const totalCheckIns = stats.checkIns.reduce((n, c) => n + c.count, 0);
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Pendapatan" value={rupiah(stats.revenue)} hint={`termasuk biaya layanan ${shortRp(stats.serviceFees)}`} />
        <Tile label="Pesanan lunas" value={String(stats.orders.PAID)} hint={`${stats.orders.PENDING} menunggu bayar`} />
        <Tile label="Tiket terbit" value={String(stats.ticketsIssued)} hint={`${stats.wristbandsIssued} sudah ditukar gelang`} />
        <Tile label="Sudah masuk" value={String(totalCheckIns)} hint={stats.checkIns.map(c => `${c.label.split(',')[0]} ${c.count}`).join(' · ')} />
      </div>

      <Panel title="Penjualan 14 hari terakhir" action={<button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={load}>Muat ulang</button>}>
        <DailyChart data={stats.daily} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Terjual per jenis tiket">
          {stats.perTier.length ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead><tr className="text-left font-mono text-[0.66rem] uppercase tracking-widest text-muted"><th className="pb-2">Jenis</th><th className="pb-2 text-right">Terjual</th><th className="pb-2 text-right">Pendapatan</th></tr></thead>
                <tbody>
                  {stats.perTier.map(t => (
                    <tr key={t.tier} className="border-t border-line"><td className="py-2 font-semibold">{t.name}</td><td className="py-2 text-right tabular-nums">{t.sold}</td><td className="py-2 text-right tabular-nums">{rupiah(t.revenue)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="m-0 text-sm text-muted">Belum ada tiket terjual.</p>}
        </Panel>
        <Panel title="Status pesanan & akun">
          <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-sm">
            {(Object.keys(STATUS) as OrderStatus[]).map(s => (
              <div key={s} className="contents"><dt className="text-muted">{STATUS[s].label}</dt><dd className="m-0 text-right tabular-nums">{stats.orders[s]}</dd></div>
            ))}
            <div className="contents"><dt className="border-t border-line pt-2 text-muted">Akun penonton</dt><dd className="m-0 border-t border-line pt-2 text-right tabular-nums">{stats.accounts.AUDIENCE}</dd></div>
            <div className="contents"><dt className="text-muted">Petugas & penyelenggara</dt><dd className="m-0 text-right tabular-nums">{stats.accounts.STAFF + stats.accounts.ORGANIZER}</dd></div>
          </dl>
        </Panel>
      </div>
    </div>
  );
}

/* ---------- daftar pesanan ---------- */

function Orders() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AdminOrderPage | null>(null);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => {
      api.admin.orders({ q, status, page }).then(d => { setData(d); setError(''); }).catch(e => setError((e as Error).message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, status, page]);

  const resend = async (code: string) => {
    setNotes(n => ({ ...n, [code]: 'Mengirim…' }));
    try {
      const r = await api.admin.resend(code);
      setNotes(n => ({ ...n, [code]: `Terkirim ke ${r.sentTo}` }));
    } catch (e) { setNotes(n => ({ ...n, [code]: (e as Error).message })); }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <Panel title="Pesanan">
      <div className="flex flex-wrap gap-2">
        <input type="search" value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Cari kode, nama, email, HP, atau kode tiket"
          aria-label="Cari pesanan" className={`${inputClass} flex-1 basis-60`} />
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} aria-label="Filter status" className={inputClass}>
          <option value="">Semua status</option>
          {(Object.keys(STATUS) as OrderStatus[]).map(s => <option key={s} value={s}>{STATUS[s].label}</option>)}
        </select>
      </div>
      {error && <p className="m-0 text-[#ffb3b3]" role="alert">{error}</p>}
      {!data && !error && <p className="m-0 text-muted" role="status">Memuat…</p>}
      {data && (
        <>
          <span className="text-xs text-muted">{data.total} pesanan ditemukan</span>
          <ul className="m-0 grid list-none gap-2.5 p-0">
            {data.orders.map(o => (
              <li key={o.code} className="grid gap-2 rounded-[12px] border border-line bg-panel-2 p-3.5 md:grid-cols-[1.2fr_1fr_auto] md:items-center">
                <div className="grid min-w-0 gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`tag border ${STATUS[o.status].tone}`}>{STATUS[o.status].label}</span>
                    <a href={`/pesanan/${o.code}`} className="font-mono font-bold tracking-wider">{o.code}</a>
                    {o.hasAccount && <span className="text-[0.66rem] font-bold text-muted uppercase">akun</span>}
                  </div>
                  <span className="text-sm wrap-anywhere"><b>{o.buyerName}</b> · {o.buyerEmail} · {o.buyerPhone}</span>
                </div>
                <div className="grid gap-0.5 text-sm">
                  <span className="text-muted">{o.items.map(i => `${i.tierName} × ${i.quantity}`).join(', ')}</span>
                  <span className="tabular-nums"><b>{rupiah(o.total)}</b> · {dateTime(o.createdAt)}</span>
                  {o.status === 'PAID' && (
                    <span className={`text-xs ${o.ticketsEmailedAt ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {o.ticketCount} tiket · {o.ticketsEmailedAt ? 'email terkirim' : o.ticketsEmailError ? 'email gagal' : 'email belum terkirim'}
                    </span>
                  )}
                </div>
                <div className="grid justify-items-start gap-1 md:justify-items-end">
                  {o.status === 'PAID' && <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={() => resend(o.code)}>Kirim ulang e-tiket</button>}
                  {notes[o.code] && <span className="text-xs text-muted" role="status">{notes[o.code]}</span>}
                </div>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <nav className="flex items-center justify-between gap-2" aria-label="Halaman pesanan">
              <button type="button" className="btn btn-ghost px-3 py-2 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Sebelumnya</button>
              <span className="text-xs text-muted tabular-nums">Halaman {page} dari {pages}</span>
              <button type="button" className="btn btn-ghost px-3 py-2 text-xs" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Berikutnya</button>
            </nav>
          )}
        </>
      )}
    </Panel>
  );
}

/* ---------- tim ---------- */

function Team({ me }: { me: AuthUser }) {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('STAFF');
  const [note, setNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const load = useCallback(() => { api.admin.team().then(r => setTeam(r.team)).catch(e => setNote({ tone: 'error', text: (e as Error).message })); }, []);
  useEffect(load, [load]);

  const apply = async (targetEmail: string, newRole: Role) => {
    setNote(null);
    try {
      const r = await api.admin.setRole(targetEmail, newRole);
      setNote({ tone: 'ok', text: `${r.user.name} sekarang ${ROLE_LABEL[r.user.role]}. Mereka perlu masuk ulang.` });
      setEmail('');
      load();
    } catch (e) { setNote({ tone: 'error', text: (e as Error).message }); }
  };

  return (
    <Panel title="Tim petugas & penyelenggara">
      <p className="m-0 text-sm text-muted">Orangnya harus sudah <b className="text-paper">mendaftar akun</b> dan <b className="text-paper">memverifikasi email</b>. Petugas gerbang bisa membuka scanner <code>/gate</code>; penyelenggara juga bisa membuka dasbor ini.</p>
      <form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); apply(email, role); }}>
        <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="email@akun.com" aria-label="Email akun" className={`${inputClass} flex-1 basis-56`} />
        <select value={role} onChange={e => setRole(e.target.value as Role)} aria-label="Peran" className={inputClass}>
          <option value="STAFF">Petugas gerbang</option>
          <option value="ORGANIZER">Penyelenggara</option>
        </select>
        <button type="submit" className="btn btn-red px-4 py-2.75 text-xs">Tambahkan</button>
      </form>
      {note && <p className={`m-0 text-sm ${note.tone === 'ok' ? 'text-emerald-300' : 'text-[#ffb3b3]'}`} role={note.tone === 'error' ? 'alert' : 'status'}>{note.text}</p>}
      {!team && <p className="m-0 text-muted" role="status">Memuat…</p>}
      {team && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {team.map(u => (
            <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-line bg-panel-2 p-3">
              <div className="min-w-0">
                <b className="block">{u.name}{u.id === me.id && <span className="ml-1 text-xs font-normal text-muted">(kamu)</span>}</b>
                <span className="text-sm text-muted wrap-anywhere">{u.email} · {ROLE_LABEL[u.role]}</span>
              </div>
              {u.id !== me.id && (
                <div className="flex gap-2">
                  {u.role === 'STAFF'
                    ? <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={() => apply(u.email, 'ORGANIZER')}>Jadikan penyelenggara</button>
                    : <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={() => apply(u.email, 'STAFF')}>Jadikan petugas</button>}
                  <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={() => apply(u.email, 'AUDIENCE')}>Cabut akses</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------- halaman ---------- */

export default function Dashboard({ me }: { me: AuthUser }) {
  const [tab, setTab] = useState<Tab>('ringkasan');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'ringkasan', label: 'Ringkasan' },
    { id: 'pesanan', label: 'Pesanan' },
    { id: 'tim', label: 'Tim' }
  ];

  return (
    <div className="mx-auto grid w-full max-w-[1100px] gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Dasbor penyelenggara</span>
          <h1 className="text-[clamp(1.6rem,5vw,2.4rem)]">Skena Sonik 2026</h1>
          <p className="m-0 text-sm text-muted">Masuk sebagai {me.name} ({me.email})</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/gelang" className="btn btn-ghost px-4 py-3 text-xs">Penukaran gelang</a>
          <a href="/gate" className="btn btn-ghost px-4 py-3 text-xs">Scanner gerbang</a>
          <a href="/akun" className="btn btn-ghost px-4 py-3 text-xs">Akun saya</a>
        </div>
      </header>

      <div className="inline-flex gap-1 justify-self-start rounded-xl border border-line bg-panel p-1" role="tablist" aria-label="Bagian dasbor">
        {tabs.map(t => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={`cursor-pointer rounded-[9px] border-0 px-4 py-2.75 text-[0.82rem] font-extrabold uppercase leading-none ${tab === t.id ? 'bg-flare text-white' : 'bg-transparent text-muted'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === 'ringkasan' && <Overview />}
        {tab === 'pesanan' && <Orders />}
        {tab === 'tim' && <Team me={me} />}
      </div>
    </div>
  );
}
