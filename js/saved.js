// Daftar set yang dipilih pengunjung. Dipakai bersama oleh lineup, jadwal, dan vibe check.
// Modul lain berlangganan lewat SS.saved.onChange(fn) supaya tampilannya ikut diperbarui.
(() => {
  const KEY = 'ss26-saved';
  const { setById } = SS.data;
  const ids = new Set(SS.store.get(KEY, []).filter(id => setById[id]));
  const listeners = [];

  const emit = () => { SS.store.set(KEY, [...ids]); listeners.forEach(fn => fn()); };

  // set lain yang dipilih dan jamnya tumpang tindih di hari yang sama
  const clashesOf = id => {
    const x = setById[id];
    return [...ids].filter(o => o !== id && setById[o].day === x.day && setById[o].a < x.b && x.a < setById[o].b);
  };

  SS.saved = {
    has: id => ids.has(id),
    list: () => [...ids].map(id => setById[id]).sort((x, y) => x.day - y.day || x.a - y.a),
    clashesOf,
    toggle(id) { ids.has(id) ? ids.delete(id) : ids.add(id); emit(); },
    addMany(list) { list.forEach(id => ids.add(id)); emit(); },
    clear() { ids.clear(); emit(); },
    onChange(fn) { listeners.push(fn); }
  };
})();
