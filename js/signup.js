// Form daftar info presale (demo: email tidak dikirim ke mana pun)
(() => {
  const { $ } = SS;

  SS.signup = {
    init() {
      $('#signup').addEventListener('submit', e => {
        e.preventDefault();
        $('#signup-msg').textContent = 'Format email sudah benar. Ini halaman demo, jadi email tidak dikirim ke mana pun.';
      });
    }
  };
})();
