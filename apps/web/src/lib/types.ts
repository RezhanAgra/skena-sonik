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
