// Titik masuk: jalankan semua fitur setelah HTML selesai dimuat.
// Urutan <script> di index.html penting: utils → data → saved → fitur → main.
(() => {
  ['hero', 'slider', 'lineup', 'schedule', 'vibe', 'tickets', 'signup'].forEach(name => {
    try {
      SS[name].init();
    } catch (err) {
      // satu fitur rusak tidak ikut mematikan fitur lain
      console.error(`Fitur "${name}" gagal dimuat:`, err);
    }
  });
})();
