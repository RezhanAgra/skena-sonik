// Kartu lineup + filter genre. Tombol "+ Jadwal" menyimpan set ke store bersama
import { useState } from 'react';
import type { Artist, Festival, Genre } from '../lib/types';
import { toggleSaved, useSaved } from '../stores/schedule';

const dayShort = (days: Festival['event']['days'], day: number) => days[day]?.split(',')[0] ?? '';

function ArtistCard({ artist, genre, days, saved }: { artist: Artist; genre?: Genre; days: Festival['event']['days']; saved: boolean }) {
  const p = artist.performance;
  return (
    <article
      className={`card grid min-h-45 min-w-0 content-between gap-3 rounded-[14px] p-4.5 transition hover:border-flare/60 hover:shadow-glow-soft ${
        artist.headliner ? 'bg-linear-135 from-[#2a0000] to-panel to-65% border-flare/40 sm:col-span-2' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <span className="tag">{genre?.label}</span>
        {p && (
          <span className="text-right font-mono text-[0.7rem] text-muted">
            {dayShort(days, p.day)} · {p.start}
            <br />
            {p.stageName}
          </span>
        )}
      </div>
      <h3 className={`wrap-anywhere ${artist.headliner ? 'text-[clamp(1.9rem,4vw,3rem)]' : 'text-[1.45rem]'}`}>{artist.name}</h3>
      <p className="m-0 text-sm text-muted">{genre?.bio}</p>
      <div className="flex items-center justify-between gap-2.5">
        <span className="font-mono text-[0.7rem] text-muted">{p ? `${p.endMinute - p.startMinute} menit` : ''}</span>
        {p && (
          <button
            type="button"
            aria-pressed={saved}
            onClick={() => toggleSaved(artist.slug)}
            className={`cursor-pointer rounded-lg border px-3 py-2.25 text-[0.72rem] font-extrabold uppercase leading-none ${
              saved ? 'border-flare bg-flare text-white' : 'border-paper bg-transparent text-paper'
            }`}
          >
            {saved ? '✓ Di jadwal' : '+ Jadwal'}
          </button>
        )}
      </div>
    </article>
  );
}

export default function Lineup({ artists, genres, days }: { artists: Artist[]; genres: Genre[]; days: Festival['event']['days'] }) {
  const [filter, setFilter] = useState('all');
  const saved = useSaved();
  const genreBySlug = Object.fromEntries(genres.map(g => [g.slug, g]));
  const options = [{ slug: 'all', label: 'Semua' }, ...genres];
  const visible = artists.filter(a => filter === 'all' || a.genre === filter);

  return (
    <>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="Filter genre">
        {options.map(o => (
          <button
            key={o.slug}
            type="button"
            aria-pressed={filter === o.slug}
            onClick={() => setFilter(o.slug)}
            className={`cursor-pointer rounded-full border px-3.5 py-2.5 text-xs font-bold uppercase leading-none tracking-wide ${
              filter === o.slug ? 'border-flare bg-flare text-white shadow-glow' : 'border-line bg-transparent text-paper'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="mt-6.5 grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {visible.map(a => (
          <ArtistCard key={a.slug} artist={a} genre={genreBySlug[a.genre]} days={days} saved={saved.includes(a.slug)} />
        ))}
      </div>
    </>
  );
}
