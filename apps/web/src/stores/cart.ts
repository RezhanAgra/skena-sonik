// Jumlah tiket di keranjang, ditampilkan di header dan diisi dari Tickets
import { atom } from 'nanostores';

export const $cartCount = atom(0);

export const addToCart = (quantity: number) => $cartCount.set($cartCount.get() + quantity);
