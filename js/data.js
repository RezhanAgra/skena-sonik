// Semua konten halaman: kota, lineup, jadwal, lagu, persona, harga tiket.
// Ubah isi file ini untuk mengganti konten tanpa menyentuh logika.
(() => {
  const EVENT_START = '2026-12-12T14:00:00+07:00';

  /* ---------- pita di hero ---------- */
  const TAPES = [
    ['Daftar biar nggak ketinggalan', 'Skena Sonik Tour', 'Presale Jakarta dibuka', 'Sejarah baru skena'],
    ['Presale Bali segera', 'Skena Sonik Tour', 'Daftar biar nggak ketinggalan', 'Grand finale 12–13 Des']
  ];

  /* ---------- kota tur ---------- */
  // status: sold | low | live | soon
  const CITIES = [
    { code: 'MDN', name: 'Medan', date: 'Sab, 14 Nov', status: 'sold' },
    { code: 'SBY', name: 'Surabaya', date: 'Sab, 21 Nov', status: 'sold' },
    { code: 'YOG', name: 'Yogyakarta', date: 'Sab, 28 Nov', status: 'sold' },
    { code: 'BDG', name: 'Bandung', date: 'Sab, 5 Des', status: 'low' },
    { code: 'JKT', name: 'Jakarta · Grand Finale', date: '12–13 Des', status: 'live' },
    { code: 'DPS', name: 'Bali', date: 'Min, 20 Des', status: 'soon' }
  ];
  const CITY_STATUS = { sold: 'Sold out', low: 'Sisa sedikit', live: 'Beli tiket', soon: 'Segera' };
  // siluet gedung kecil di thumbnail kartu kota (viewBox 140×120)
  const SKYLINE = {
    MDN: 'M0 120V80h20V60h10v20h14V50l8-14 8 14v30h16V64h18v56z',
    SBY: 'M0 120V90h18V70h6V40h4v30h6v20h22V58l14-18 14 18v32h20V76h16v44z',
    YOG: 'M0 120V96h20l10-14h40l10 14h20V84l20-30 20 30v36z',
    BDG: 'M0 120V92l30-20 20 10 30-26 30 20 30-6 20 14v36z',
    JKT: 'M0 120V88h16V70h12v18h20V60h6V18l6-10 6 10v42h6v28h18V66h16v54z',
    DPS: 'M0 120V100l20-12 20 12V76l30-36 30 36v24l20-12 20 12v20z'
  };

  /* ---------- lineup ---------- */
  const STAGES = ['Main Character', 'Side Quest', 'Gua Bass'];
  const DAYS = { 1: 'Sab', 2: 'Min' };
  const VIBE_LABEL = { poppunk: 'Pop punk', indie: 'Indie', rap: 'Rap', reggae: 'Reggae' };
  const VIBE_BIO = {
    poppunk: 'Siapin suara buat sing-along dan tenaga buat moshpit.',
    indie: 'Set yang paling pas ditonton sambil hafalin lirik bareng.',
    rap: 'Barisan depan buat yang hafal setiap bar.',
    reggae: 'Waktunya santai, goyang pelan, dan angkat tangan bareng.'
  };
  const ARTISTS = [
    { id: 'pwg', name: 'Pee Wee Gaskins', vibe: 'poppunk', head: true },
    { id: 'hindia', name: 'Hindia', vibe: 'indie', head: true },
    { id: 'tenxi', name: 'Tenxi', vibe: 'rap', head: true },
    { id: 'steven', name: 'Steven & Coconuttreez', vibe: 'reggae', head: true },
    { id: 'sha', name: 'Stand Here Alone', vibe: 'poppunk' },
    { id: 'rot', name: 'Remember Of Today', vibe: 'poppunk' },
    { id: 'panturas', name: 'The Panturas', vibe: 'indie' },
    { id: 'forrevenge', name: 'For Revenge', vibe: 'indie' },
    { id: 'poris', name: 'Poris', vibe: 'rap' },
    { id: 'envy', name: 'Envy', vibe: 'rap' },
    { id: 'souljah', name: 'Souljah', vibe: 'reggae' },
    { id: 'tonyq', name: 'Tony Q Rastafara', vibe: 'reggae' }
  ].map(a => ({ ...a, bio: VIBE_BIO[a.vibe] }));

  /* ---------- jadwal ---------- */
  // [id artis, hari (1|2), indeks panggung, mulai, selesai]
  const SETS = [
    ['rot', 1, 0, '16:00', '17:00'], ['forrevenge', 1, 0, '19:00', '20:15'], ['pwg', 1, 0, '22:00', '23:30'],
    ['poris', 1, 1, '17:00', '18:00'], ['souljah', 1, 1, '18:30', '19:30'],
    ['envy', 1, 2, '21:30', '22:30'],
    ['sha', 2, 0, '16:00', '17:00'], ['panturas', 2, 0, '18:30', '19:45'], ['steven', 2, 0, '20:15', '21:30'], ['hindia', 2, 0, '22:00', '23:30'],
    ['tonyq', 2, 1, '19:00', '20:30'],
    ['tenxi', 2, 2, '21:00', '22:15']
  ].map(([id, day, stage, start, end]) => ({ id, day, stage, start, end, a: SS.toMinutes(start), b: SS.toMinutes(end) }));

  const artistById = Object.fromEntries(ARTISTS.map(a => [a.id, a]));
  const setById = Object.fromEntries(SETS.map(s => [s.id, s]));

  /* ---------- slider lagu ---------- */
  // speed mengatur tempo animasi layar LED
  const SONGS = [
    { band: 'Hindia', title: 'Evaluasi', vibe: 'indie', when: 'Min, 13 Des · 22.00', speed: 1 },
    { band: 'Pee Wee Gaskins', title: 'Sebuah Rahasia', vibe: 'poppunk', when: 'Sab, 12 Des · 22.00', speed: 1.8 },
    { band: 'Steven & Coconuttreez', title: 'Welcome to My Paradise', vibe: 'reggae', when: 'Min, 13 Des · 20.15', speed: .7 }
  ];

  /* ---------- vibe check ---------- */
  const PERSONA = {
    poppunk: { name: 'Moshpit Veteran', stage: 'Main Character', desc: 'Suara habis di lagu kedua, tapi tetap ikut sing-along sampai encore.' },
    indie: { name: 'Senja Revisionist', stage: 'Main Character (sore)', desc: 'Nonton sambil duduk di rumput, hafal semua lirik, diam-diam nangis di lagu ketiga.' },
    rap: { name: 'Bar-for-Bar Bestie', stage: 'Gua Bass', desc: 'Berdiri di barisan depan, ikut nge-rap tiap punchline, selalu ngerekam verse kedua.' },
    reggae: { name: 'Good Vibes Only', stage: 'Side Quest', desc: 'Datang santai, goyang pelan, dan bikin semua orang di sekitarmu ikut senyum.' }
  };
  const VIBE_ORDER = ['poppunk', 'indie', 'rap', 'reggae'];

  /* ---------- tiket ---------- */
  const TICKETS = {
    price: { '1d': 450000, '2d': 790000, vip: 1450000 },
    name: { '1d': 'Daily Pass', '2d': '2-Day Pass', vip: 'Pit Pass' },
    fee: 15000,
    squadPrice: 700000, // harga 2-Day Pass per orang untuk squad
    squadMin: 4,
    maxSquad: 10
  };

  // path siluet yang juga digambar di layar LED (sama dengan #sil-fist di index.html)
  const SILHOUETTE = 'M120 6c6-4 14 0 14 8l-4 26c-1 8-4 16-8 22l-8 40c-2 8-6 13-11 16l2 10c10 4 18 12 21 24l14 70c2 10-2 16-9 17l-4 1 2 30c12 30 22 72 27 112 1 9-4 14-12 14h-26c-6 0-10-4-11-10l-14-98-12 98c-1 6-5 10-11 10H44c-8 0-13-5-12-14 5-40 15-82 27-112l2-30-6-2c-7-2-10-8-8-16l12-62c3-14 12-24 24-28l-2-2c-8-4-13-12-13-22 0-14 11-24 24-24 3 0 6 0 9 2l6-34c1-6 4-12 8-16l3-20c1-6 3-10 4-10z';

  SS.data = {
    EVENT_START, TAPES, CITIES, CITY_STATUS, SKYLINE,
    STAGES, DAYS, VIBE_LABEL, ARTISTS, SETS, artistById, setById,
    SONGS, PERSONA, VIBE_ORDER, TICKETS, SILHOUETTE
  };
})();
