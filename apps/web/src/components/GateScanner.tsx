// Scanner gerbang untuk petugas: login PIN → pilih hari & gerbang → pindai QR dengan kamera (atau ketik kode).
import jsQR from 'jsqr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api } from '../lib/api';
import type { CheckInResult, GateInfo, GateStats } from '../lib/types';

const STORAGE = 'ss26-gate';
const SAME_CODE_COOLDOWN = 4000; // ms: QR yang sama tidak diproses ulang selama ini
const RESULT_MS = 2600;

type Session = { pin: string; gate: string; day: number };

const TONE: Record<CheckInResult['result'], { bg: string; title: string; freq: number }> = {
  ok: { bg: 'bg-emerald-600', title: 'Silakan masuk', freq: 880 },
  used: { bg: 'bg-amber-500 text-black', title: 'Sudah dipakai', freq: 330 },
  wrong_day: { bg: 'bg-amber-500 text-black', title: 'Bukan untuk hari ini', freq: 330 },
  invalid: { bg: 'bg-flare', title: 'Tiket tidak valid', freq: 180 }
};

function feedback(result: CheckInResult['result']) {
  try { navigator.vibrate?.(result === 'ok' ? 120 : [80, 60, 80, 60, 80]); } catch {}
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = TONE[result].freq;
    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
    osc.onended = () => ctx.close();
  } catch {}
}

function loadSession(): Session | null {
  try { return JSON.parse(sessionStorage.getItem(STORAGE) ?? 'null'); } catch { return null; }
}

/* ---------- login ---------- */

function Login({ onLogin }: { onLogin: (s: Session, info: GateInfo) => void }) {
  const [pin, setPin] = useState('');
  const [gate, setGate] = useState('Gerbang A');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const info = await api.gate(pin).me();
      onLogin({ pin, gate: gate.trim() || 'Gerbang', day: info.today ?? info.days[0].day }, info);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal masuk.');
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="card mx-auto grid w-full max-w-[420px] gap-4 rounded-[18px] p-6">
      <div>
        <span className="eyebrow">Khusus petugas</span>
        <h1 className="text-2xl">Scanner gerbang</h1>
      </div>
      <label className="grid gap-1.5">
        <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">PIN petugas</span>
        <input type="password" inputMode="text" autoComplete="current-password" required value={pin} onChange={e => setPin(e.target.value)}
          className="rounded-[10px] border border-line bg-black px-3.5 py-3 font-semibold text-paper" />
      </label>
      <label className="grid gap-1.5">
        <span className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">Nama gerbang</span>
        <input type="text" maxLength={40} value={gate} onChange={e => setGate(e.target.value)}
          className="rounded-[10px] border border-line bg-black px-3.5 py-3 font-semibold text-paper" />
      </label>
      {error && <p className="m-0 text-sm text-[#ffb3b3]" role="alert">{error}</p>}
      <button type="submit" className="btn btn-red" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  );
}

/* ---------- scanner ---------- */

export default function GateScanner() {
  const [session, setSession] = useState<Session | null>(null);
  const [info, setInfo] = useState<GateInfo | null>(null);
  const [stats, setStats] = useState<GateStats | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);
  const [history, setHistory] = useState<(CheckInResult & { at: Date })[]>([]);
  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'error'>('off');
  const [cameraError, setCameraError] = useState('');
  const [manual, setManual] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const busyRef = useRef(false);
  const lastRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });

  // pulihkan sesi petugas dari tab yang sama
  useEffect(() => {
    const saved = loadSession();
    if (!saved) return;
    api.gate(saved.pin).me().then(i => { setSession(saved); setInfo(i); }).catch(() => sessionStorage.removeItem(STORAGE));
  }, []);

  useEffect(() => {
    if (!session) return;
    try { sessionStorage.setItem(STORAGE, JSON.stringify(session)); } catch {}
    api.gate(session.pin).stats().then(setStats).catch(() => {});
  }, [session]);

  const submitCode = useCallback(async (text: string) => {
    if (!session || busyRef.current) return;
    busyRef.current = true;
    try {
      const r = await api.gate(session.pin).checkIn(text, session.day, session.gate);
      setResult(r);
      setHistory(h => [{ ...r, at: new Date() }, ...h].slice(0, 8));
      feedback(r.result);
      api.gate(session.pin).stats().then(setStats).catch(() => {});
    } catch (err) {
      setResult({ result: 'invalid', day: session.day, message: (err as Error).message });
      feedback('invalid');
    } finally {
      setTimeout(() => { setResult(null); busyRef.current = false; }, RESULT_MS);
    }
  }, [session]);

  // loop pembacaan QR dari kamera
  useEffect(() => {
    if (camera !== 'on') return;
    let frame = 0;
    let lastScan = 0;
    const tick = (t: number) => {
      frame = requestAnimationFrame(tick);
      if (t - lastScan < 140 || busyRef.current) return;
      lastScan = t;
      const video = videoRef.current, canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
      if (!code?.data) return;
      const now = Date.now();
      if (code.data === lastRef.current.text && now - lastRef.current.at < SAME_CODE_COOLDOWN) return;
      lastRef.current = { text: code.data, at: now };
      submitCode(code.data);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [camera, submitCode]);

  const startCamera = async () => {
    setCamera('starting');
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamera('on');
    } catch (err) {
      setCamera('error');
      setCameraError((err as Error).name === 'NotAllowedError'
        ? 'Akses kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser.'
        : 'Kamera tidak bisa dibuka. Pastikan halaman dibuka lewat HTTPS dan perangkat punya kamera.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setCamera('off');
  };
  useEffect(() => stopCamera, []);

  const logout = () => {
    stopCamera();
    try { sessionStorage.removeItem(STORAGE); } catch {}
    setSession(null);
    setInfo(null);
  };

  if (!session || !info) {
    return <Login onLogin={(s, i) => { setSession(s); setInfo(i); }} />;
  }

  const dayLabel = info.days.find(d => d.day === session.day)?.label ?? `Hari ${session.day}`;
  const todayCount = stats?.checkedIn.find(c => c.day === session.day)?.count ?? 0;

  return (
    <div className="mx-auto grid w-full max-w-[560px] gap-4">
      <header className="card flex flex-wrap items-center justify-between gap-3 rounded-[14px] p-4">
        <div className="min-w-0">
          <span className="eyebrow">{session.gate}</span>
          <div className="text-sm text-muted">{info.event}</div>
        </div>
        <button type="button" className="btn btn-ghost px-3 py-2 text-xs" onClick={logout}>Keluar</button>
        <div className="flex w-full gap-1 rounded-xl border border-line bg-black p-1" role="radiogroup" aria-label="Hari festival">
          {info.days.map(d => (
            <button key={d.day} type="button" role="radio" aria-checked={session.day === d.day}
              onClick={() => setSession({ ...session, day: d.day })}
              className={`flex-1 cursor-pointer rounded-[9px] border-0 px-3 py-2.5 text-xs font-extrabold uppercase ${session.day === d.day ? 'bg-flare text-white' : 'bg-transparent text-muted'}`}>
              {d.label.split(',')[0]}{info.today === d.day ? ' · hari ini' : ''}
            </button>
          ))}
        </div>
        {info.today !== session.day && (
          <p className="m-0 w-full text-xs text-amber-300">Perhatian: hari yang dipilih ({dayLabel}) bukan hari ini.</p>
        )}
      </header>

      <div className="relative aspect-square overflow-hidden rounded-[18px] border border-line bg-black">
        <video ref={videoRef} playsInline muted className={`size-full object-cover ${camera === 'on' ? '' : 'hidden'}`} />
        <canvas ref={canvasRef} className="hidden" />
        {camera === 'on' && (
          <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-4 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0/0.35)]" aria-hidden="true" />
        )}
        {camera !== 'on' && (
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-3 p-6 text-center">
            <p className="m-0 text-muted">{camera === 'error' ? cameraError : 'Arahkan kamera ke QR di HP atau cetakan tiket pengunjung.'}</p>
            <button type="button" className="btn btn-red" onClick={startCamera} disabled={camera === 'starting'}>
              {camera === 'starting' ? 'Membuka kamera…' : 'Nyalakan kamera'}
            </button>
          </div>
        )}
        {result && (
          <div className={`absolute inset-0 grid place-content-center gap-2 p-6 text-center ${TONE[result.result].bg}`} role="alert" aria-live="assertive">
            <b className="text-4xl font-black uppercase">{TONE[result.result].title}</b>
            <p className="m-0 text-lg font-semibold">{result.message}</p>
            {result.ticket && (
              <p className="m-0 font-mono text-sm opacity-90">{result.ticket.code} · {result.ticket.holderName}</p>
            )}
          </div>
        )}
      </div>

      {camera === 'on' && <button type="button" className="btn btn-ghost" onClick={stopCamera}>Matikan kamera</button>}

      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (manual.trim()) { submitCode(manual.trim()); setManual(''); } }}>
        <input value={manual} onChange={e => setManual(e.target.value)} placeholder="Ketik kode, mis. TKT-AB12-CD34" aria-label="Kode tiket"
          className="min-w-0 flex-1 rounded-[10px] border border-line bg-black px-3.5 py-3 font-mono font-semibold uppercase text-paper placeholder:normal-case" />
        <button type="submit" className="btn btn-white">Cek</button>
      </form>

      <section className="card grid grid-cols-2 gap-3 rounded-[14px] p-4 text-center">
        <div>
          <b className="block text-3xl font-black tabular-nums text-flare">{todayCount}</b>
          <span className="text-xs text-muted">sudah masuk ({dayLabel.split(',')[0]})</span>
        </div>
        <div>
          <b className="block text-3xl font-black tabular-nums">{stats?.issued ?? '–'}</b>
          <span className="text-xs text-muted">tiket terbit</span>
        </div>
      </section>

      {history.length > 0 && (
        <section className="card grid gap-2 rounded-[14px] p-4">
          <h2 className="text-sm">Pindaian terakhir</h2>
          <ol className="m-0 grid list-none gap-1.5 p-0 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex justify-between gap-3 border-b border-dashed border-line pb-1.5">
                <span className="min-w-0 truncate">
                  <b className={h.result === 'ok' ? 'text-emerald-300' : h.result === 'invalid' ? 'text-flare' : 'text-amber-300'}>
                    {TONE[h.result].title}
                  </b>{' '}
                  <span className="font-mono text-muted">{h.ticket?.code ?? ''}</span>
                </span>
                <span className="font-mono text-xs text-muted tabular-nums">{h.at.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
