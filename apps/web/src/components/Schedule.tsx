// Clash finder: jadwal per panggung + panel "Jadwalmu"
import { useState } from 'react';
import type { Artist, Festival, Stage } from '../lib/types';
import { clearSaved, toggleSaved, useSaved } from '../stores/schedule';

type Booked = Artist & { performance: NonNullable<Artist['performance']> };

// set lain yang dipilih dan jamnya tumpang tindih di hari yang sama
function clashesOf(a: Booked, picked: Booked[]) {
  const p = a.performance;
  return picked.filter(o => o.slug !== a.slug && o.performance.day === p.day
    && o.performance.startMinute < p.endMinute && p.startMinute < o.performance.endMinute);
}

export default function Schedule({ artists, stages, days }: { artists: Artist[]; stages: Stage[]; days: Festival['event']['days'] }) {
  const [day, setDay] = useState(1);
  const saved = useSaved();
  const booked = artists.filter((a): a is Booked => a.performance !== null);
  const picked = booked
    .filter(a => saved.includes(a.slug))
    .sort((x, y) => x.performance.day - y.performance.day || x.performance.startMinute - y.performance.startMinute);
  const clashCount = picked.filter(a => clashesOf(a, picked).length).length;
  const minutes = picked.reduce((sum, a) => sum + a.performance.endMinute - a.performance.startMinute, 0);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1fr_320px]">
      <div className="min-w-0">
        <div className="mb-4 inline-flex gap-1 rounded-xl border border-line bg-panel p-1" role="tablist" aria-label="Hari">
          {Object.entries(days).map(([d, label]) => (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={day === +d}
              onClick={() => setDay(+d)}
              className={`cursor-pointer rounded-[9px] border-0 px-4 py-2.75 text-[0.82rem] font-extrabold uppercase leading-none ${
                day === +d ? 'bg-flare text-white' : 'bg-transparent text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="grid gap-2.5 sm:grid-cols-3" role="tabpanel">
          {stages.map(stage => (
            <div key={stage.id} className="card grid min-w-0 content-start gap-2 rounded-[14px] p-3">
              <h4 className="m-0 mb-1 font-mono text-xs uppercase tracking-widest text-flare">{stage.name}</h4>
              {booked
                .filter(a => a.performance.day === day && a.performance.stageId === stage.id)
                .sort((x, y) => x.performance.startMinute - y.performance.startMinute)
                .map(a => {
                  const on = saved.includes(a.slug);
                  const clashes = on ? clashesOf(a, picked) : [];
                  return (
                    <button
                      key={a.slug}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleSaved(a.slug)}
                      className={`grid w-full cursor-pointer gap-0.75 rounded-[10px] border p-2.75 text-left ${
                        on ? 'border-paper bg-paper text-black' : 'border-line bg-panel-2 text-paper'
                      } ${clashes.length ? 'border-flare ring-2 ring-flare' : ''}`}
                    >
                      <span className={`font-mono text-[0.7rem] tabular-nums ${on ? 'text-[#444]' : 'text-muted'}`}>
                        {a.performance.start}–{a.performance.end}
                      </span>
                      <span className="leading-tight font-extrabold">{a.name}</span>
                      {clashes.length > 0 && (
                        <span className="font-mono text-[0.64rem] font-bold uppercase text-[#d10000]">
                          Bentrok dengan {clashes.map(c => c.name).join(', ')}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <aside className="card grid gap-3 rounded-2xl border-flare/40 p-5 shadow-glow-soft lg:sticky lg:top-35" aria-live="polite">
        <span className="eyebrow">Jadwalmu</span>
        <h3 className="text-[1.4rem]">{picked.length ? `${picked.length} set dipilih` : 'Belum ada set'}</h3>
        {picked.length ? (
          <>
            <ol className="m-0 grid list-none gap-2 p-0">
              {picked.map(a => {
                const clash = clashesOf(a, picked).length > 0;
                return (
                  <li key={a.slug} className="grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 border-b border-dashed border-line pb-2">
                    <span className="row-span-2 self-start rounded-md bg-flare px-1.75 py-1.25 font-mono text-[0.66rem]">
                      {days[a.performance.day]?.split(',')[0]}
                    </span>
                    <span className="font-extrabold">{a.name}</span>
                    <span className="font-mono text-[0.7rem] text-muted">
                      {a.performance.start}–{a.performance.end} · {a.performance.stageName}
                      {clash && <b className="text-flare"> · bentrok</b>}
                    </span>
                  </li>
                );
              })}
            </ol>
            <span className="font-mono text-[0.72rem] text-muted">
              {Math.floor(minutes / 60)} jam {minutes % 60} menit musik · {clashCount ? `${clashCount} set bentrok` : 'tidak ada yang bentrok'}
            </span>
            <button type="button" className="btn btn-ghost justify-self-start" onClick={clearSaved}>Kosongkan</button>
          </>
        ) : (
          <p className="m-0 text-sm text-muted">Tekan nama artis di jadwal untuk menambahkannya. Pilihanmu tersimpan di browser ini.</p>
        )}
      </aside>
    </div>
  );
}
