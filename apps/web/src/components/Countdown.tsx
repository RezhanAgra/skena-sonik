import { useEffect, useState } from 'react';
import { pad } from '../lib/format';

function remaining(target: number) {
  const s = Math.max(0, target - Date.now()) / 1000;
  return [
    { label: 'hari', value: String(Math.floor(s / 86400)) },
    { label: 'jam', value: pad(Math.floor((s % 86400) / 3600)) },
    { label: 'menit', value: pad(Math.floor((s % 3600) / 60)) },
    { label: 'detik', value: pad(Math.floor(s % 60)) }
  ];
}

export default function Countdown({ startsAt }: { startsAt: string }) {
  const target = new Date(startsAt).getTime();
  const [parts, setParts] = useState(() => remaining(target));

  useEffect(() => {
    const id = setInterval(() => setParts(remaining(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  return (
    <div className="flex flex-wrap gap-2" aria-label="Hitung mundur ke grand finale">
      {parts.map(p => (
        <div key={p.label} className="grid min-w-17.5 rounded-[10px] border border-line bg-black px-3 py-2.5 text-center">
          <b className="text-[1.7rem] leading-none font-black text-flare tabular-nums" suppressHydrationWarning>{p.value}</b>
          <span className="font-mono text-[0.6rem] uppercase tracking-widest text-muted">{p.label}</span>
        </div>
      ))}
    </div>
  );
}
