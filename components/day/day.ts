import dayCfg from '@/saved/day.config.json';
import { cityAt, type Day } from '@/components/board/day-model';
import { slugOf } from '@/lib/city';
import { realMinute } from '@/lib/clock';

/* The day the home and every city page draw: the schedule and seed from saved/day.config.json. worst: the stress
   content (long names, a city with no entries), on in the labs, off on the real pages unless ?worst=1 asks for it.
   Pure, so the server can draw the same day for a page's metadata. */
export function dayOf(worst: number, seed?: number): Day {
  const d = dayCfg as Record<string, unknown>;
  return { seed: seed ?? Number(d.seed), schedule: String(d.schedule), startHour: Number(d.startHour), buildMin: Number(d.buildMin), voteAfter: Number(d.voteAfter), pickAfter: Number(d.pickAfter), worst };
}

/* a project by its address, on the real page's day, at the minute the URL asks for (?m=) or now: the city's world
   then and the project's row (null when the city has no such project) */
export function projectOnDay(city: string, slug: string, q: Record<string, string | undefined>, nowMs: number) {
  const m = q.m && isFinite(+q.m) ? +q.m : realMinute(nowMs);
  const W = cityAt(dayOf(q.worst === '1' ? 1 : 0), city, m), row = W.rows.find((r) => slugOf(r.p) === slug) ?? null;
  return { W, row, listed: !!row && W.arrived.indexOf(row) >= 0 };
}

/* a page's search params with one value per key, as the day pages read them */
export const flatQuery = (q: Record<string, string | string[] | undefined>) => Object.fromEntries(Object.entries(q).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v])) as Record<string, string | undefined>;
