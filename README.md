# Skena Sonik Tour 2026

Mockup web tur konser bergaya poster merah-hitam. Tidak butuh build tool: buka `index.html` lewat Live Server di VS Code, atau langsung di browser.

## Struktur

```
index.html          markup halaman
css/
  base.css          token warna & font, reset, tipografi, tombol
  layout.css        header, hero, kartu kota, slider lagu, kartu about
  sections.css      lineup, jadwal, vibe check, tiket, signup, FAQ, footer
js/
  utils.js          helper ($, localStorage aman, format rupiah)
  data.js           SEMUA konten: kota, lineup, jadwal, lagu, persona, harga
  saved.js          daftar set pilihan pengunjung (dipakai lineup & jadwal)
  hero.js           pita berjalan, kartu kota, hitung mundur
  slider.js         slider 3 lagu + animasi layar LED
  lineup.js         kartu musisi + filter genre
  schedule.js       clash finder & panel "Jadwalmu"
  vibe.js           kuis vibe check & kartu akses
  tickets.js        pilihan tiket, kalkulator patungan, keranjang
  signup.js         form daftar info presale
  main.js           menjalankan semua fitur
```

## Mengubah konten

Hampir semua teks yang sering diganti ada di `js/data.js`: daftar musisi (`ARTISTS`), jam tampil (`SETS`), lagu di slider (`SONGS`), kota tur (`CITIES`), dan harga tiket (`TICKETS`).

## Catatan

- Urutan `<script>` di `index.html` penting: `utils` → `data` → `saved` → fitur → `main`.
- Jangan hapus tag penutup `</body>`. Tanpa tag itu, Live Server menyisipkan script auto-reload di setiap `</svg>` dan halaman terpotong.
- Ini mockup: acara, harga, dan tanggal fiktif. Nama musisi hanya contoh lineup.
