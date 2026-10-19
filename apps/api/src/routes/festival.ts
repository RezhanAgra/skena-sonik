// GET /api/festival — semua konten halaman dalam satu respons
import { Router } from 'express';
import { prisma } from '../db.ts';
import { PRICING } from '../lib/pricing.ts';
import { CityStatus } from '../generated/prisma/client.ts';

const EVENT_STARTS_AT = '2026-12-12T14:00:00+07:00';
const DAY_LABEL: Record<number, string> = { 1: 'Sab, 12 Des', 2: 'Min, 13 Des' };
const STATUS_KEY: Record<CityStatus, string> = {
  [CityStatus.SOLD_OUT]: 'sold',
  [CityStatus.LOW]: 'low',
  [CityStatus.ON_SALE]: 'live',
  [CityStatus.SOON]: 'soon'
};

const pad = (n: number) => String(n).padStart(2, '0');
const clock = (minute: number) => `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;

export const festivalRouter = Router();

festivalRouter.get('/', async (_req, res) => {
  const [cities, stages, genres, artists, songs, tiers] = await Promise.all([
    prisma.city.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.stage.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.genre.findMany({ orderBy: { sortOrder: 'asc' } }),
    prisma.artist.findMany({
      include: { performance: { include: { stage: true } } },
      orderBy: [{ headliner: 'desc' }, { genre: { sortOrder: 'asc' } }, { name: 'asc' }]
    }),
    prisma.song.findMany({
      include: { artist: { include: { performance: true } } },
      orderBy: { sortOrder: 'asc' }
    }),
    prisma.ticketTier.findMany({ orderBy: { sortOrder: 'asc' } })
  ]);

  res.json({
    event: { startsAt: EVENT_STARTS_AT, days: DAY_LABEL },
    cities: cities.map(c => ({ code: c.code, name: c.name, dateLabel: c.dateLabel, status: STATUS_KEY[c.status] })),
    stages: stages.map(s => ({ id: s.id, name: s.name })),
    genres: genres.map(g => ({
      slug: g.slug,
      label: g.label,
      bio: g.bio,
      persona: { name: g.personaName, stage: g.personaStage, desc: g.personaDesc }
    })),
    artists: artists.map(a => ({
      slug: a.slug,
      name: a.name,
      headliner: a.headliner,
      genre: a.genreSlug,
      performance: a.performance && {
        day: a.performance.day,
        stageId: a.performance.stageId,
        stageName: a.performance.stage.name,
        startMinute: a.performance.startMinute,
        endMinute: a.performance.endMinute,
        start: clock(a.performance.startMinute),
        end: clock(a.performance.endMinute)
      }
    })),
    songs: songs.map(s => {
      const p = s.artist.performance;
      return {
        id: s.id,
        title: s.title,
        artist: s.artist.name,
        genre: s.artist.genreSlug,
        speed: s.speed,
        when: p ? `${DAY_LABEL[p.day]} · ${clock(p.startMinute).replace(':', '.')}` : null
      };
    }),
    tiers: tiers.map(t => ({
      slug: t.slug,
      name: t.name,
      price: t.price,
      perks: t.perks,
      badge: t.badge,
      soldOut: t.soldOut,
      squadPrice: t.squadPrice,
      squadMin: t.squadMin
    })),
    pricing: PRICING
  });
});
