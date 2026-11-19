/* snapshot.ts: builds the public snapshots from the database, with the service role, choosing only public columns.
   Each city's snapshot is kept for two seconds in this server's memory (the edge cache does the same in front of it),
   so a thousand people watching one city cost one database read every two seconds. The last good snapshot is kept
   as well: when the database cannot be reached, it is served marked stale instead of an error. */
import type { CitySnap, DaySnap, SnapCity, SnapEntry, SnapStep } from '@/lib/event/snapshot';
import { admin } from './supabase';

const TTL = 2000;
const ms = (v: string | null) => (v ? new Date(v).getTime() : null);
type Row = Record<string, unknown>;

function cityOf(r: Row): SnapCity {
  return {
    id: r.id as string, name: r.name as string, offset: r.offset_min as number, venue: (r.venue as string) || null, luma: (r.luma_url as string) || null, editor: (r.editor_name as string) || null,
    planned: ms(r.planned_start as string)!, buildMin: r.build_min as number, voteAfter: r.vote_after as number,
    buildStart: ms(r.build_start as string), buildEnd: ms(r.build_end as string), voteEnd: ms(r.vote_end as string),
    submissionsPaused: !!r.submissions_paused, votingPaused: !!r.voting_paused,
  };
}
const CITY_COLS = 'id, i, name, offset_min, venue, luma_url, editor_name, planned_start, build_min, vote_after, build_start, build_end, vote_end, submissions_paused, voting_paused';

/* one read for all the cities' visible entries and votes, grouped per city */
async function build(ids: string[] | null): Promise<CitySnap[]> {
  const db = admin(), at = Date.now();
  let cq = db.from('cities').select(CITY_COLS).order('i');
  if (ids) cq = cq.in('id', ids);
  let eq = db.from('entries').select('id, no, city, slug, name, pitch, url, repo, video, picture, via, created_at, people!entries_owner_fkey(name), tally(votes, judge_votes, reached_at)').is('hidden_at', null);
  if (ids) eq = eq.in('city', ids);
  const [cities, entries] = await Promise.all([cq, eq]);
  if (cities.error) throw new Error(cities.error.message);
  if (entries.error) throw new Error(entries.error.message);
  const byId = new Map<string, SnapEntry & { city: string }>();
  (entries.data || []).forEach((e: Row) => {
    const t = (Array.isArray(e.tally) ? e.tally[0] : e.tally) as Row | null, p = e.people as Row | null;
    byId.set(e.id as string, {
      city: e.city as string, no: e.no as number, slug: e.slug as string, name: e.name as string, pitch: e.pitch as string, url: e.url as string,
      repo: (e.repo as string) || null, video: (e.video as string) || null, picture: (e.picture as string) || null, by: (p?.name as string) || null,
      via: e.via as 'editor' | 'web', created: ms(e.created_at as string)!,
      votes: (t?.votes as number) || 0, judge: (t?.judge_votes as number) || 0, reached: ms(t?.reached_at as string) || ms(e.created_at as string)!,
    });
  });
  /* the vote steps, oldest first, for the visible entries only; paged, because a busy city has thousands */
  const steps = new Map<string, SnapStep[]>();
  const ent = Array.from(byId.keys());
  for (let k = 0; k < ent.length; k += 150) {
    const chunk = ent.slice(k, k + 150);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from('votes').select('entry, n, kind, created_at').in('entry', chunk).order('created_at').order('id').range(from, from + 999);
      if (error) throw new Error(error.message);
      (data || []).forEach((v: Row) => {
        const e = byId.get(v.entry as string); if (!e) return;
        const list = steps.get(e.city) || []; list.push([e.no, ms(v.created_at as string)!, v.n as number, v.kind === 'judge' ? 1 : 0]); steps.set(e.city, list);
      });
      if (!data || data.length < 1000) break;
    }
  }
  return (cities.data || []).map((c: Row) => {
    const city = cityOf(c);
    const list = Array.from(byId.values()).filter((e) => e.city === city.id).map(({ city: _c, ...e }) => { void _c; return e; }).sort((a, b) => a.created - b.created || a.no - b.no);
    const st = (steps.get(city.id) || []).sort((a, b) => a[1] - b[1]);
    return { at, city, entries: list, steps: st };
  });
}

const cache = new Map<string, { at: number; snap: CitySnap }>(), last = new Map<string, CitySnap>();
const inflight = new Map<string, Promise<CitySnap[]>>();
function once(key: string, ids: string[] | null): Promise<CitySnap[]> {
  let p = inflight.get(key);
  if (!p) { p = build(ids).finally(() => inflight.delete(key)); inflight.set(key, p); }
  return p;
}

/* after a failed read, readers get the kept snapshot at once (marked stale) while one read in the background checks
   whether the database is back: the client retries a failed read for about seven seconds, and nobody should wait that out */
let downAt = 0;
const isDown = () => Date.now() - downAt < 30000;
const quiet = (p: Promise<unknown>) => { p.catch(() => { /* still down; the next reader tries again */ }); };

async function readCity(id: string): Promise<CitySnap | null> {
  const [snap] = await once('city:' + id, [id]);
  downAt = 0;
  if (!snap) return null;
  cache.set(id, { at: Date.now(), snap }); last.set(id, snap);
  return snap;
}

export async function citySnapshot(id: string): Promise<CitySnap | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL) return hit.snap;
  const old = last.get(id);
  if (old && isDown()) { quiet(readCity(id).catch((e) => { downAt = Date.now(); throw e; })); return { ...old, stale: true }; }
  try {
    return await readCity(id);
  } catch {
    downAt = Date.now();
    return old ? { ...old, stale: true } : null;
  }
}

let dayHit: { at: number; snap: DaySnap } | null = null, dayLast: DaySnap | null = null;
async function readDay(): Promise<DaySnap> {
  const [cities, pk] = await Promise.all([once('day', null), admin().from('pick').select('entries(no, city)').maybeSingle()]);
  if (pk.error) throw new Error(pk.error.message);
  downAt = 0;
  const pe = pk.data?.entries as unknown as { no: number; city: string } | null;
  const snap: DaySnap = { at: Date.now(), cities, pick: pe ? { city: pe.city, no: pe.no } : null };
  dayHit = { at: Date.now(), snap }; dayLast = snap;
  cities.forEach((c) => { cache.set(c.city.id, { at: Date.now(), snap: c }); last.set(c.city.id, c); });
  return snap;
}
export async function daySnapshot(): Promise<DaySnap | null> {
  if (dayHit && Date.now() - dayHit.at < TTL) return dayHit.snap;
  if (dayLast && isDown()) { quiet(readDay().catch((e) => { downAt = Date.now(); throw e; })); return { ...dayLast, stale: true }; }
  try {
    return await readDay();
  } catch {
    downAt = Date.now();
    return dayLast ? { ...dayLast, stale: true } : null;
  }
}

/* after a write that changes what the public sees (a submit, a hide, the clock), the next read builds afresh */
export function forget(city?: string) { if (city) cache.delete(city); else cache.clear(); dayHit = null; }

/* what a real page is given on its first render when the backend is on: the day (without vote steps) and, for a city
   page, that city's own snapshot with them. Nulls when the database cannot be read and nothing is kept yet. */
export async function pageSnaps(city: string | null): Promise<{ day: DaySnap | null; city: CitySnap | null }> {
  const [day, one] = await Promise.all([daySnapshot(), city ? citySnapshot(city) : Promise.resolve(null)]);
  return { day: day ? { ...day, cities: day.cities.map((c) => ({ ...c, steps: [] })) } : null, city: one };
}
