// Kartu lineup + filter genre. Tombol "+ Jadwal" menyimpan set lewat SS.saved
(() => {
  const { $, $$ } = SS;
  const { ARTISTS, setById, DAYS, STAGES, VIBE_LABEL } = SS.data;

  function cardHTML(a) {
    const s = setById[a.id];
    return `
      <article class="artist${a.head ? ' head' : ''}" data-v="${a.vibe}">
        <div class="row">
          <span class="tag">${VIBE_LABEL[a.vibe]}</span>
          <span class="when">${DAYS[s.day]} · ${s.start}<br>${STAGES[s.stage]}</span>
        </div>
        <h3>${a.name}</h3>
        <p class="bio">${a.bio}</p>
        <div class="row" style="align-items:center">
          <span class="when">${s.b - s.a} menit</span>
          <button type="button" class="save" data-id="${a.id}" aria-pressed="false">+ Jadwal</button>
        </div>
      </article>`;
  }

  function syncButtons() {
    $$('#lineup-grid .save').forEach(btn => {
      const on = SS.saved.has(btn.dataset.id);
      btn.setAttribute('aria-pressed', on);
      btn.textContent = on ? '✓ Di jadwal' : '+ Jadwal';
    });
  }

  function filterBy(vibe) {
    $$('#filters button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === vibe));
    $$('#lineup-grid .artist').forEach(card => {
      card.hidden = !(vibe === 'all' || card.dataset.v === vibe);
    });
  }

  SS.lineup = {
    init() {
      const grid = $('#lineup-grid');
      grid.innerHTML = ARTISTS.map(cardHTML).join('');
      grid.addEventListener('click', e => {
        const btn = e.target.closest('.save');
        if (btn) SS.saved.toggle(btn.dataset.id);
      });
      $('#filters').addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (btn) filterBy(btn.dataset.v);
      });
      SS.saved.onChange(syncButtons);
      syncButtons();
    }
  };
})();
