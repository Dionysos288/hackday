/* day-data.ts: the one model both pages read, so a city's row on the home and that city's own page always agree:
   the cities, the schedule, the clock, and each city's seeded project list.

   Placeholders, not confirmed: which ten cities, the 09:00 local start, the date. Offsets are December UTC offsets in
   minutes. Sunrise and sunset are approximate local times for mid-December, used only to draw the daylight band; they
   are not checked against an almanac.

   The home's seeding is kept call-for-call (same seed, same random draws, same winner and counts); each city then
   gets its full list of entries on top, with arrival times and a vote history. Projects 1-20 come from data.ts; the
   rest of each city's entries are generated here from the seed. Pure: no window, no DOM. */
import { PAST, SAMPLE_PROJECTS, type PastEvent, type Project } from './data';

export type City = { i: number; id: string; name: string; offset: number; rise: number; set: number };

function hm(s: string): number { const p = s.split(':'); return +p[0] * 60 + +p[1]; }
const C: [string, string, number, string, string][] = [
  ['sydney', 'Sydney', 660, '05:40', '19:58'],
  ['tokyo', 'Tokyo', 540, '06:40', '16:28'],
  ['singapore', 'Singapore', 480, '06:59', '19:00'],
  ['bengaluru', 'Bengaluru', 330, '06:30', '17:55'],
  ['berlin', 'Berlin', 60, '08:10', '15:53'],
  ['lagos', 'Lagos', 60, '06:50', '18:35'],
  ['london', 'London', 0, '07:59', '15:51'],
  ['sao-paulo', 'São Paulo', -180, '05:15', '18:45'],
  ['new-york', 'New York', -300, '07:09', '16:28'],
  ['san-francisco', 'San Francisco', -480, '07:14', '16:51'],
];
/* east to west, always (rule 1) */
export const CITIES: City[] = C.map((r, i) => ({ i, id: r[0], name: r[1], offset: r[2], rise: hm(r[3]), set: hm(r[4]) }));
export const CITY_IDS: string[] = CITIES.map((c) => c.id);
export function cityById(id: string): City | undefined { return CITIES.find((c) => c.id === id); }

export const EVENT = {
  date: 'Dec 11, 2026',
  year: 2026, month: 12, day: 11,
  name: 'Supabase Hackathon',
  pickers: 'Ant and Copple',
} as const;
/* minute 0 of the model: Dec 11, 00:00 UTC */
export const EPOCH = Date.UTC(EVENT.year, EVENT.month - 1, EVENT.day);

/* Past rows come from PAST only. Winners of past hackathons are not in the repo, so none are shown. */
export function pastEvents(): PastEvent[] { return PAST; }

/* ---------------- the schedule ---------------- */
export type ScheduleKind = 'sun' | 'same';
export type SchedCfg = { schedule: ScheduleKind | string; startHour: number; buildMin: number; voteAfter: number; pickAfter: number };
/* the schedule knobs both pages share, with the home's defaults */
export const SCHED: SchedCfg = { schedule: 'sun', startHour: 9, buildMin: 90, voteAfter: 30, pickAfter: 60 };

export type CitySched = { city: City; start: number; buildEnd: number; end: number };
export type Sched = { cs: CitySched[]; first: number; last: number; pickAt: number; winStart: number; winEnd: number };

export const TA = 0.94;   /* home clock: t from 0 to TA runs the day's strip; from TA to 1 is the day after (archived) */
export function mulberry32(a: number): () => number {
  return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function shuffle<T>(a: T[], R: () => number): T[] { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

/* Minutes are UTC minutes from Dec 11, 00:00. Voting opens when building opens and stays open voteAfter minutes after
   building closes. */
export function sched(c: SchedCfg): Sched {
  const cs = CITIES.map((city) => {
    const start = c.schedule === 'same' ? c.startHour * 60 : c.startHour * 60 - city.offset;
    return { city, start, buildEnd: start + c.buildMin, end: start + c.buildMin + c.voteAfter };
  });
  const first = Math.min(...cs.map((x) => x.start)), last = Math.max(...cs.map((x) => x.end));
  const pickAt = Math.ceil((last + c.pickAfter) / 15) * 15, winStart = Math.floor((first - 60) / 60) * 60;
  const winEnd = Math.max(winStart + 1440, Math.ceil((pickAt + 30) / 60) * 60);
  return { cs, first, last, pickAt, winStart, winEnd };
}
/* the home's clock: t (0..1) to a UTC minute and back */
export function nowOf(t: number, S: Sched): number { return t >= TA ? S.winEnd + 7 * 1440 : S.winStart + t / TA * (S.winEnd - S.winStart); }
export function tOf(now: number, S: Sched): number { return clamp((now - S.winStart) / (S.winEnd - S.winStart) * TA, 0, TA - 0.0005); }

/* ---------------- the seeded entries ---------------- */
/* generated entries: plain names, plain pitches, one handle each */
const NA = ['Quiet', 'Paper', 'Signal', 'Little', 'Open', 'Second', 'Night', 'Field', 'Pocket', 'Slow', 'North', 'Glass', 'Copper', 'Hollow', 'Kind', 'Loose', 'Plain', 'Late', 'Bright', 'Common', 'Small', 'Spare'];
const NB = ['Queue', 'Ledger', 'Index', 'Lantern', 'Harbor', 'Atlas', 'Notebook', 'Relay', 'Sketch', 'Tally', 'Compass', 'Inbox', 'Garden', 'Mirror', 'Switch', 'Pantry', 'Almanac', 'Beacon', 'Thread', 'Drawer', 'Roster', 'Kettle'];
const NF = ['Landlords', 'Book Clubs', 'Food Banks', 'Choirs', 'Night Shifts', 'Allotments', 'Climbing Gyms', 'Dog Walkers'];
const PX = ['A Realtime board', 'Row-level policies', 'An Edge Function', 'A Storage browser', 'pgvector search', 'Magic-link sign-in', 'A Postgres changelog', 'A typed client', 'A cron dashboard', 'Presence cursors', 'A shared calendar', 'Auth with passkeys'];
const PY = ['small teams', 'side projects', 'classrooms', 'a food bank', 'pet sitters', 'book clubs', 'open-source maintainers', 'a running club', 'event organizers', 'landlords and tenants', 'a corner shop', 'night-shift nurses'];
const HN = ['ana', 'bo', 'chidi', 'dana', 'emre', 'femi', 'gus', 'hana', 'ivo', 'jin', 'kai', 'lena', 'milo', 'nia', 'oli', 'pia', 'quin', 'rui', 'sol', 'tara', 'uma', 'vik', 'wren', 'xiu', 'yara', 'zed'];
const HS = ['.dev', '_b', '.sh', '.codes', '.app', '', '.io', '_k'];
export function slug(s: string): string { return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

export type TopEntry = { p: Project; votes: number; e: number };
/* one entry in a city: k is its place in the home's order, a its arrival order, af its arrival as a fraction of the build */
export type Entry = TopEntry & { k: number; a: number; af: number };
export type SeedCity = { i: number; entries: number; list: TopEntry[]; _all: Entry[] | null; seed: number };
export type SeedDay = { cities: SeedCity[]; pick: number };

/* One city's seeded world. Draws from the home's two generators first and in the home's order, so the home's winner,
   entry count and vote counts are unchanged; everything after that uses its own generator. The cache is a memo of a
   pure function of the seed, the same for every request. */
const CACHE: Record<number, SeedDay> = {};
export function seedData(seed: number): SeedDay {
  if (CACHE[seed]) return CACHE[seed];
  const P = SAMPLE_PROJECTS, R = mulberry32(seed * 7919 + 13), perm = shuffle(P, R), pick = Math.floor(R() * 10);
  const out = CITIES.map((city, i): SeedCity => {
    const Rc = mulberry32(seed * 1000 + i * 104729 + 7), entries = 48 + Math.floor(Rc() * 170), win = perm[i];
    const rest = shuffle(P.filter((p) => p !== win), Rc).slice(0, 6), top = Math.round(entries * (1.6 + Rc() * 1.8));
    const list = [win].concat(rest).map((p, k) => (
      { p, votes: k ? Math.round(top * (0.93 - k * 0.1) * (0.88 + Rc() * 0.1)) : top, e: k ? 0.55 + Rc() * 0.4 : 1.05 + Rc() * 0.5 }
    ));
    return { i, entries, list, _all: null, seed };
  });
  return (CACHE[seed] = { cities: out, pick });
}
/* The full list for one city: the home's seven, the other thirteen sample projects, then generated entries up to the
   entry count. Every entry gets an arrival (a fraction of the build) and a vote curve. The tail is held under the
   second project's final total (smaller total, slower curve), so the final winner is the home's. Before voting closes,
   an early arrival can lead for a while; both pages read the same leader() for that. */
export function all(sd: SeedCity): Entry[] {
  if (sd._all) return sd._all;
  const P = SAMPLE_PROJECTS, Rx = mulberry32(sd.seed * 1000 + sd.i * 104729 + 99991), N = sd.entries;
  const inTop = sd.list.map((r) => r.p);
  let tailP: Project[] = shuffle(P.filter((p) => inTop.indexOf(p) < 0), Rx);
  const used: Record<string, number> = {};
  P.forEach((p) => { used[p.name] = 1; });
  for (let k = tailP.length + 7; k < N; k++) {
    let nm = '';
    for (let g = 0; g < 40 && (!nm || used[nm]); g++) {
      const a = Rx();
      nm = a < 0.12 ? NB[Math.floor(Rx() * NB.length)] + ' for ' + NF[Math.floor(Rx() * NF.length)]
        : a < 0.3 ? NB[Math.floor(Rx() * NB.length)] + ['ly', 'r', 'io', 'kit'][Math.floor(Rx() * 4)]
          : NA[Math.floor(Rx() * NA.length)] + ' ' + NB[Math.floor(Rx() * NB.length)];
    }
    if (used[nm]) nm += ' ' + (k + 1);
    used[nm] = 1;
    const hd = HN[Math.floor(Rx() * HN.length)] + (Rx() < 0.5 ? '' : HN[Math.floor(Rx() * HN.length)].slice(0, 3)) + HS[Math.floor(Rx() * HS.length)];
    const id = 1000 + sd.i * 1000 + k;
    tailP.push({ id, name: nm, handle: hd, pitch: PX[Math.floor(Rx() * PX.length)] + ' for ' + PY[Math.floor(Rx() * PY.length)] + '.',
      repo: 'github.com/' + hd.replace(/[^a-z0-9]/gi, '') + '/' + slug(nm), demo: slug(nm) + '.vercel.app', gen: true });
  }
  tailP = tailP.slice(0, Math.max(0, N - 7));
  const V7 = Math.min(...sd.list.slice(1).map((r) => r.votes)), e1 = sd.list[1].e, T = tailP.length;
  const tail = tailP.map((p, j) => {
    const v = Math.round(V7 * 0.94 * Math.pow(1 - j / Math.max(1, T), 2.1) * (0.82 + Rx() * 0.18));
    return { p, votes: v, e: e1 + Rx() * 0.35 };
  });
  const full: Entry[] = sd.list.map((r) => ({ p: r.p, votes: r.votes, e: r.e })).concat(tail).map((r, k) => ({ ...r, k, a: 0, af: 0 }));
  /* arrival order: a seeded shuffle; the first arrives as building opens. The home counts entries as
     max(1, round(N * f^0.85)), and these arrivals are placed so that count is exactly the number already in. */
  shuffle(full, Rx).forEach((r, a) => { r.a = a; r.af = a ? Math.pow((a + 0.5) / N, 1 / 0.85) : 0; });
  return (sd._all = full);
}
/* Each entry can be voted on from its arrival until voting closes. f is that entry's own fraction (0 at its arrival,
   1 when voting closes), so the final count is always r.votes, whatever the schedule. Whole numbers, so the trace
   steps. */
export function votesAt(r: TopEntry, f: number): number { return f >= 1 ? r.votes : f <= 0 ? 0 : Math.round(r.votes * Math.pow(f, r.e)); }
/* the fraction (as above) at which an entry reached its n-th vote: the inverse of votesAt */
export function fOfVote(r: TopEntry, n: number): number { return n <= 0 ? 0 : Math.pow((n - 0.5) / r.votes, 1 / r.e); }
export function countAt(N: number, f: number): number { return Math.max(1, Math.round(N * Math.pow(f, 0.85))); }
/* x is one city's schedule (start, buildEnd, end). An entry's arrival minute, how many entries are in at minute m,
   and an entry's votes at minute m. */
export function arriveAt(r: Entry, x: CitySched): number { return x.start + r.af * (x.buildEnd - x.start); }
export function inAt(sd: SeedCity, x: CitySched, m: number): number { return m < x.start ? 0 : m >= x.buildEnd ? sd.entries : countAt(sd.entries, (m - x.start) / (x.buildEnd - x.start)); }
export function votesAtMin(r: Entry, x: CitySched, m: number): number { const a = arriveAt(r, x); return m >= x.end ? r.votes : m <= a ? 0 : votesAt(r, (m - a) / (x.end - a)); }
/* the minute an entry reached its n-th vote */
export function minOfVote(r: Entry, x: CitySched, n: number): number { const a = arriveAt(r, x); return a + fOfVote(r, n) * (x.end - a); }
export type Lead = { p: Project; v: number; r?: Entry };
/* the leader at minute m among the entries already in; ties go to the earlier entry in the home's order */
export function leader(sd: SeedCity, x: CitySched, m: number): Lead | null {
  let best: Lead | null = null; const n = inAt(sd, x, m);
  all(sd).forEach((r) => { if (r.a >= n) return; const v = votesAtMin(r, x, m); if (!best || v > best.v) best = { p: r.p, v, r }; });
  return best;
}

export type CityStateName = 'next' | 'build' | 'vote' | 'done';
export type CityState = {
  i: number; id: string; name: string; city: City; start: number; buildEnd: number; end: number; entries: number; list: TopEntry[]; sd: SeedCity;
  state: CityStateName; wait?: number; f?: number; n?: number; left?: number; lead?: { p: Project; v: number };
};
/* one city's state at UTC minute now: the same fields the home row reads. 'build': entries arriving and voting open;
   'vote': building closed, the last minutes of voting. f is the fraction through the current phase (for the bars). */
export function cityState(x: CitySched, sd: SeedCity, now: number): CityState {
  const o: CityState = { i: x.city.i, id: x.city.id, name: x.city.name, city: x.city, start: x.start, buildEnd: x.buildEnd, end: x.end, entries: sd.entries, list: sd.list, sd, state: 'done' };
  if (now < x.start) { o.state = 'next'; o.wait = x.start - now; }
  else if (now < x.buildEnd) { o.state = 'build'; o.f = (now - x.start) / (x.buildEnd - x.start); o.n = inAt(sd, x, now); o.left = x.buildEnd - now; }
  else if (now < x.end) { o.state = 'vote'; o.f = (now - x.buildEnd) / (x.end - x.buildEnd); o.n = sd.entries; o.left = x.end - now; }
  else { o.state = 'done'; o.n = sd.entries; o.lead = { p: sd.list[0].p, v: sd.list[0].votes }; }
  if (o.state === 'build' || o.state === 'vote') { const b = leader(sd, x, now)!; o.lead = { p: b.p, v: b.v }; }
  return o;
}
