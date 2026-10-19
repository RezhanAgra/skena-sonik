// Vibe check: 3 pertanyaan → persona + kartu akses + rekomendasi musisi
import { useEffect, useMemo, useState } from 'react';
import type { Artist, Genre } from '../lib/types';
import { addSaved } from '../stores/schedule';

// setiap jawaban menambah poin ke satu genre
const QUESTIONS = [
  {
    id: 'q1',
    text: 'Jam 2 pagi kamu biasanya lagi…',
    options: { poppunk: 'Teriak nyanyi lagu galau di kamar', indie: 'Deep talk di parkiran', rap: 'Nulis caption yang terlalu jujur', reggae: 'Nongkrong santai di teras' }
  },
  {
    id: 'q2',
    text: 'Jajanan festival wajibmu',
    options: { poppunk: 'Minuman soda + gorengan', indie: 'Matcha latte oat', rap: 'Kebab ukuran jumbo', reggae: 'Es kelapa muda' }
  },
  {
    id: 'q3',
    text: 'Outfit andalan',
    options: { poppunk: 'Kaos band + celana pendek + Vans', indie: 'Kemeja flanel thrift', rap: 'Jersey oversize + cap', reggae: 'Kemeja pantai motif tropis' }
  }
] as const;

type Answers = Record<string, string>;

// genre dengan jawaban terbanyak; kalau seri, jawaban pertanyaan pertama yang menang
function topGenre(answers: Answers, order: string[]) {
  const score = Object.fromEntries(order.map(g => [g, 0]));
  Object.values(answers).forEach(g => { score[g]++; });
  return order.reduce((best, g) => (score[g] > score[best] ? g : best), answers.q1 ?? order[0]);
}

export default function VibeCheck({ genres, artists }: { genres: Genre[]; artists: Artist[] }) {
  const [answers, setAnswers] = useState<Answers>({ q1: 'poppunk', q2: 'indie', q3: 'poppunk' });
  const [name, setName] = useState('Bestie Anonim');
  const [added, setAdded] = useState(false);
  // nomor acak dibuat setelah hydrate supaya HTML server dan browser sama
  const [passId, setPassId] = useState('SKN-26-0000');
  useEffect(() => setPassId('SKN-26-' + Math.floor(1000 + Math.random() * 9000)), []);

  const genre = useMemo(() => {
    const slug = topGenre(answers, genres.map(g => g.slug));
    return genres.find(g => g.slug === slug) ?? genres[0];
  }, [answers, genres]);
  const picks = artists.filter(a => a.genre === genre?.slug);

  const addPicks = () => {
    addSaved(picks.map(a => a.slug));
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  if (!genre) return null;

  return (
    <div className="grid items-start gap-6.5 lg:grid-cols-2">
      <form className="grid min-w-0 gap-3.5" onSubmit={e => e.preventDefault()}>
        {QUESTIONS.map(q => (
          <fieldset key={q.id} className="card m-0 grid gap-2.5 rounded-[14px] p-4">
            <legend className="px-1.5 text-[0.95rem] font-extrabold uppercase">{q.text}</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(q.options).map(([slug, label]) => {
                const checked = answers[q.id] === slug;
                return (
                  <label
                    key={slug}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-[10px] border bg-panel-2 p-2.75 text-sm font-semibold ${checked ? 'border-flare' : 'border-transparent'}`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={slug}
                      checked={checked}
                      onChange={() => setAnswers(a => ({ ...a, [q.id]: slug }))}
                      className="size-4.25 flex-none accent-flare"
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="grid gap-1.5">
          <label htmlFor="pass-name" className="font-mono text-[0.7rem] uppercase tracking-widest text-muted">Nama di kartu</label>
          <input
            id="pass-name"
            type="text"
            maxLength={28}
            value={name}
            autoComplete="nickname"
            onChange={e => setName(e.target.value)}
            className="min-w-0 rounded-[10px] border border-line bg-black px-3.5 py-3.25 font-semibold text-paper"
          />
        </div>
      </form>

      <div className="grid min-w-0 gap-3.5 lg:sticky lg:top-35">
        <div className="relative grid gap-3.5 overflow-hidden rounded-[18px] border border-[rgb(255_90_80/0.6)] bg-[radial-gradient(circle_at_85%_0%,#ff3a2a,#8a0000_45%,#120000_85%)] p-5.5 shadow-[0_0_60px_rgb(255_31_31/0.35)]">
          <div className="flex justify-between gap-2.5 font-mono text-[0.68rem] uppercase tracking-widest text-[#ffd4d4]">
            <span className="logo-type text-2xl text-white">Skena Sonik</span>
            <span>{passId}</span>
          </div>
          <div>
            <div className="font-mono text-[0.68rem] uppercase tracking-widest text-[#ffd4d4]">Persona kamu</div>
            <h3 className="text-[clamp(1.7rem,3.4vw,2.4rem)]">{genre.persona.name}</h3>
          </div>
          <div className="text-xl font-extrabold wrap-anywhere">{name.trim() || 'Bestie Anonim'}</div>
          <p className="m-0 text-[0.95rem] text-[#ffe2e2]">{genre.persona.desc}</p>
          <div className="flex flex-wrap gap-1.5">
            {picks.map(a => <span key={a.slug} className="rounded-full bg-black/55 px-2.5 py-1.25 text-xs font-bold">{a.name}</span>)}
          </div>
          <div className="flex justify-between gap-2.5 font-mono text-[0.68rem] uppercase tracking-widest text-[#ffd4d4]">
            <span>Panggung: {genre.persona.stage}</span>
            <span>Jakarta · 12–13.12</span>
          </div>
          <div className="barcode h-10 rounded-[3px] opacity-85" aria-hidden="true" />
        </div>
        <p className="m-0 text-sm text-muted">Kartu diperbarui otomatis setiap kamu ganti jawaban.</p>
        <button type="button" className="btn btn-red justify-self-start" onClick={addPicks}>
          {added ? '✓ Masuk jadwal' : '+ Masukkan rekomendasi ke jadwal'}
        </button>
      </div>
    </div>
  );
}
