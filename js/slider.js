// Slider 3 lagu + animasi layar LED di belakangnya
(() => {
  const { $, $$, reduceMotion } = SS;
  const { SONGS, VIBE_LABEL, SILHOUETTE } = SS.data;
  const DURATION = 7000; // ms per slide

  let current = 0;
  let timer = null;
  let paused = false;

  /* ---------- slider ---------- */
  const enc = encodeURIComponent;

  function slideHTML(song, i) {
    const query = enc(`${song.band} ${song.title}`);
    return `
      <div class="slide" role="group" aria-roledescription="slide" aria-label="${i + 1} dari ${SONGS.length}">
        <span class="meta">Lagu ${i + 1} / ${SONGS.length} · ${VIBE_LABEL[song.vibe]} · tampil ${song.when}</span>
        <h3>${song.title}</h3>
        <span class="band">${song.band}</span>
        <div class="links">
          <a class="btn red" href="https://open.spotify.com/search/${query}" target="_blank" rel="noopener">▶ Dengar di Spotify</a>
          <a class="btn" href="https://www.youtube.com/results?search_query=${query}" target="_blank" rel="noopener">Tonton di YouTube</a>
        </div>
      </div>`;
  }

  function show(i) {
    current = (i + SONGS.length) % SONGS.length;
    $('#slides').innerHTML = slideHTML(SONGS[current], current);
    $$('#dots button').forEach((btn, k) => {
      btn.setAttribute('aria-selected', k === current);
      if (k === current) { // ulang animasi garis progres
        btn.style.animation = 'none';
        void btn.offsetWidth;
        btn.style.animation = '';
      }
    });
    scheduleNext();
  }

  function scheduleNext() {
    clearTimeout(timer);
    if (!reduceMotion && !paused) timer = setTimeout(() => show(current + 1), DURATION);
  }

  function setPaused(value) {
    paused = value;
    $('#dots').classList.toggle('paused', value);
    scheduleNext();
  }

  function bindSlider() {
    const dots = $('#dots');
    dots.style.setProperty('--dur', DURATION / 1000 + 's');
    dots.innerHTML = SONGS.map((s, i) =>
      `<button type="button" role="tab" data-i="${i}" aria-selected="false" aria-label="${s.title} oleh ${s.band}">${s.band}</button>`
    ).join('');
    dots.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (btn) show(+btn.dataset.i);
    });

    $('#prev').addEventListener('click', () => show(current - 1));
    $('#next').addEventListener('click', () => show(current + 1));

    const box = $('#slider');
    box.addEventListener('mouseenter', () => setPaused(true));
    box.addEventListener('mouseleave', () => setPaused(false));
    box.addEventListener('focusin', () => setPaused(true));
    box.addEventListener('focusout', () => setPaused(false));
    box.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') show(current - 1);
      if (e.key === 'ArrowRight') show(current + 1);
    });

    // geser di layar sentuh
    let startX = null;
    box.addEventListener('pointerdown', e => { startX = e.clientX; });
    box.addEventListener('pointerup', e => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1));
    });
  }

  /* ---------- layar LED ---------- */
  const COLS = 40;
  const ROWS = 18;
  const levels = new Array(COLS).fill(0);
  const silhouette = new Path2D(SILHOUETTE);
  let canvas, ctx, W = 0, H = 0, clock = 0, last = 0;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    W = r.width; H = r.height;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function draw(time) {
    clock += (time - (last || time)) * SONGS[current].speed;
    last = time;
    const beat = Math.pow(Math.max(0, Math.sin(clock / 300)), 6);

    // tinggi tiap kolom equalizer
    for (let i = 0; i < COLS; i++) {
      const target = .22 + .16 * Math.sin(clock / 700 + i * .4) + .1 * Math.sin(clock / 260 + i * 1.3)
        + beat * .25 * (1 - Math.abs(i - COLS / 2) / COLS);
      levels[i] += (target - levels[i]) * .3;
    }

    // latar + cahaya merah
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, W, H);
    const sx = W * .14, sw = W * .72, sy = H * .08, sh = H * .5;
    const glow = ctx.createRadialGradient(W / 2, sy + sh / 2, 10, W / 2, sy + sh / 2, W * .6);
    glow.addColorStop(0, `rgba(255,31,31,${.3 + beat * .25})`);
    glow.addColorStop(1, 'rgba(255,31,31,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // panel LED
    ctx.fillStyle = '#1a0000';
    ctx.fillRect(sx, sy, sw, sh);
    const cw = sw / COLS, rh = sh / ROWS;
    for (let i = 0; i < COLS; i++) {
      const lit = Math.round(levels[i] * ROWS);
      for (let r = 0; r < ROWS; r++) {
        const on = r < lit;
        const a = on ? .55 + (r / ROWS) * .45 : .07;
        ctx.fillStyle = on && r > ROWS * .8 ? `rgba(255,220,210,${a})` : `rgba(255,31,31,${a})`;
        ctx.fillRect(sx + i * cw + 1, sy + sh - (r + 1) * rh + 1, cw - 2, rh - 2);
      }
    }

    // lantai panggung + siluet
    const fy = H * .66;
    const floor = ctx.createLinearGradient(0, fy, 0, H);
    floor.addColorStop(0, '#3a0000');
    floor.addColorStop(1, '#050505');
    ctx.fillStyle = floor;
    ctx.fillRect(0, fy, W, H - fy);
    const sH = H * .5, scale = sH / 420;
    ctx.save();
    ctx.translate(W / 2 - 100 * scale, fy + 8 - sH);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#000';
    ctx.fill(silhouette);
    ctx.restore();

    if (!reduceMotion) requestAnimationFrame(draw);
  }

  function startScreen() {
    canvas = $('#viz');
    ctx = canvas.getContext('2d');
    resize();
    addEventListener('resize', () => { resize(); if (reduceMotion) requestAnimationFrame(draw); });
    requestAnimationFrame(draw);
  }

  SS.slider = {
    init() { bindSlider(); startScreen(); show(0); }
  };
})();
