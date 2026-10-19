# Skena Sonik Tour 2026

Web tur konser bergaya poster merah-hitam, dibangun dengan **Astro + React + Tailwind CSS** di frontend dan **Express + Prisma + PostgreSQL** di backend (PERN).

> Mockup desain: acara, harga, kota, dan tanggal fiktif. Nama musisi hanya contoh lineup.

## Struktur

```
apps/
  api/                    Express 5 + Prisma 7 (PostgreSQL)
    prisma/
      schema.prisma       model: City, Stage, Genre, Artist, Performance, Song, TicketTier, Subscriber, Order
      seed.ts             konten awal (kota, lineup, jadwal, lagu, tiket)
      migrations/         riwayat migrasi database
    src/
      server.ts           titik masuk, baca PORT
      app.ts              middleware, routing, error handler
      db.ts               Prisma Client (driver adapter pg)
      lib/pricing.ts      satu-satunya tempat harga tiket dihitung
      routes/             festival, tickets + orders, subscribers
  web/                    Astro 6 (SSR, adapter Node) + React 19 + Tailwind 4
    src/
      pages/index.astro   halaman utama, ambil data dari API tiap request
      layouts/            <head>, font, global.css
      components/         *.astro = statis, *.tsx = island interaktif
      stores/             state bersama antar island (nanostores)
      lib/                api client, tipe data, format rupiah, path SVG
      styles/global.css   token warna/font Tailwind (@theme) + komponen kecil
```

## Menjalankan

Butuh **Node.js 22.12+** dan database **PostgreSQL**.

```bash
npm install
```

Salin contoh env lalu isi `DATABASE_URL` dengan koneksi PostgreSQL-mu:

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
cp apps/web/.env.example apps/web/.env
```

Buat tabel dan isi konten awal:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

Jalankan API (port 4000) dan web (port 4321) sekaligus:

```bash
npm run dev
```

Buka http://localhost:4321.

## API

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/api/health` | cek API & koneksi database |
| GET | `/api/festival` | semua konten halaman (kota, panggung, genre, artis + jadwal, lagu, tiket) |
| POST | `/api/tickets/quote` | hitung harga `{ tier, quantity, installment }` |
| POST | `/api/orders` | simpan order demo (harga dihitung ulang di server) |
| POST | `/api/subscribers` | daftar info presale `{ email }` |

## Mengubah konten

Konten ada di database. Ubah lewat `apps/api/prisma/seed.ts` lalu jalankan `npm run db:seed`, atau edit langsung di Prisma Studio:

```bash
npm run db:studio
```

## Skrip

| Skrip | Fungsi |
| --- | --- |
| `npm run dev` | API + web dalam mode dev |
| `npm run build` | generate Prisma Client + build Astro |
| `npm run db:migrate` | buat/terapkan migrasi dari `schema.prisma` |
| `npm run db:seed` | isi ulang konten (subscriber & order tidak dihapus) |
| `npm run db:studio` | buka Prisma Studio |
