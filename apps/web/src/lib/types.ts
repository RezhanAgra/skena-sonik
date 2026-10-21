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
  emailDelivery: 'smtp' | 'log';
  event: { name: string; location: string; hours: string };
  tickets: ETicket[];
}

export interface ETicket {
  code: string;
  tierName: string;
  holderName: string;
  seq: number;
  access: string;
  dateLabel: string;
  checkIns: { day: number; at: string }[];
  /** SVG QR dari API (tepercaya, dibuat server) */
  qrSvg: string;
}

/* ---------- gerbang ---------- */

export interface GateInfo { ok: true; staff: { name: string; role: Role } | null; event: string; today: number | null; days: { day: number; label: string }[] }

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

/* ---------- akun ---------- */

export type Role = 'AUDIENCE' | 'STAFF' | 'ORGANIZER';

export interface AuthUser { id: number; email: string; name: string; phone: string | null; role: Role; emailVerified: boolean }

export interface MyOrder {
  code: string;
  status: OrderStatus;
  total: number;
  createdAt: string;
  paidAt: string | null;
  items: { tierName: string; quantity: number }[];
  ticketCount: number;
}
export interface MyOrders { emailVerified: boolean; orders: MyOrder[] }

/* ---------- dasbor penyelenggara ---------- */

export interface AdminStats {
  revenue: number;
  serviceFees: number;
  orders: Record<OrderStatus, number>;
  ticketsIssued: number;
  perTier: { tier: string; name: string; sold: number; revenue: number }[];
  checkIns: { day: number; label: string; count: number }[];
  daily: { date: string; revenue: number; orders: number }[];
  accounts: Record<Role, number>;
}

export interface AdminOrder {
  code: string;
  status: OrderStatus;
  buyerName: string;
  buyerEmail: string;
  buyerPhone: string;
  total: number;
  items: { tierName: string; quantity: number }[];
  ticketCount: number;
  paymentType: string | null;
  ticketsEmailedAt: string | null;
  ticketsEmailError: string | null;
  createdAt: string;
  paidAt: string | null;
  hasAccount: boolean;
}
export interface AdminOrderPage { page: number; pageSize: number; total: number; orders: AdminOrder[] }

export interface TeamMember { id: number; name: string; email: string; role: Role; emailVerified: boolean; createdAt: string }
