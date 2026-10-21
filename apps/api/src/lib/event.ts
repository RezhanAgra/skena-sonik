// Info acara yang dipakai di e-tiket dan aturan gerbang
export const EVENT = {
  name: 'Skena Sonik Tour 2026 · Grand Finale Jakarta',
  shortName: 'Skena Sonik 2026',
  venue: 'Lapangan Terbuka, Jakarta',
  location: 'Lapangan Terbuka, Jakarta Pusat, DKI Jakarta',
  gatesOpen: '14.00 WIB',
  hours: '14:00 - 23:30 WIB',
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

/** Tanggal berlaku tiket untuk ditampilkan di e-tiket */
export const ticketDateLabel = (daysAccess: number) =>
  daysAccess >= EVENT_DAYS.length ? '12 & 13 Desember 2026' : '12 atau 13 Desember 2026 (pilih 1 hari)';

/** Syarat & ketentuan yang dicetak di halaman terakhir PDF e-tiket */
export const TERMS = [
  'Tiket yang sudah dibeli tidak dapat dikembalikan, kecuali acara dibatalkan oleh penyelenggara.',
  'Satu QR berlaku untuk satu orang. 2-Day Pass dan Pit Pass berlaku Sabtu dan Minggu (1 kali masuk per hari); Daily Pass berlaku untuk 1 hari pilihan.',
  'QR yang sudah dipindai tidak dapat dipakai lagi di hari yang sama. Jangan membagikan foto atau tangkapan layar e-tiket kepada siapa pun.',
  'Pengunjung minimal berusia 16 tahun. Pengunjung di bawah 16 tahun wajib didampingi orang tua atau wali yang juga memiliki tiket.',
  'Petugas dapat meminta kartu identitas (KTP, SIM, atau kartu pelajar) yang sesuai dengan nama pemesan.',
  'Penyelenggara berhak mengubah jadwal atau pengisi acara karena keadaan kahar (force majeure). Selama acara tetap berlangsung, perubahan ini tidak menjadi dasar pengembalian dana.',
  'Dilarang membawa senjata tajam, narkoba, minuman beralkohol, dan barang berbahaya lainnya. Powerbank maksimal 20.000 mAh.',
  'Kamera profesional dan perekaman untuk tujuan komersial tidak diizinkan tanpa izin tertulis dari penyelenggara.',
  'Pengunjung wajib mematuhi arahan petugas keamanan serta prosedur evakuasi di area acara.',
  'Skena Sonik Tour 2026 adalah proyek mockup: acara, harga, dan tiket ini tidak sungguhan.'
];
