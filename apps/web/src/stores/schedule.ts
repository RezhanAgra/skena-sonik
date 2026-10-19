// Set yang dipilih pengunjung. Dipakai bersama oleh Lineup, Schedule, dan VibeCheck (beda island, satu store).
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';

const KEY = 'ss26-saved';

// Mulai kosong supaya HTML dari server sama dengan render pertama di browser;
// isi dari localStorage dimuat setelah island ter-hydrate.
export const $saved = atom<string[]>([]);
let loaded = false;

function loadFromStorage() {
  if (loaded) return;
  loaded = true;
  try {
    const ids = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (Array.isArray(ids)) $saved.set(ids);
  } catch {}
  $saved.listen(ids => {
    try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch {}
  });
}

const EMPTY: string[] = [];

// Render pertama setiap island selalu kosong (sama dengan HTML server), baru setelah mount
// memakai isi store. Tanpa ini, island yang hydrate belakangan akan mismatch.
export function useSaved() {
  const ids = useStore($saved);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, []);
  return mounted ? ids : EMPTY;
}

export function toggleSaved(slug: string) {
  const ids = $saved.get();
  $saved.set(ids.includes(slug) ? ids.filter(id => id !== slug) : [...ids, slug]);
}

export function addSaved(slugs: string[]) {
  $saved.set([...new Set([...$saved.get(), ...slugs])]);
}

export function clearSaved() {
  $saved.set([]);
}
