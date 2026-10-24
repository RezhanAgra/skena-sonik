# Skena Sonik Tour 2026

Web tour konser bergaya poster merah-hitam, dibangun dengan **Astro + React + Tailwind CSS** di frontend dan **Express + Prisma + PostgreSQL** di backend (PERN). Database di **Supabase**, deploy ke **VPS dengan Docker**.



## Struktur

```
apps/
  api/                    Express 5 + Prisma 7 (PostgreSQL)
    prisma/
      schema.prisma       model: City, Stage, Genre, Artist, Performance, Song, TicketTier, Subscriber, Order
      seed.ts             konten awal (kota, lineup, jadwal, lagu, tiket)
      migrations/         riwayat migrasi database
    scripts/bundle.mjs    bundle API + dependency jadi satu file dist/server.js
    src/
      server.ts           titik masuk, graceful shutdown
      config.ts           validasi environment variable
      app.ts              helmet, rate limit, routing, error handler
      db.ts               Prisma Client (driver adapter pg)
      lib/pricing.ts      satu-satunya tempat harga tiket & keranjang dihitung
      lib/orders.ts       kode pesanan, perubahan status pembayaran
      lib/payments/       Midtrans Snap + mode mock (simulasi)
      lib/tickets.ts      e-tiket: kode, QR bertanda tangan, aturan check-in per hari
      lib/email/          template e-tiket + pengirim (SMTP Gmail / mode log)
      lib/pdf/            PDF e-tiket (pdf-lib): 1 halaman A4 per tiket + syarat & ketentuan
    assets/               banner & logo untuk PDF e-tiket
      routes/             festival, tickets, checkout (keranjang, pesanan, webhook), gate, subscribers
    Dockerfile
  web/                    Astro 6 (SSR, adapter Node) + React 19 + Tailwind 4
    src/
      pages/              index, pesanan/[code], akun, dashboard, gate, gelang (booth), masuk/daftar/..., 404, robots.txt, sitemap.xml
      layouts/            <head>, SEO & Open Graph, font
      components/         *.astro = statis, *.tsx = island interaktif
      stores/             state bersama antar island (nanostores)
      lib/                api client, tipe data, format rupiah, path SVG
      styles/global.css   token warna/font Tailwind (@theme) + komponen kecil
    public/               favicon, og.png (pratinjau share), apple-touch-icon
    Dockerfile
deploy/
  Caddyfile               reverse proxy + HTTPS otomatis
  nginx.conf.example      alternatif kalau VPS sudah pakai Nginx
docker-compose.yml        migrate + api + web + caddy
.github/workflows/ci.yml  type-check, build, dan build image Docker di setiap push
```

Browser selalu memanggil API lewat path `/api` di domain yang sama. Di produksi Caddy meneruskannya ke container API; saat development, proxy Vite yang meneruskan. Jadi tidak perlu pengaturan CORS.

## Development lokal

Butuh **Node.js 22.12+**.

```bash
npm install
```

```bash
cp apps/api/.env.example apps/api/.env
```

```bash
cp apps/web/.env.example apps/web/.env
```

Isi `DATABASE_URL` dan `DIRECT_URL` di `apps/api/.env` dari Supabase (**Connect → ORMs → Prisma**), lalu buat tabel dan isi konten awal:

```bash
npm run db:migrate
```

```bash
npm run db:seed
```

```bash
npm run dev
```

Buka http://localhost:4321.

## Deploy ke VPS (Docker)

### 1. Siapkan server

- VPS Linux (Ubuntu 22.04/24.04), minimal 1 GB RAM.
- Docker + Docker Compose terpasang (`curl -fsSL https://get.docker.com | sh`).
- Domain dengan **A record** mengarah ke IP VPS (juga `www` kalau mau).
- Port **80** dan **443** terbuka di firewall.

### 2. Ambil kode dan isi konfigurasi

```bash
git clone https://github.com/RezhanAgra/skena-sonik.git
```

```bash
cd skena-sonik && cp .env.example .env
```

Edit `.env`: isi `DOMAIN`, `ACME_EMAIL`, `DATABASE_URL`, dan `DIRECT_URL`.

### 3. Jalankan

```bash
docker compose up -d --build
```

Urutan yang terjadi:
1. `migrate` menerapkan migrasi Prisma ke Supabase, lalu berhenti.
2. `api` menyala setelah migrasi sukses, dicek lewat `/api/health`.
3. `web` menyala setelah API sehat.
4. `caddy` mengambil sertifikat HTTPS otomatis dan melayani `https://DOMAIN`.

Kalau database masih kosong, isi konten awal sekali saja:

```bash
docker compose run --rm migrate npx prisma db seed
```

### 4. Perintah sehari-hari

| Keperluan | Perintah |
| --- | --- |
| Lihat status | `docker compose ps` |
| Lihat log | `docker compose logs -f api web` |
| Update ke versi terbaru | `git pull && docker compose up -d --build` |
| Restart | `docker compose restart api web` |
| Matikan | `docker compose down` |

Sudah memakai Nginx di VPS? Lihat `deploy/nginx.conf.example`.

## Keranjang & pembayaran (Midtrans)

Alur belanja:
1. Pengunjung memilih tiket, lalu klik **Masukkan ke keranjang**. Keranjang tersimpan di browser.
2. Ikon keranjang di header membuka laci keranjang: ubah jumlah, lalu klik **Lanjut**, isi data pembeli, dan klik **Bayar**.
3. API membuat pesanan `PENDING` dengan harga yang dihitung ulang di server, lalu meminta token ke Midtrans.
4. Popup **Midtrans Snap** terbuka (QRIS, GoPay, ShopeePay, VA bank, kartu).
5. Midtrans mengirim notifikasi ke `/api/payments/midtrans/notification`. API memverifikasi signature dan nominal, lalu mengubah status pesanan.
6. Pembeli diarahkan ke `/pesanan/KODE`. Halaman itu ikut berubah otomatis saat status jadi **Lunas**.

### Mode pembayaran

| `PAYMENT_PROVIDER` | Untuk | Keterangan |
| --- | --- | --- |
| `mock` | development & demo | tanpa gateway; halaman pesanan menampilkan tombol "Simulasikan bayar". Ditolak di produksi kecuali `ALLOW_MOCK_PAYMENTS=true`. |
| `midtrans` | sandbox & produksi | butuh `MIDTRANS_SERVER_KEY` dan `MIDTRANS_CLIENT_KEY` |

### Menyambungkan Midtrans

1. Daftar di **dashboard.sandbox.midtrans.com** (sandbox, gratis).
2. Buka **Settings → Access Keys**, lalu salin **Server Key** dan **Client Key** ke `.env`:
   ```env
   PAYMENT_PROVIDER=midtrans
   MIDTRANS_SERVER_KEY=SB-Mid-server-xxxx
   MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxx
   MIDTRANS_IS_PRODUCTION=false
   ```
3. Buka **Settings → Payment → Notification URL**, lalu isi:
   ```
   https://DOMAINMU/api/payments/midtrans/notification
   ```
   Di localhost notifikasi tidak bisa sampai, tapi halaman pesanan tetap menanyakan status langsung ke Midtrans setiap beberapa detik.
4. Tes pembayaran sandbox memakai simulator di **simulator.sandbox.midtrans.com** (QRIS, GoPay, VA). Kartu tes: `4811 1111 1111 1114`, CVV `123`, OTP `112233`.
5. Untuk menerima uang sungguhan, aktifkan akun produksi Midtrans, ganti key ke key produksi, lalu set `MIDTRANS_IS_PRODUCTION=true`.

> **Server Key bersifat rahasia.** Simpan hanya di `.env` server, jangan di-commit, dan jangan dimasukkan ke kode web.

## E-tiket & akses masuk (QR)

Begitu pesanan **lunas**:
1. API menerbitkan **satu e-tiket per orang**, masing-masing dengan kode unik `TKT-XXXX-XXXX`.
2. Setiap tiket punya **QR bertanda tangan** (HMAC dengan `TICKET_SECRET`). QR tidak bisa dibuat-buat hanya dengan menebak kode tiket.
3. E-tiket dikirim ke **email pembeli** dengan QR sebagai gambar inline, sehingga tampil di Gmail tanpa perlu klik "tampilkan gambar".
4. Email juga membawa lampiran **PDF e-tiket** (`E-tiket-KODE.pdf`).
5. Halaman `/pesanan/KODE` menampilkan kartu e-tiket yang sama dengan PDF, tombol **Download PDF** per tiket, **Download semua tiket**, dan **Kirim ulang e-tiket** (maksimal 3× per 10 menit).

### PDF e-tiket

Setiap tiket mendapat satu halaman A4. Isinya:
- **Header:** logo dan tulisan E-TIKET.
- **Banner** dan nama acara.
- **Lokasi, Tanggal, dan Waktu**, dengan label dua bahasa.
- **ID Pesanan, Nama, dan Kategori Tiket.**
- **QR, kode tiket, dan "Tiket X dari N".**
- **Footer** kontak (dari `EMAIL_FROM` dan `SITE_URL`).

Halaman terakhir berisi Syarat & Ketentuan. Isi acara dan syarat diatur di `apps/api/src/lib/event.ts`. Gambar banner dan logo ada di `apps/api/assets/`; ganti filenya untuk mengubah tampilan PDF.

### Aturan masuk gerbang

| Tiket | Berlaku | Keterangan |
| --- | --- | --- |
| 2-Day Pass, Pit Pass | Sabtu **dan** Minggu | maksimal 1× masuk per hari |
| Daily Pass | **1 hari pilihan** | hari pertama dipindai menjadi harinya |

Jumlah hari diatur lewat kolom `daysAccess` di tabel `TicketTier`.

### Scanner petugas (`/gate`)

1. Isi `GATE_TOKEN` (PIN petugas) di konfigurasi API.
2. Petugas membuka `https://DOMAIN/gate` di HP, memasukkan PIN, memilih hari dan nama gerbang, lalu menyalakan kamera.
3. Hasil pindaian tampil besar: **hijau** (silakan masuk), **kuning** (sudah dipakai / bukan untuk hari ini), **merah** (tidak valid), disertai getar dan bunyi.
4. Kalau QR rusak, kode `TKT-…` bisa diketik manual.
5. Beberapa gerbang bisa jalan bersamaan; satu tiket tidak bisa masuk dua kali di hari yang sama walaupun dipindai serentak.

Kamera hanya bisa dibuka lewat **HTTPS** (atau localhost).

### Email lewat Gmail

1. Pakai akun Gmail khusus, misalnya `skenasonik.tiket@gmail.com`.
2. Aktifkan **Verifikasi 2 Langkah** di akun itu.
3. Buat **App Password** di **myaccount.google.com/apppasswords**. Hasilnya 16 huruf; tulis tanpa spasi.
4. Isi `.env`:
   ```env
   EMAIL_PROVIDER=smtp
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=465
   SMTP_USER=skenasonik.tiket@gmail.com
   SMTP_PASS=abcdefghijklmnop
   EMAIL_FROM=Skena Sonik <skenasonik.tiket@gmail.com>
   ```
5. Saat API start, login SMTP langsung dicek. Kalau password salah, log menampilkan `SMTP gagal login`.

Gmail biasa dibatasi sekitar **500 email per hari**. Untuk penjualan besar, ganti `SMTP_*` ke layanan email transaksional (Brevo, Mailgun, Amazon SES, dan sebagainya); kodenya tidak perlu diubah.

Saat development, `EMAIL_PROVIDER=log` tidak mengirim apa pun. Setiap email disimpan sebagai file HTML di `apps/api/tmp/emails/` supaya bisa dibuka di browser.

## Akun: penonton, petugas, penyelenggara

| Peran | Bisa apa | Cara dapat |
| --- | --- | --- |
| Penonton | `/akun`: Tiket saya, profil, ganti password; checkout terisi otomatis | daftar di `/daftar` |
| Petugas gerbang | + scanner `/gate` tanpa PIN | ditambahkan penyelenggara di Dasbor → Tim |
| Penyelenggara | + `/dashboard`: penjualan, pesanan, kirim ulang e-tiket, kelola tim | email ada di `ORGANIZER_EMAILS` |

**Membuat akun penyelenggara pertama** (tidak ada akun/password bawaan):
1. Isi `ORGANIZER_EMAILS=emailmu@gmail.com` di `apps/api/.env` (atau `.env` root untuk Docker), lalu restart API.
2. Daftar di `/daftar` dengan email itu dan password pilihanmu.
3. Klik link verifikasi yang dikirim ke email itu. Akun otomatis menjadi penyelenggara, lalu buka `/dashboard`.

Pesanan yang dibeli tanpa login muncul di **Tiket saya** setelah email akun yang sama diverifikasi. Lupa password: `/lupa-password` (link berlaku 1 jam).

## Penukaran gelang (booth)

Di hari acara, penonton menukar e-tiket dengan **gelang fisik** di booth penukaran. Gelang inilah yang dipakai untuk masuk.

1. Petugas (akun **STAFF** atau **ORGANIZER**) membuka `/gelang`, mengisi nama booth, hari, dan jenis printer.
2. QR e-tiket dipindai dengan kamera (atau kodenya diketik), lalu sistem mengecek pesanan lunas dan status penukaran tiket.
3. Petugas klik **Cetak gelang**. Dialog cetak terbuka dengan ukuran:
   - **Gelang thermal 25,4 × 254 mm** (printer gelang seperti Zebra/TSC; atur driver ke ukuran ini), atau
   - **Kertas A4 landscape** berwarna, untuk digunting.
4. Gelang berisi jenis tiket, nama, hari berlaku, **QR gelang** (bertanda tangan HMAC), dan kode `WB-XXXX-XXXX`.
   Warna per jenis tiket (stok gelang yang dipasang di printer): 2-Day **Merah**, Daily **Kuning**, Pit **Ungu**, Early Bird **Biru**. Warnanya diatur di `apps/web/src/components/wristband/WristbandPrint.tsx`.

Aturan:
- **Satu tiket, satu gelang aktif.** E-tiket yang sudah ditukar tidak bisa ditukar lagi.
- **Cetak ulang** (gelang rusak/hilang) wajib disertai alasan. Gelang lama otomatis **tidak berlaku** di gerbang.
- **Daily Pass:** gelang hanya berlaku di hari penukaran. **2-Day/Pit:** berlaku Sabtu & Minggu.
- Di `/gate`, QR gelang dan QR e-tiket sama-sama bisa dipindai, dengan aturan 1× masuk per hari.
- Dua booth yang memindai tiket yang sama bersamaan tidak bisa mencetak dua gelang, karena baris tiket dikunci di database.

## Environment variable

| Variabel | Dipakai | Keterangan |
| --- | --- | --- |
| `DATABASE_URL` | api | Supabase transaction pooler (port 6543, `?pgbouncer=true`) |
| `DIRECT_URL` | migrasi | Supabase session pooler / direct (port 5432) |
| `API_PORT` | api | port API saat development (default 4000) |
| `PORT` | api, web | port di produksi/Docker: 4000 (api) dan 4321 (web) |
| `TRUST_PROXY` | api | jumlah proxy di depan API, `1` di belakang Caddy/Nginx |
| `CORS_ORIGIN` | api | opsional, hanya kalau API di domain berbeda |
| `API_URL` | web | alamat API untuk SSR, dibaca saat runtime |
| `SITE_URL` | web (build) | URL publik untuk canonical, Open Graph, sitemap |
| `SITE_URL` | api | URL web, tujuan kembali setelah bayar |
| `PAYMENT_PROVIDER` | api | `midtrans` atau `mock` |
| `MIDTRANS_SERVER_KEY`, `MIDTRANS_CLIENT_KEY` | api | key dari dashboard Midtrans |
| `MIDTRANS_IS_PRODUCTION` | api | `false` = sandbox, `true` = uang sungguhan |
| `TICKET_SECRET` | api | kunci tanda tangan QR, wajib di produksi (`openssl rand -hex 32`) |
| `GATE_TOKEN` | api | PIN petugas untuk `/gate`; kosong = scanner nonaktif |
| `EMAIL_PROVIDER` | api | `smtp` (kirim sungguhan) atau `log` (simpan file HTML) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | api | akun pengirim email e-tiket |
| `DATABASE_POOL_MAX` | api | koneksi database maksimum per proses (default 10) |
| `ORGANIZER_EMAILS` | api | email penyelenggara (aktif setelah email diverifikasi) |
| `SESSION_DAYS` | api | lama sesi login, default 30 hari |
| `DOMAIN`, `ACME_EMAIL` | docker-compose | domain situs dan email sertifikat HTTPS |

## API

| Method | Endpoint | Fungsi | Batas |
| --- | --- | --- | --- |
| GET | `/api/health` | cek API & koneksi database | – |
| GET | `/api/festival` | semua konten halaman | – |
| POST | `/api/tickets/quote` | hitung harga satu jenis tiket (kalkulator patungan) | 120/menit |
| POST | `/api/cart/quote` | hitung harga keranjang `{ items: [{ tier, quantity }] }` | 120/menit |
| POST | `/api/checkout` | buat pesanan + sesi pembayaran `{ items, buyer: { name, email, phone } }` | 10/menit |
| GET | `/api/orders/:code` | status & rincian pesanan | 60/menit |
| POST | `/api/payments/midtrans/notification` | webhook Midtrans (signature diverifikasi) | – |
| POST | `/api/payments/mock/:code` | simulasi hasil bayar (hanya mode `mock`) | – |
| POST | `/api/orders/:code/resend-tickets` | kirim ulang e-tiket ke email pembeli | 3/10 menit |
| GET | `/api/orders/:code/tickets.pdf` | download PDF e-tiket (semua, atau `?ticket=TKT-…` untuk satu) | 60/menit |
| GET | `/api/gate/me` | cek PIN petugas (header `Authorization: Bearer GATE_TOKEN`) | 600/menit |
| POST | `/api/gate/check-in` | check-in tiket `{ qr, day, gate }` | 600/menit |
| POST | `/api/wristbands/lookup` | cek e-tiket di booth `{ qr }` (STAFF/ORGANIZER) | 600/menit |
| POST | `/api/wristbands` | terbitkan / cetak ulang gelang `{ ticketCode, day, booth?, reprint?, reason? }` | 600/menit |
| GET | `/api/wristbands/stats` | jumlah gelang aktif & cetak ulang | 600/menit |
| GET | `/api/gate/stats` | jumlah tiket terbit & yang sudah masuk per hari | 600/menit |
| POST | `/api/subscribers` | daftar info presale `{ email }` | 5/menit |

## Mengubah konten

Konten ada di database. Ubah lewat `apps/api/prisma/seed.ts` lalu jalankan `npm run db:seed`, edit di **Table Editor** Supabase, atau pakai Prisma Studio:

```bash
npm run db:studio
```

## Skrip

| Skrip | Fungsi |
| --- | --- |
| `npm run dev` | API + web dalam mode dev |
| `npm run build` | bundle API + build Astro untuk produksi |
| `npm start` | jalankan hasil build tanpa Docker |
| `npm run typecheck` | cek tipe TypeScript API & web |
| `npm run db:migrate` | buat migrasi baru dari `schema.prisma` (development) |
| `npm run db:deploy` | terapkan migrasi yang sudah ada (produksi) |
| `npm run db:seed` | isi ulang konten (subscriber & order tidak dihapus) |
| `npm run db:studio` | buka Prisma Studio |
