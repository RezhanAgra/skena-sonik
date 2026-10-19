// Slider lagu dari lineup + animasi layar LED (canvas) di belakangnya
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Genre, Song } from '../lib/types';
import { SILHOUETTE_FIST } from '../lib/silhouettes';

const DURATION = 7000; // ms per slide
const COLS = 40;
const ROWS = 18;

const prefersReducedMotion = () =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

function useLedScreen(canvasRef: React.RefObject<HTMLCanvasElement | null>, speedRef: React.RefObject<number>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduce = prefersReducedMotion();
    const silhouette = new Path2D(SILHOUETTE_FIST);
    const levels = new Array(COLS).fill(0);
    let W = 0, H = 0, clock = 0, last = 0, frame = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(2, devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time: number) => {
      clock += (time - (last || time)) * speedRef.current;
      last = time;
      const beat = Math.pow(Math.max(0, Math.sin(clock / 300)), 6);

      for (let i = 0; i < COLS; i++) {
        const target = 0.22 + 0.16 * Math.sin(clock / 700 + i * 0.4) + 0.1 * Math.sin(clock / 260 + i * 1.3)
          + beat * 0.25 * (1 - Math.abs(i - COLS / 2) / COLS);
        levels[i] += (target - levels[i]) * 0.3;
      }

      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, W, H);
      const sx = W * 0.14, sw = W * 0.72, sy = H * 0.08, sh = H * 0.5;
      const glow = ctx.createRadialGradient(W / 2, sy + sh / 2, 10, W / 2, sy + sh / 2, W * 0.6);
      glow.addColorStop(0, `rgba(255,31,31,${0.3 + beat * 0.25})`);
      glow.addColorStop(1, 'rgba(255,31,31,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      // panel LED
      ctx.fillStyle = '#1a0000';
      ctx.fillRect(sx, sy, sw, sh);
      const cw = sw / COLS, rh = sh / ROWS;
      for (let i = 0; i < COLS; i++) {
        const lit = Math.round(levels[i] * ROWS);
        for (let r = 0; r < ROWS; r++) {
          const on = r < lit;
          const a = on ? 0.55 + (r / ROWS) * 0.45 : 0.07;
          ctx.fillStyle = on && r > ROWS * 0.8 ? `rgba(255,220,210,${a})` : `rgba(255,31,31,${a})`;
          ctx.fillRect(sx + i * cw + 1, sy + sh - (r + 1) * rh + 1, cw - 2, rh - 2);
        }
      }

      // lantai + siluet
      const fy = H * 0.66;
      const floor = ctx.createLinearGradient(0, fy, 0, H);
      floor.addColorStop(0, '#3a0000');
      floor.addColorStop(1, '#050505');
      ctx.fillStyle = floor;
      ctx.fillRect(0, fy, W, H - fy);
      const sH = H * 0.5, scale = sH / 420;
      ctx.save();
      ctx.translate(W / 2 - 100 * scale, fy + 8 - sH);
      ctx.scale(scale, scale);
      ctx.fillStyle = '#000';
      ctx.fill(silhouette);
      ctx.restore();

      if (!reduce) frame = requestAnimationFrame(draw);
    };

    const onResize = () => { resize(); if (reduce) requestAnimationFrame(draw); };
    resize();
    addEventListener('resize', onResize);
    frame = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(frame); removeEventListener('resize', onResize); };
  }, [canvasRef, speedRef]);
}

export default function SongSlider({ songs, genres }: { songs: Song[]; genres: Genre[] }) {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const speedRef = useRef(songs[0]?.speed ?? 1);
  const startX = useRef<number | null>(null);
  const label = Object.fromEntries(genres.map(g => [g.slug, g.label]));

  const go = useCallback((i: number) => setCurrent((i + songs.length) % songs.length), [songs.length]);

  speedRef.current = songs[current]?.speed ?? 1;
  useLedScreen(canvasRef, speedRef);

  // pindah otomatis; reset setiap slide berganti atau saat jeda berubah
  useEffect(() => {
    if (paused || prefersReducedMotion() || songs.length < 2) return;
    const id = setTimeout(() => go(current + 1), DURATION);
    return () => clearTimeout(id);
  }, [current, paused, go, songs.length]);

  if (!songs.length) return null;
  const song = songs[current];
  const query = encodeURIComponent(`${song.artist} ${song.title}`);

  return (
    <div>
      <div
        className="relative aspect-[4/4.4] max-w-full touch-pan-y overflow-hidden rounded-md sm:aspect-[16/8]"
        role="region"
        aria-roledescription="carousel"
        aria-label="Lagu pilihan dari lineup"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onKeyDown={e => {
          if (e.key === 'ArrowLeft') go(current - 1);
          if (e.key === 'ArrowRight') go(current + 1);
        }}
        onPointerDown={e => { startX.current = e.clientX; }}
        onPointerUp={e => {
          if (startX.current === null) return;
          const dx = e.clientX - startX.current;
          startX.current = null;
          if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1));
        }}
      >
        <canvas ref={canvasRef} className="block size-full" aria-hidden="true" />

        <div
          key={song.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${current + 1} dari ${songs.length}`}
          className="absolute inset-x-0 bottom-0 grid animate-rise gap-1.5 bg-linear-to-b from-transparent to-black/85 to-45% py-[clamp(14px,3vw,28px)] pr-[clamp(56px,7vw,80px)] pl-[clamp(14px,3vw,28px)]"
        >
          <span className="font-mono text-[0.7rem] uppercase tracking-widest text-[#ffcfcf]">
            Lagu {current + 1} / {songs.length} · {label[song.genre]}{song.when && ` · tampil ${song.when}`}
          </span>
          <h3 className="text-[clamp(1.5rem,4.2vw,2.8rem)] wrap-anywhere text-white">{song.title}</h3>
          <span className="font-bold text-[#ffd9d9]">{song.artist}</span>
          <div className="mt-2 flex flex-wrap gap-2">
            <a className="btn btn-red px-4 py-2.75 text-xs" href={`https://open.spotify.com/search/${query}`} target="_blank" rel="noopener">
              ▶ Dengar di Spotify
            </a>
            <a className="btn px-4 py-2.75 text-xs" href={`https://www.youtube.com/results?search_query=${query}`} target="_blank" rel="noopener">
              Tonton di YouTube
            </a>
          </div>
        </div>

        {[
          { dir: -1, label: 'Lagu sebelumnya', icon: '‹', pos: 'left-3' },
          { dir: 1, label: 'Lagu berikutnya', icon: '›', pos: 'right-3' }
        ].map(a => (
          <button
            key={a.dir}
            type="button"
            aria-label={a.label}
            onClick={() => go(current + a.dir)}
            className={`absolute top-[30%] ${a.pos} size-11 -translate-y-1/2 cursor-pointer rounded-full border border-line bg-black/60 text-2xl leading-none text-white hover:border-flare hover:bg-flare sm:top-[40%]`}
          >
            {a.icon}
          </button>
        ))}
      </div>

      <div className="mt-4 flex justify-center gap-2" role="tablist" aria-label="Pilih lagu" style={{ '--slide-duration': `${DURATION / 1000}s` } as React.CSSProperties}>
        {songs.map((s, i) => {
          const active = i === current;
          return (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={`${s.title} oleh ${s.artist}`}
              onClick={() => go(i)}
              className={`relative cursor-pointer overflow-hidden rounded-full border bg-panel px-2.5 py-2.25 text-[0.68rem] font-bold uppercase leading-none tracking-wide sm:px-3 sm:text-xs ${active ? 'border-flare text-white' : 'border-line text-muted'}`}
            >
              {s.artist}
              {active && (
                <span
                  key={`${s.id}-${current}`}
                  className="absolute inset-x-0 bottom-0 h-0.75 origin-left animate-progress bg-flare"
                  style={{ animationPlayState: paused ? 'paused' : 'running' }}
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
