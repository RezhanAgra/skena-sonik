// Form daftar info presale → POST /api/subscribers
import { useState } from 'react';
import { api } from '../lib/api';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.subscribe(email);
      setMessage(res.status === 'created'
        ? `${res.email} sudah terdaftar. Kabar presale berikutnya akan dikirim ke email ini.`
        : `${res.email} sudah ada di daftar kami sebelumnya.`);
      setEmail('');
    } catch (err) {
      setMessage((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="mx-auto mt-6.5 flex max-w-[520px] gap-2 rounded-[14px] border border-white/35 bg-black p-1.5">
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Masukkan email kamu"
          aria-label="Email"
          className="min-w-0 flex-1 border-0 bg-transparent px-3.5 py-3 font-semibold text-paper outline-none"
        />
        <button className="btn btn-red px-4.5 py-3" type="submit" disabled={busy}>{busy ? 'Mengirim…' : 'Daftar'}</button>
      </form>
      <p className="mt-3 mb-0 min-h-[1.3em] text-sm text-[#ffb3b3]" aria-live="polite">{message}</p>
    </>
  );
}
