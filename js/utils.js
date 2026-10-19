// Helper kecil yang dipakai semua modul. Semua modul berbagi satu namespace: window.SS
window.SS = window.SS || {};

(() => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // localStorage bisa ditolak (mode privat), jadi selalu dibungkus try/catch
  const store = {
    get(key, fallback) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
    }
  };

  const rp = n => 'Rp' + Math.round(n).toLocaleString('id-ID');
  const pad = n => String(n).padStart(2, '0');
  const toMinutes = hhmm => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  Object.assign(SS, { $, $$, store, rp, pad, toMinutes, reduceMotion });
})();
