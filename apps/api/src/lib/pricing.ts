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
