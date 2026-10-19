import { useStore } from '@nanostores/react';
import { $cartCount } from '../stores/cart';

export default function CartButton() {
  const count = useStore($cartCount);

  return (
    <button
      type="button"
      aria-label={count ? `Keranjang tiket, ${count} tiket` : 'Keranjang tiket'}
      className="relative cursor-pointer justify-self-end border-0 bg-transparent p-1.5 text-paper"
      onClick={() => document.getElementById('tiket')?.scrollIntoView({ behavior: 'smooth' })}
    >
      <svg viewBox="0 0 24 24" className="size-6.5 fill-current">
        <path d="M7 18a2 2 0 100 4 2 2 0 000-4zm10 0a2 2 0 100 4 2 2 0 000-4zM5.2 4l.9 2H21l-3.6 7H8.4l-.9 1.6c-.1.2-.1.3-.1.4 0 .3.2.5.5.5H19v2H7.6a2.5 2.5 0 01-2.2-3.7L6.6 12 3 4H1V2h3.3l.9 2z" />
      </svg>
      {count > 0 && (
        <b className="absolute -top-0.5 -right-1 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-flare px-1 text-[0.66rem] text-white">
          {count}
        </b>
      )}
    </button>
  );
}
