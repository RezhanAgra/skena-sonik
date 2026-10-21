// Mengisi database dengan konten awal (dipindahkan dari js/data.js versi statis).
// Aman dijalankan berulang: semua data konten dihapus lalu diisi ulang. Subscriber & order tidak disentuh.
import { prisma } from '../src/db.ts';
import { CityStatus } from '../src/generated/prisma/client.ts';

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

const cities = [
  { code: 'MDN', name: 'Medan', dateLabel: 'Sab, 14 Nov', status: CityStatus.SOLD_OUT },
  { code: 'SBY', name: 'Surabaya', dateLabel: 'Sab, 21 Nov', status: CityStatus.SOLD_OUT },
  { code: 'YOG', name: 'Yogyakarta', dateLabel: 'Sab, 28 Nov', status: CityStatus.SOLD_OUT },
  { code: 'BDG', name: 'Bandung', dateLabel: 'Sab, 5 Des', status: CityStatus.LOW },
  { code: 'JKT', name: 'Jakarta · Grand Finale', dateLabel: '12–13 Des', status: CityStatus.ON_SALE },
  { code: 'DPS', name: 'Bali', dateLabel: 'Min, 20 Des', status: CityStatus.SOON }
];

const stages = ['Main Character', 'Side Quest', 'Gua Bass'];

const genres = [
  {
    slug: 'poppunk', label: 'Pop punk',
    bio: 'Siapin suara buat sing-along dan tenaga buat moshpit.',
    personaName: 'Moshpit Veteran', personaStage: 'Main Character',
    personaDesc: 'Suara habis di lagu kedua, tapi tetap ikut sing-along sampai encore.'
  },
  {
    slug: 'indie', label: 'Indie',
    bio: 'Set yang paling pas ditonton sambil hafalin lirik bareng.',
    personaName: 'Senja Revisionist', personaStage: 'Main Character (sore)',
    personaDesc: 'Nonton sambil duduk di rumput, hafal semua lirik, diam-diam nangis di lagu ketiga.'
  },
  {
    slug: 'rap', label: 'Rap',
    bio: 'Barisan depan buat yang hafal setiap bar.',
    personaName: 'Bar-for-Bar Bestie', personaStage: 'Gua Bass',
    personaDesc: 'Berdiri di barisan depan, ikut nge-rap tiap punchline, selalu ngerekam verse kedua.'
  },
  {
    slug: 'reggae', label: 'Reggae',
    bio: 'Waktunya santai, goyang pelan, dan angkat tangan bareng.',
    personaName: 'Good Vibes Only', personaStage: 'Side Quest',
    personaDesc: 'Datang santai, goyang pelan, dan bikin semua orang di sekitarmu ikut senyum.'
  }
];

const artists = [
  { slug: 'pwg', name: 'Pee Wee Gaskins', genreSlug: 'poppunk', headliner: true },
  { slug: 'hindia', name: 'Hindia', genreSlug: 'indie', headliner: true },
  { slug: 'tenxi', name: 'Tenxi', genreSlug: 'rap', headliner: true },
  { slug: 'steven', name: 'Steven & Coconuttreez', genreSlug: 'reggae', headliner: true },
  { slug: 'sha', name: 'Stand Here Alone', genreSlug: 'poppunk' },
  { slug: 'rot', name: 'Remember Of Today', genreSlug: 'poppunk' },
  { slug: 'panturas', name: 'The Panturas', genreSlug: 'indie' },
  { slug: 'forrevenge', name: 'For Revenge', genreSlug: 'indie' },
  { slug: 'poris', name: 'Poris', genreSlug: 'rap' },
  { slug: 'envy', name: 'Envy', genreSlug: 'rap' },
  { slug: 'souljah', name: 'Souljah', genreSlug: 'reggae' },
  { slug: 'tonyq', name: 'Tony Q Rastafara', genreSlug: 'reggae' }
];

// [artis, hari, indeks panggung, mulai, selesai]
const performances: [string, number, number, string, string][] = [
  ['rot', 1, 0, '16:00', '17:00'], ['forrevenge', 1, 0, '19:30', '20:45'], ['pwg', 1, 0, '22:54', '23:30'],
  ['poris', 1, 1, '17:00', '18:00'], ['souljah', 1, 1, '18:30', '19:30'],
  ['envy', 1, 2, '21:15', '22:35'],
  ['sha', 2, 0, '16:00', '17:00'], ['panturas', 2, 0, '18:30', '19:45'], ['steven', 2, 0, '20:15', '21:30'], ['hindia', 2, 0, '22:00', '23:30'],
  ['tonyq', 2, 1, '19:00', '20:30'],
  ['tenxi', 2, 2, '21:00', '22:15']
];

const songs = [
  { artistSlug: 'hindia', title: 'Evaluasi', speed: 1 },
  { artistSlug: 'pwg', title: 'Sebuah Rahasia', speed: 1.8 },
  { artistSlug: 'steven', title: 'Welcome to My Paradise', speed: 0.7 }
];

const tiers = [
  { slug: 'early-bird', name: 'Early Bird', price: 350000, perks: ['Terjual habis dalam 11 menit'], soldOut: true, badge: 'Sold out' },
  { slug: 'daily', name: 'Daily Pass', price: 450000, daysAccess: 1, perks: ['Akses 1 hari pilihan', 'Gelang cashless'] },
  {
    slug: 'two-day', name: '2-Day Pass', price: 790000, badge: 'Paling laku', squadPrice: 700000, squadMin: 4,
    perks: ['Akses Sabtu & Minggu', 'Rp700rb/orang untuk squad 4+']
  },
  { slug: 'pit', name: 'Pit Pass', price: 1450000, perks: ['2 hari, area depan panggung utama', 'Jalur masuk & toilet terpisah'] }
];

async function main() {
  await prisma.$transaction(async tx => {
    // hapus dari tabel anak ke induk
    await tx.song.deleteMany();
    await tx.performance.deleteMany();
    await tx.artist.deleteMany();
    await tx.genre.deleteMany();
    await tx.stage.deleteMany();
    await tx.city.deleteMany();

    await tx.city.createMany({ data: cities.map((c, i) => ({ ...c, sortOrder: i })) });
    await tx.genre.createMany({ data: genres.map((g, i) => ({ ...g, sortOrder: i })) });
    await tx.artist.createMany({ data: artists });

    const stageRows = await Promise.all(
      stages.map((name, i) => tx.stage.create({ data: { name, sortOrder: i } }))
    );
    await tx.performance.createMany({
      data: performances.map(([artistSlug, day, stage, start, end]) => ({
        artistSlug, day, stageId: stageRows[stage].id, startMinute: toMinutes(start), endMinute: toMinutes(end)
      }))
    });
    await tx.song.createMany({ data: songs.map((s, i) => ({ ...s, sortOrder: i })) });

    // tier dipakai oleh order, jadi di-upsert, bukan dihapus
    for (const [i, t] of tiers.entries()) {
      const data = { soldOut: false, badge: null, squadPrice: null, squadMin: null, daysAccess: 2, ...t, sortOrder: i };
      await tx.ticketTier.upsert({ where: { slug: t.slug }, create: data, update: data });
    }
  });

  console.log(`Seed selesai: ${cities.length} kota, ${artists.length} artis, ${performances.length} jadwal, ${songs.length} lagu, ${tiers.length} tiket.`);
}

main()
  .catch(err => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
