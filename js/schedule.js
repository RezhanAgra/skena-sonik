// Clash finder: jadwal per panggung + panel "Jadwalmu"
(() => {
  const { $, $$ } = SS;
  const { SETS, STAGES, DAYS, artistById } = SS.data;
  let day = 1;

  function setHTML(s) {
    const on = SS.saved.has(s.id);
    const clashes = on ? SS.saved.clashesOf(s.id) : [];
    const flag = clashes.length
      ? `<span class="flag">Bentrok dengan ${clashes.map(id => artistById[id].name).join(', ')}</span>`
      : '';
    return `
      <button type="button" class="set${clashes.length ? ' clash' : ''}" data-id="${s.id}" aria-pressed="${on}">
        <span class="t">${s.start}–${s.end}</span>
        <span class="n">${artistById[s.id].name}</span>
        ${flag}
      </button>`;
  }

  function renderStages() {
    $('#stages').innerHTML = STAGES.map((name, i) => {
      const sets = SETS.filter(s => s.day === day && s.stage === i).sort((x, y) => x.a - y.a);
      return `<div class="stage"><h4>${name}</h4>${sets.map(setHTML).join('')}</div>`;
    }).join('');
  }

  function renderMine() {
    const list = SS.saved.list();
    const clashCount = list.filter(s => SS.saved.clashesOf(s.id).length).length;
    const minutes = list.reduce((sum, s) => sum + s.b - s.a, 0);

    $('#mine-title').textContent = list.length ? `${list.length} set dipilih` : 'Belum ada set';
    $('#mine-empty').hidden = list.length > 0;
    $('#mine-clear').hidden = list.length === 0;
    $('#mine-list').innerHTML = list.map(s => `
      <li class="${SS.saved.clashesOf(s.id).length ? 'clash' : ''}">
        <span class="d">${DAYS[s.day]}</span>
        <span class="n">${artistById[s.id].name}</span>
        <span class="t">${s.start}–${s.end} · ${STAGES[s.stage]}</span>
      </li>`).join('');
    $('#mine-stat').textContent = list.length
      ? `${Math.floor(minutes / 60)} jam ${minutes % 60} menit musik · ${clashCount ? clashCount + ' set bentrok' : 'tidak ada yang bentrok'}`
      : '';
  }

  function render() { renderStages(); renderMine(); }

  SS.schedule = {
    init() {
      $('#stages').addEventListener('click', e => {
        const btn = e.target.closest('.set');
        if (btn) SS.saved.toggle(btn.dataset.id);
      });
      $$('.tabs button').forEach(tab => tab.addEventListener('click', () => {
        day = +tab.dataset.day;
        $$('.tabs button').forEach(t => t.setAttribute('aria-selected', t === tab));
        renderStages();
      }));
      $('#mine-clear').addEventListener('click', () => SS.saved.clear());
      SS.saved.onChange(render);
      render();
    }
  };
})();
