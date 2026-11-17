/* The day's facts for the drawings, from the model: the ten cities east to west with where they are, their sessions in
   UTC minutes and their seven leading entries (final votes, vote curve, arrival), the model's own pick for the sample
   day and when the pick is made. Pure and server-safe; the same seed gives the same numbers as the day pages. */

import day from '@/saved/day.config.json';
import { CITIES, EVENT, SCHED, all, sched, seedData } from '@/lib/day-data';
import { CODE, PLACE } from '@/lib/places';
import type { CityFact } from './draw';

const CACHE = new Map<number, { cities: CityFact[]; seedPick: number; pickAt: number }>();

export function dayFacts(seed: number = day.seed): { cities: CityFact[]; seedPick: number; pickAt: number } {
  const hit = CACHE.get(seed); if (hit) return hit;
  const cfg = { ...SCHED, schedule: day.schedule, startHour: day.startHour, buildMin: day.buildMin, voteAfter: day.voteAfter, pickAfter: day.pickAfter };
  const S = sched(cfg), sd = seedData(seed);
  const cities: CityFact[] = S.cs.map((x, i) => {
    const c = CITIES[i], [lat, lon] = PLACE[c.id], sc = sd.cities[i];
    return {
      id: c.id, code: CODE[c.id], lat, lon, off: c.offset, start: x.start, buildEnd: x.buildEnd, end: x.end, entries: sc.entries,
      seven: all(sc).slice(0, 7).map((r) => ({ name: r.p.name, v: r.votes, e: r.e, af: r.af })),
    };
  });
  const out = { cities, seedPick: sd.final.city * EVENT.finalists + (sd.final.place - 1), pickAt: S.pickAt };
  CACHE.set(seed, out);
  return out;
}
