// Hero: teks berjalan di pita, kartu kota tur, dan hitung mundur ke grand finale
(() => {
  const { $, pad } = SS;
  const { TAPES, CITIES, CITY_STATUS, SKYLINE, EVENT_START } = SS.data;

  function renderTapes() {
    ['#tape1', '#tape2'].forEach((sel, i) => {
      const one = TAPES[i].map(text => `<span>${text}</span>`).join('');
      $(sel).innerHTML = one.repeat(4); // diulang supaya animasi geser terlihat tanpa jeda
    });
  }

  function renderCities() {
    $('#city-row').innerHTML = CITIES.map(c => {
      const label = CITY_STATUS[c.status];
      const action = c.status === 'live'
        ? `<a class="status live" href="#tiket">${label}</a>`
        : `<span class="status ${c.status}">${label}</span>`;
      return `
        <article class="city${c.status === 'live' ? ' final' : ''}">
          <div class="ph" aria-hidden="true">
            <svg viewBox="0 0 140 120" preserveAspectRatio="none"><path d="${SKYLINE[c.code]}"/></svg>
            <b>${c.code}</b>
          </div>
          <div class="info">
            <span class="nm">${c.name}</span>
            <span class="dt">${c.date}</span>
            ${action}
          </div>
        </article>`;
    }).join('');
  }

  function startCountdown() {
    const target = new Date(EVENT_START).getTime();
    const tick = () => {
      const s = Math.max(0, target - Date.now()) / 1000;
      $('#cd-d').textContent = Math.floor(s / 86400);
      $('#cd-h').textContent = pad(Math.floor(s % 86400 / 3600));
      $('#cd-m').textContent = pad(Math.floor(s % 3600 / 60));
      $('#cd-s').textContent = pad(Math.floor(s % 60));
    };
    tick();
    setInterval(tick, 1000);
  }

  SS.hero = {
    init() { renderTapes(); renderCities(); startCountdown(); }
  };
})();
