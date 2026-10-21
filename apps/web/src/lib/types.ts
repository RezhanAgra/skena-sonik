// Bentuk data dari GET /api/festival (lihat apps/api/src/routes/festival.ts)

export type CityStatus = 'sold' | 'low' | 'live' | 'soon';

export interface City { code: string; name: string; dateLabel: string; status: CityStatus }
export interface Stage { id: number; name: string }
export interface Genre {
  slug: string;
  label: string;
  bio: string;
  persona: { name: string; stage: string; desc: string };
}
export interface Performance {
  day: number;
  stageId: number;
  stageName: string;
  startMinute: number;
  endMinute: number;
  start: string;
  end: string;
}
export interface Artist { slug: string; name: string; headliner: boolean; genre: string; performance: Performance | null }
export interface Song { id: number; title: string; artist: string; genre: string; speed: number; when: string | null }
export interface Tier {
  slug: string;
  name: string;
  price: number;
  perks: string[];
  badge: string | null;
  soldOut: boolean;
  squadPrice: number | null;
  squadMin: number | null;
}
export interface Pricing { feePerTicket: number; maxQuantity: number; installments: number }

export interface Festival {
  event: { startsAt: string; days: Record<string, string> };
  cities: City[];
  stages: Stage[];
  genres: Genre[];
  artists: Artist[];
  songs: Song[];
  tiers: Tier[];
  pricing: Pricing;
}

export interface Quote {
  tier: string;
  tierName: string;
  quantity: number;
  installment: boolean;
  unitPrice: number;
  subtotal: number;
  fee: number;
  total: number;
  perPerson: number;
  perMonth: number;
  squadDeal: boolean;
  savings: number;
  squadNeeded: number | null;
}

/* ---------- keranjang & pesanan ---------- */

export interface CartItem { tier: string; quantity: number }

export interface CartLine {
  tier: string;
  tierName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  squadDeal: boolean;
  squadNeeded: number | null;
}

export interface CartQuote { lines: CartLine[]; totalQuantity: number; subtotal: number; fee: number; total: number }

export interface Buyer { name: string; email: string; phone: string }

export interface CheckoutResult {
  code: string;
  total: number;
  provider: 'midtrans' | 'mock';
  token: string | null;
  redirectUrl: string;
  snap: { clientKey: string; scriptUrl: string } | null;
}

export type OrderStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED' | 'REFUNDED';

export interface OrderView {
  code: string;
  status: OrderStatus;
  buyerName: string;
  buyerEmail: string;
  items: { tier: string; tierName: string; quantity: number; unitPrice: number; subtotal: number }[];
  subtotal: number;
  fee: number;
  total: number;
  paymentProvider: string;
  paymentType: string | null;
  paymentUrl: string | null;
  paidAt: string | null;
  createdAt: string;
  ticketsEmailedAt: string | null;
  ticketsEmailFailed: boolean;
  tickets: ETicket[];
}

export interface ETicket {
  code: string;
  tierName: string;
  holderName: string;
  seq: number;
  access: string;
  checkIns: { day: number; at: string }[];
  /** SVG QR dari API (tepercaya, dibuat server) */
  qrSvg: string;
}

/* ---------- gerbang ---------- */

export interface GateInfo { ok: true; event: string; today: number | null; days: { day: number; label: string }[] }

export interface GateTicket {
  code: string;
  tierName: string;
  holderName: string;
  seq: number;
  totalInOrder: number;
  orderCode: string;
  daysAccess: number;
  checkIns: { day: number; at: string; gate: string | null }[];
}

export interface CheckInResult {
  result: 'ok' | 'used' | 'wrong_day' | 'invalid';
  day: number;
  ticket?: GateTicket;
  message: string;
}

export interface GateStats { issued: number; checkedIn: { day: number; count: number }[] }
