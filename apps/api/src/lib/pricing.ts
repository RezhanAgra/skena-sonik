// Satu-satunya tempat harga dihitung. Web memanggil /api/tickets/quote, order memakai fungsi yang sama.
import type { TicketTier } from '../generated/prisma/client.ts';

export const PRICING = {
  feePerTicket: 15000,
  maxQuantity: 10,
  installments: 3
} as const;

export class PricingError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export function quote(tier: TicketTier, quantity: number, installment: boolean) {
  if (tier.soldOut) throw new PricingError(`${tier.name} sudah habis.`);
  if (quantity < 1 || quantity > PRICING.maxQuantity) {
    throw new PricingError(`Jumlah tiket harus 1–${PRICING.maxQuantity}.`);
  }

  const squadDeal = tier.squadPrice != null && tier.squadMin != null && quantity >= tier.squadMin;
  const unitPrice = squadDeal ? tier.squadPrice! : tier.price;
  const subtotal = unitPrice * quantity;
  const fee = PRICING.feePerTicket * quantity;
  const total = subtotal + fee;
  const perPerson = total / quantity;

  return {
    tier: tier.slug,
    tierName: tier.name,
    quantity,
    installment,
    unitPrice,
    subtotal,
    fee,
    total,
    perPerson: Math.round(perPerson),
    perMonth: Math.ceil(perPerson / PRICING.installments),
    squadDeal,
    savings: squadDeal ? (tier.price - unitPrice) * quantity : 0,
    // berapa orang lagi supaya dapat harga squad (null kalau tier tidak punya harga squad)
    squadNeeded: tier.squadMin != null && !squadDeal ? tier.squadMin - quantity : null
  };
}

export type Quote = ReturnType<typeof quote>;

export type CartItemInput = { tier: string; quantity: number };

// Harga keranjang berisi beberapa jenis tiket. Harga squad dihitung per jenis tiket,
// batas jumlah berlaku untuk total tiket dalam satu pesanan.
export function quoteCart(items: CartItemInput[], tiers: TicketTier[]) {
  if (!items.length) throw new PricingError('Keranjang masih kosong.');
  const bySlug = new Map(tiers.map(t => [t.slug, t]));

  // gabungkan baris dengan tier yang sama
  const merged = new Map<string, number>();
  for (const item of items) merged.set(item.tier, (merged.get(item.tier) ?? 0) + item.quantity);

  const totalQuantity = [...merged.values()].reduce((a, b) => a + b, 0);
  if (totalQuantity > PRICING.maxQuantity) {
    throw new PricingError(`Maksimal ${PRICING.maxQuantity} tiket per pesanan.`);
  }

  const lines = [...merged].map(([slug, quantity]) => {
    const tier = bySlug.get(slug);
    if (!tier) throw new PricingError('Jenis tiket tidak ditemukan.', 404);
    const q = quote(tier, quantity, false);
    return {
      tier: tier.slug,
      tierName: tier.name,
      quantity,
      unitPrice: q.unitPrice,
      subtotal: q.subtotal,
      squadDeal: q.squadDeal,
      squadNeeded: q.squadNeeded
    };
  });

  const subtotal = lines.reduce((sum, l) => sum + l.subtotal, 0);
  const fee = PRICING.feePerTicket * totalQuantity;
  return { lines, totalQuantity, subtotal, fee, total: subtotal + fee };
}

export type CartQuote = ReturnType<typeof quoteCart>;
