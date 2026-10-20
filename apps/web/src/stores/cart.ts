// Isi keranjang (disimpan di localStorage) + status laci keranjang terbuka/tertutup.
// Dipakai oleh CartButton (header), Tickets, CartDrawer, dan OrderStatus.
import { atom, computed } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import type { CartItem } from '../lib/types';

const KEY = 'ss26-cart';
const LAST_ORDER_KEY = 'ss26-last-order';
export const MAX_TICKETS = 10;

export const $cart = atom<CartItem[]>([]);
export const $cartOpen = atom(false);
export const $cartCount = computed($cart, items => items.reduce((n, i) => n + i.quantity, 0));

let loaded = false;
function loadFromStorage() {
  if (loaded) return;
  loaded = true;
  try {
    const items = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (Array.isArray(items)) $cart.set(items.filter(i => typeof i?.tier === 'string' && i.quantity > 0));
  } catch {}
  $cart.listen(items => {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
  });
}

const EMPTY: CartItem[] = [];

// Render pertama selalu kosong (sama dengan HTML server), isi localStorage dimuat setelah mount
export function useCart() {
  const items = useStore($cart);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    loadFromStorage();
    setMounted(true);
  }, []);
  return mounted ? items : EMPTY;
}

/** Tambah tiket. Mengembalikan jumlah yang benar-benar masuk (dibatasi MAX_TICKETS per pesanan). */
export function addToCart(tier: string, quantity: number) {
  loadFromStorage();
  const items = $cart.get();
  const room = MAX_TICKETS - items.reduce((n, i) => n + i.quantity, 0);
  const added = Math.max(0, Math.min(quantity, room));
  if (!added) return 0;
  const existing = items.find(i => i.tier === tier);
  $cart.set(existing
    ? items.map(i => (i.tier === tier ? { ...i, quantity: i.quantity + added } : i))
    : [...items, { tier, quantity: added }]);
  return added;
}

export function setQuantity(tier: string, quantity: number) {
  const items = $cart.get();
  const others = items.filter(i => i.tier !== tier).reduce((n, i) => n + i.quantity, 0);
  const q = Math.max(0, Math.min(quantity, MAX_TICKETS - others));
  $cart.set(q ? items.map(i => (i.tier === tier ? { ...i, quantity: q } : i)) : items.filter(i => i.tier !== tier));
}

export const removeFromCart = (tier: string) => $cart.set($cart.get().filter(i => i.tier !== tier));
export const clearCart = () => $cart.set([]);
export const openCart = () => $cartOpen.set(true);
export const closeCart = () => $cartOpen.set(false);

// kode pesanan terakhir dari browser ini, supaya keranjang dikosongkan setelah pesanan itu lunas
export function rememberOrder(code: string) {
  try { localStorage.setItem(LAST_ORDER_KEY, code); } catch {}
}
export function clearCartIfPaid(code: string) {
  try {
    if (localStorage.getItem(LAST_ORDER_KEY) !== code) return;
    localStorage.removeItem(LAST_ORDER_KEY);
    localStorage.setItem(KEY, '[]');
  } catch {}
  $cart.set([]);
}
