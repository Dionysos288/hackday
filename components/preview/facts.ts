import day from '@/saved/day.config.json';
import { CODE, PLACE } from '@/lib/places';
import { RULES, SERVER, sayIt } from '@/lib/hackday-server';
import { CITIES, EPOCH, EVENT, SCHED, mulberry32, sched } from '@/lib/day-data';
import { hhmm } from '@/lib/format';
import { PRIZES } from '@/lib/prizes';
import type { WheelStatus } from '@/components/wheel/click';
import type { WheelFact } from '@/components/wheel/wheel';

/* Our facts for the wheel, from the model: the cities in their order, each city's session from the saved
   schedule (building opens, voting closes), and the date. Where on the globe each city is comes from the table below,
   in lib/places.ts, since the model has no coordinates. PLACEHOLDERS: the people counts and the states are seeded, not real; the
   model has no sign-ups yet. */

export { PLACE };

export type OurFact = WheelFact & { offset: number; opens: number; buildEnds: number; closes: number };
export type OurWheel = { cities: OurFact[]; date: string; nearest: number; buildMin: number; voteAfter: number; startHour: number; pickAt: string; how: [string, string][]; format: [string, string][] };

export function ourWheel(): OurWheel {
  const cfg = { ...SCHED, schedule: day.schedule, startHour: day.startHour, buildMin: day.buildMin, voteAfter: day.voteAfter, pickAfter: day.pickAfter };
  const S = sched(cfg), R = mulberry32(day.seed * 977 + 11);
  const cities: OurFact[] = S.cs.map((x, i) => {
    const c = CITIES[i], o = c.offset, [lat, lon] = PLACE[c.id];
    /* PLACEHOLDER: seeded sign-ups against a seeded room size */
    const room = [150, 200, 250, 300][Math.floor(R() * 4)], people = Math.min(room, Math.round((0.55 + R() * 0.5) * room / 10) * 10);
    const status: WheelStatus = people >= room ? 'full' : people >= room * 0.85 ? 'nearing' : 'open';
    return {
      id: c.id, name: c.name, code: CODE[c.id] ?? c.name.slice(0, 3).toUpperCase(), lat, lon, status, offset: o,
      session: `${hhmm(x.start + o)}–${hhmm(x.end + o)} ${zoneText(o / 60)}`, count: `${people} people`,
      href: `/city/${c.id}`, action: status === 'full' ? `Join the waiting list in ${c.name}` : `Join in ${c.name}`,
      opens: EPOCH + x.start * 60000, buildEnds: EPOCH + x.buildEnd * 60000, closes: EPOCH + x.end * 60000,
    };
  });
  const top = EVENT.finalists, n = cities.length, pickAt = hhmm(S.pickAt) + ' UTC';
  const cityPrize = PRIZES.city.what ?? 'the city prize';
  return {
    cities, date: `${EVENT.day} December ${EVENT.year}`, nearest: 0, buildMin: cfg.buildMin, voteAfter: cfg.voteAfter, startHour: cfg.startHour, pickAt,
    /* the rail's four cells, and the sheet's format */
    format: [
      ['Build', `${cfg.buildMin} minutes from ${hhmm(cfg.startHour * 60)} local`],
      ['Final', `Top ${top} in each city, ${top * n} in all`],
      ['City prize', `1st in each city wins ${cityPrize}`],
      ['The pick', `${EVENT.pickers} pick one of the ${top * n}`],
    ],
    how: [
      ['How do I enter?', `Come to your city on ${EVENT.day} December. Building opens at ${hhmm(cfg.startHour * 60)} local time and runs ${cfg.buildMin} minutes. Submit your project from your editor or on your city’s page, then share it: anyone with the link can vote.`],
      ['How do I submit?', `From your editor: add the Builder Day server, then say “${sayIt()}” It fills in the name, the pitch and the repository and sends them. Or on your city’s page, in the browser. Both run the same checks.${SERVER.live ? '' : ' The server is not open yet; the line to add it will be in Get ready.'}`],
      ['What is checked?', `${RULES.join(' ')} A repository made before the day is refused.`],
      ['Who can vote?', `Anyone with the link, after confirming an email once. Voting opens when building starts and closes ${cfg.voteAfter} minutes after it ends.`],
      ['Who goes to the final?', `The top ${top} by votes in each city, so ${top * n} finalists. First place in each city wins ${cityPrize}.`],
      ['What do the judges do?', `Each judge has ${EVENT.judgeVotes} votes and can put several on one project. Their votes count in the same tally as everyone's.`],
      ['How is the winner picked?', `${EVENT.pickers} pick one of the ${top * n} finalists at ${pickAt}. The pick wins ${PRIZES.global.what ?? "the global prize"}.`],
    ],
  };
}

/* the city whose UTC offset is closest to the visitor's */
/* where the visitor is (degrees), when known: from the host's IP lookup, or ?at=lat,lon */
export type Here = { lat: number; lon: number };
const km = (a: Here, b: Here) => {
  const r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
};

/* the nearest city: by distance from where the visitor is; with no position, by time zone */
export function nearestCity(cities: { offset: number; lat?: number; lon?: number }[], visitorOffset: number, here?: Here | null) {
  let best = 0;
  if (here) {
    let d = Infinity;
    cities.forEach((c, i) => { if (c.lat === undefined || c.lon === undefined) return; const x = km(here, { lat: c.lat, lon: c.lon }); if (x < d) { d = x; best = i; } });
    return best;
  }
  cities.forEach((c, i) => { if (Math.abs(c.offset - visitorOffset) < Math.abs(cities[best].offset - visitorOffset)) best = i; });
  return best;
}

/* "Opens in 23 days", counted to the city's own opening */
export function countdown(c: OurFact, now: number): string {
  if (now >= c.closes) return 'Closed';
  if (now >= c.buildEnds) return 'Voting now';
  if (now >= c.opens) return 'Building now';
  const min = Math.ceil((c.opens - now) / 60000);
  if (min >= 1440) { const d = Math.ceil(min / 1440); return `Opens in ${d} day${d === 1 ? '' : 's'}`; }
  if (min >= 60) return `Opens in ${Math.floor(min / 60)} h ${min % 60} min`;
  return `Opens in ${min} min`;
}

/* a UTC offset as people write it: UTC, UTC+11, UTC−3, UTC+5:30 */
export function zoneText(offsetHours: number) {
  const size = Math.abs(offsetHours);
  return size === 0 ? 'UTC' : `UTC${offsetHours > 0 ? '+' : '−'}${size % 1 ? `${Math.floor(size)}:${String(Math.round((size % 1) * 60)).padStart(2, '0')}` : size}`;
}
