import { useStore } from '@nanostores/react';
import { useEffect, useState } from 'react';
import { $cartCount, $cartOpen, openCart, useCart } from '../stores/cart';

export default function CartButton() {
  useCart(); // memuat isi keranjang dari localStorage
  const count = useStore($cartCount);
  const open = useStore($cartOpen);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const shown = mounted ? count : 0;

  return (
    <button
      type="button"
      id="cart-button"
      aria-label={shown ? `Buka keranjang, ${shown} tiket` : 'Buka keranjang'}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="cart-drawer"
      className="relative cursor-pointer justify-self-end border-0 bg-transparent p-1.5 text-paper"
      onClick={openCart}
    >
      <svg viewBox="0 0 24 24" className="size-6.5 fill-current" aria-hidden="true">
        <path d="M7 18a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM5.2 4l.9 2H21l-3.6 7H8.4l-.9 1.6c-.1.2-.1.3-.1.4 0 .3.2.5.5.5H19v2H7.6a2.5 2.5 0 01-2.2-3.7L6.6 12 3 4H1V2h3.3l.9 2z" />
      </svg>
      {shown > 0 && (
        <b className="absolute -top-0.5 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-flare px-1 text-[0.66rem] text-white">
          {shown}
        </b>
      )}
    </button>
  );
}
