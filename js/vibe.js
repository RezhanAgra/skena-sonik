// Vibe check: 3 pertanyaan → persona + kartu akses + rekomendasi musisi
(() => {
  const { $ } = SS;
  const { PERSONA, VIBE_ORDER, ARTISTS, artistById } = SS.data;
  const passId = 'SKN-26-' + Math.floor(1000 + Math.random() * 9000);
  let picks = [];

  // genre dengan jawaban terbanyak; kalau seri, jawaban pertanyaan pertama yang menang
  function topVibe(form) {
    const score = Object.fromEntries(VIBE_ORDER.map(v => [v, 0]));
    ['q1', 'q2', 'q3'].forEach(q => { const v = form.get(q); if (v) score[v]++; });
    return VIBE_ORDER.reduce((best, v) => score[v] > score[best] ? v : best, form.get('q1') || VIBE_ORDER[0]);
  }

  function render() {
    const vibe = topVibe(new FormData($('#quiz')));
    const p = PERSONA[vibe];
    picks = ARTISTS.filter(a => a.vibe === vibe).map(a => a.id);

    $('#pass-persona').textContent = p.name;
    $('#pass-desc').textContent = p.desc;
    $('#pass-stage').textContent = 'Panggung: ' + p.stage;
    $('#pass-holder').textContent = $('#pass-name').value.trim() || 'Bestie Anonim';
    $('#pass-id').textContent = passId;
    $('#pass-picks').innerHTML = picks.map(id => `<span>${artistById[id].name}</span>`).join('');
  }

  SS.vibe = {
    init() {
      $('#quiz').addEventListener('input', render);
      $('#quiz').addEventListener('submit', e => e.preventDefault());
      $('#add-picks').addEventListener('click', e => {
        const btn = e.currentTarget;
        SS.saved.addMany(picks);
        btn.textContent = '✓ Masuk jadwal';
        setTimeout(() => { btn.textContent = '+ Masukkan rekomendasi ke jadwal'; }, 1800);
      });
      render();
    }
  };
})();
