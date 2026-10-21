// Form akun: masuk, daftar, lupa password, reset password, verifikasi email
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../../lib/api';

const inputClass = 'w-full min-w-0 rounded-[10px] border border-line bg-black px-3.5 py-3 font-semibold text-paper placeholder:text-muted/70 focus:border-flare';

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">{label}</label>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </div>
  );
}

function PasswordInput({ id, value, onChange, autoComplete }: { id: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} type={show ? 'text' : 'password'} required autoComplete={autoComplete} value={value}
        onChange={e => onChange(e.target.value)} className={`${inputClass} pr-20`} />
      <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Sembunyikan password' : 'Tampilkan password'}
        className="absolute top-1/2 right-2 -translate-y-1/2 cursor-pointer rounded-md border-0 bg-transparent px-2 py-1 text-xs font-bold text-muted hover:text-paper">
        {show ? 'Sembunyikan' : 'Lihat'}
      </button>
    </div>
  );
}

const Alert = ({ tone = 'error', children }: { tone?: 'error' | 'ok'; children: ReactNode }) => (
  <p role={tone === 'error' ? 'alert' : 'status'}
    className={`m-0 rounded-[10px] border px-3.5 py-2.5 text-sm ${tone === 'error' ? 'border-flare/50 bg-flare/10 text-[#ffb3b3]' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200'}`}>
    {children}
  </p>
);

function useSubmit<T>(fn: () => Promise<T>, onDone: (r: T) => void) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try { onDone(await fn()); } catch (err) { setError((err as Error).message); setBusy(false); }
  };
  return { busy, error, submit };
}

/* ---------- masuk ---------- */

export function LoginForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, submit } = useSubmit(() => api.auth.login(email, password), () => { location.href = next; });

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field id="email" label="Email">
        <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <Field id="password" label="Password">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
      </Field>
      <a href="/lupa-password" className="justify-self-end text-sm text-muted underline-offset-2 hover:text-paper hover:underline">Lupa password?</a>
      {error && <Alert>{error}</Alert>}
      <button type="submit" className="btn btn-red" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
      <p className="m-0 text-center text-sm text-muted">Belum punya akun? <a href={`/daftar?next=${encodeURIComponent(next)}`} className="font-bold text-paper">Daftar</a></p>
    </form>
  );
}

/* ---------- daftar ---------- */

export function RegisterForm({ next }: { next: string }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });
  const set = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));
  const { busy, error, submit } = useSubmit(() => api.auth.register(form), () => { location.href = next; });
  const strong = form.password.length >= 8 && /[A-Za-z]/.test(form.password) && /\d/.test(form.password);

  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field id="name" label="Nama lengkap">
        <input id="name" required autoComplete="name" value={form.name} onChange={e => set('name')(e.target.value)} className={inputClass} />
      </Field>
      <Field id="email" label="Email" hint="Tiket yang pernah dibeli dengan email ini akan muncul setelah email diverifikasi.">
        <input id="email" type="email" required autoComplete="email" value={form.email} onChange={e => set('email')(e.target.value)} className={inputClass} />
      </Field>
      <Field id="phone" label="Nomor HP (opsional)">
        <input id="phone" type="tel" autoComplete="tel" placeholder="0812xxxxxxxx" value={form.phone} onChange={e => set('phone')(e.target.value)} className={inputClass} />
      </Field>
      <Field id="password" label="Password" hint="Minimal 8 karakter, berisi huruf dan angka.">
        <PasswordInput id="password" value={form.password} onChange={set('password')} autoComplete="new-password" />
      </Field>
      {form.password && (
        <span className={`-mt-2 text-xs font-bold ${strong ? 'text-emerald-300' : 'text-amber-300'}`}>
          {strong ? '✓ Password sudah memenuhi syarat' : 'Password belum memenuhi syarat'}
        </span>
      )}
      {error && <Alert>{error}</Alert>}
      <button type="submit" className="btn btn-red" disabled={busy}>{busy ? 'Membuat akun…' : 'Daftar'}</button>
      <p className="m-0 text-center text-sm text-muted">Sudah punya akun? <a href={`/masuk?next=${encodeURIComponent(next)}`} className="font-bold text-paper">Masuk</a></p>
    </form>
  );
}

/* ---------- lupa password ---------- */

export function ForgotForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState('');
  const { busy, error, submit } = useSubmit(() => api.auth.forgotPassword(email), r => setSent(r.message));

  if (sent) return <div className="grid gap-4"><Alert tone="ok">{sent}</Alert><a href="/masuk" className="btn btn-ghost">Kembali ke halaman masuk</a></div>;
  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field id="email" label="Email akun">
        <input id="email" type="email" required autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
      </Field>
      {error && <Alert>{error}</Alert>}
      <button type="submit" className="btn btn-red" disabled={busy}>{busy ? 'Mengirim…' : 'Kirim link reset'}</button>
      <a href="/masuk" className="text-center text-sm text-muted">Kembali ke halaman masuk</a>
    </form>
  );
}

/* ---------- reset password ---------- */

export function ResetForm({ token }: { token: string }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const mismatch = confirm.length > 0 && confirm !== password;
  const { busy, error, submit } = useSubmit(async () => {
    if (password !== confirm) throw new Error('Konfirmasi password tidak sama.');
    return api.auth.resetPassword(token, password);
  }, () => { location.href = '/akun?reset=1'; });

  if (!token) return <Alert>Link reset tidak lengkap. Minta link baru di halaman <a href="/lupa-password" className="font-bold">Lupa password</a>.</Alert>;
  return (
    <form onSubmit={submit} className="grid gap-4">
      <Field id="password" label="Password baru" hint="Minimal 8 karakter, berisi huruf dan angka.">
        <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="new-password" />
      </Field>
      <Field id="confirm" label="Ulangi password baru">
        <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </Field>
      {mismatch && <span className="-mt-2 text-xs font-bold text-amber-300">Password belum sama.</span>}
      {error && <Alert>{error}</Alert>}
      <button type="submit" className="btn btn-red" disabled={busy || mismatch}>{busy ? 'Menyimpan…' : 'Simpan password baru'}</button>
    </form>
  );
}

/* ---------- verifikasi email ---------- */

export function VerifyEmail({ token }: { token: string }) {
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const started = useRef(false);

  // token dikirim lewat POST setelah halaman terbuka, jadi pemindai link di email tidak ikut "memakai" token
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!token) { setState('error'); setMessage('Link verifikasi tidak lengkap.'); return; }
    api.auth.verifyEmail(token)
      .then(() => setState('ok'))
      .catch(err => { setState('error'); setMessage((err as Error).message); });
  }, [token]);

  if (state === 'loading') return <p className="m-0 text-muted" role="status">Memverifikasi email…</p>;
  if (state === 'error') return <div className="grid gap-4"><Alert>{message}</Alert><a href="/akun" className="btn btn-ghost">Ke halaman akun</a></div>;
  return (
    <div className="grid gap-4">
      <Alert tone="ok">Email terverifikasi! Semua tiket yang dibeli dengan email ini sekarang muncul di Tiket saya.</Alert>
      <a href="/akun" className="btn btn-red">Lihat tiket saya</a>
    </div>
  );
}
