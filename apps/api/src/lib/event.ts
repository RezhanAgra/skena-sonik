// Info acara yang dipakai di e-tiket dan aturan gerbang
export const EVENT = {
  name: 'Skena Sonik Tour 2026 · Grand Finale Jakarta',
  shortName: 'Skena Sonik 2026',
  venue: 'Lapangan Terbuka, Jakarta',
  gatesOpen: '14.00 WIB',
  timeZone: 'Asia/Jakarta',
  // hari festival → tanggal lokal (YYYY-MM-DD)
  days: {
    1: { label: 'Sabtu, 12 Desember 2026', date: '2026-12-12' },
    2: { label: 'Minggu, 13 Desember 2026', date: '2026-12-13' }
  } as Record<number, { label: string; date: string }>
};

export const EVENT_DAYS = Object.keys(EVENT.days).map(Number);

/** Hari festival hari ini menurut waktu Jakarta, atau null kalau bukan hari festival */
export function todayEventDay(now = new Date()): number | null {
  const local = new Intl.DateTimeFormat('en-CA', { timeZone: EVENT.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const hit = Object.entries(EVENT.days).find(([, d]) => d.date === local);
  return hit ? Number(hit[0]) : null;
}

export const accessLabel = (daysAccess: number) =>
  daysAccess >= EVENT_DAYS.length ? 'Berlaku Sabtu & Minggu' : 'Berlaku 1 hari pilihan';
