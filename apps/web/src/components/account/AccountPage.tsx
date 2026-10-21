// Halaman akun: tiket saya, verifikasi email, profil, ganti password, keluar
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../../lib/api';
import { rupiah } from '../../lib/format';
import type { AuthUser, MyOrder, OrderStatus } from '../../lib/types';

const inputClass = 'w-full min-w-0 rounded-[10px] border border-line bg-black px-3.5 py-3 font-semibold text-paper focus:border-flare';

const STATUS: Record<OrderStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Menunggu bayar', tone: 'border-amber-400/60 text-amber-300' },
  PAID: { label: 'Lunas', tone: 'border-emerald-400/60 text-emerald-300' },
  FAILED: { label: 'Gagal', tone: 'border-flare text-flare' },
  EXPIRED: { label: 'Kedaluwarsa', tone: 'border-line text-muted' },
  CANCELLED: { label: 'Dibatalkan', tone: 'border-line text-muted' },
  REFUNDED: { label: 'Dikembalikan', tone: 'border-line text-muted' }
};
const ROLE_LABEL = { AUDIENCE: 'Penonton', STAFF: 'Petugas gerbang', ORGANIZER: 'Penyelenggara' } as const;
const dateTime = (iso: string) => new Date(iso).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

function Panel({ title, children, id }: { title: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="card grid gap-4 rounded-[18px] p-5 sm:p-6" aria-labelledby={id ? `${id}-title` : undefined}>
      <h2 id={id ? `${id}-title` : undefined} className="text-xl">{title}</h2>
      {children}
    </section>
  );
}

const Note = ({ tone, children }: { tone: 'ok' | 'error' | 'warn'; children: ReactNode }) => (
  <p role={tone === 'error' ? 'alert' : 'status'} className={`m-0 text-sm ${tone === 'ok' ? 'text-emerald-300' : tone === 'warn' ? 'text-amber-300' : 'text-[#ffb3b3]'}`}>{children}</p>
);

function OrderRow({ order }: { order: MyOrder }) {
  const s = STATUS[order.status];
  return (
    <li className="grid gap-3 rounded-[14px] border border-line bg-panel-2 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`tag border ${s.tone}`}>{s.label}</span>
          <b className="font-mono tracking-wider">{order.code}</b>
        </div>
        <span className="text-sm text-muted">{order.items.map(i => `${i.tierName} × ${i.quantity}`).join(', ')} · {rupiah(order.total)}</span>
        <span className="text-xs text-muted">Dipesan {dateTime(order.createdAt)}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <a href={`/pesanan/${order.code}`} className="btn btn-ghost px-3.5 py-2.5 text-xs">
          {order.status === 'PAID' ? 'Lihat e-tiket' : order.status === 'PENDING' ? 'Lanjut bayar' : 'Detail'}
        </a>
        {order.status === 'PAID' && order.ticketCount > 0 && (
          <a href={`/api/orders/${order.code}/tickets.pdf`} download className="btn btn-red px-3.5 py-2.5 text-xs">PDF</a>
        )}
      </div>
    </li>
  );
}

export default function AccountPage({ initialUser, justReset }: { initialUser: AuthUser; justReset: boolean }) {
  const [user, setUser] = useState(initialUser);
  const [orders, setOrders] = useState<MyOrder[] | null>(null);
  const [ordersError, setOrdersError] = useState('');

  useEffect(() => {
    api.myOrders().then(r => setOrders(r.orders)).catch(err => setOrdersError((err as Error).message));
  }, [user.emailVerified]);

  /* verifikasi */
  const [verifyNote, setVerifyNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const resendVerification = async () => {
    try {
      await api.auth.resendVerification();
      setVerifyNote({ tone: 'ok', text: `Link verifikasi dikirim ke ${user.email}. Cek juga folder Spam.` });
    } catch (err) { setVerifyNote({ tone: 'error', text: (err as Error).message }); }
  };

  /* profil */
  const [profile, setProfile] = useState({ name: user.name, phone: user.phone ?? '' });
  const [profileNote, setProfileNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const saveProfile = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const r = await api.auth.updateMe(profile);
      setUser(r.user);
      setProfileNote({ tone: 'ok', text: 'Profil tersimpan.' });
    } catch (err) { setProfileNote({ tone: 'error', text: (err as Error).message }); }
  };

  /* password */
  const [pw, setPw] = useState({ current: '', next: '' });
  const [pwNote, setPwNote] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const changePassword = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await api.auth.changePassword(pw.current, pw.next);
      setPw({ current: '', next: '' });
      setPwNote({ tone: 'ok', text: 'Password diganti. Perangkat lain otomatis dikeluarkan.' });
    } catch (err) { setPwNote({ tone: 'error', text: (err as Error).message }); }
  };

  const logout = async () => {
    await api.auth.logout().catch(() => {});
    location.href = '/';
  };

  return (
    <div className="mx-auto grid w-full max-w-[720px] gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">{ROLE_LABEL[user.role]}</span>
          <h1 className="text-[clamp(1.6rem,5vw,2.4rem)]">Halo, {user.name.split(' ')[0]}!</h1>
          <p className="m-0 text-sm text-muted">{user.email}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {user.role === 'ORGANIZER' && <a href="/dashboard" className="btn btn-red px-4 py-3 text-xs">Dasbor penyelenggara</a>}
          {(user.role === 'STAFF' || user.role === 'ORGANIZER') && <a href="/gate" className="btn btn-ghost px-4 py-3 text-xs">Scanner gerbang</a>}
          <button type="button" className="btn btn-ghost px-4 py-3 text-xs" onClick={logout}>Keluar</button>
        </div>
      </header>

      {justReset && <Note tone="ok">Password baru tersimpan dan kamu sudah masuk.</Note>}

      {!user.emailVerified && (
        <div className="grid gap-2 rounded-[14px] border border-amber-400/50 bg-amber-400/5 p-4">
          <b>Verifikasi emailmu</b>
          <span className="text-sm text-muted">
            Kami sudah mengirim link verifikasi ke <b className="text-paper">{user.email}</b>. Setelah terverifikasi, tiket yang
            pernah kamu beli tanpa login dengan email ini akan muncul di sini.
          </span>
          <button type="button" className="btn btn-ghost justify-self-start px-3.5 py-2.5 text-xs" onClick={resendVerification}>Kirim ulang link verifikasi</button>
          {verifyNote && <Note tone={verifyNote.tone}>{verifyNote.text}</Note>}
        </div>
      )}

      <Panel title="Tiket saya" id="tiket-saya">
        {ordersError && <Note tone="error">{ordersError}</Note>}
        {!orders && !ordersError && <p className="m-0 text-sm text-muted" role="status">Memuat pesanan…</p>}
        {orders && orders.length === 0 && (
          <div className="grid justify-items-start gap-3">
            <p className="m-0 text-sm text-muted">Belum ada pesanan{user.emailVerified ? '' : ' (pesanan tanpa login akan muncul setelah email diverifikasi)'}.</p>
            <a href="/#tiket" className="btn btn-red px-4 py-3 text-xs">Beli tiket</a>
          </div>
        )}
        {orders && orders.length > 0 && <ul className="m-0 grid list-none gap-3 p-0">{orders.map(o => <OrderRow key={o.code} order={o} />)}</ul>}
      </Panel>

      <Panel title="Profil" id="profil">
        <form onSubmit={saveProfile} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5"><span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">Nama</span>
            <input required value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} className={inputClass} autoComplete="name" /></label>
          <label className="grid gap-1.5"><span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">Nomor HP</span>
            <input type="tel" value={profile.phone} placeholder="0812xxxxxxxx" onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} className={inputClass} autoComplete="tel" /></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className="btn btn-white px-4 py-3 text-xs">Simpan profil</button>
            {profileNote && <Note tone={profileNote.tone}>{profileNote.text}</Note>}
          </div>
        </form>
      </Panel>

      <Panel title="Ganti password" id="password">
        <form onSubmit={changePassword} className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5"><span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">Password lama</span>
            <input type="password" required value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} className={inputClass} autoComplete="current-password" /></label>
          <label className="grid gap-1.5"><span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">Password baru</span>
            <input type="password" required value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} className={inputClass} autoComplete="new-password" /></label>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className="btn btn-white px-4 py-3 text-xs">Ganti password</button>
            {pwNote && <Note tone={pwNote.tone}>{pwNote.text}</Note>}
          </div>
        </form>
      </Panel>
    </div>
  );
}
