/* A city's page, as the server draws it: the config from the saved looks and the URL, the clock, the frame, and the
   parts that follow the clock (client) beside the parts that do not (server). */
import { FRAME } from '@/components/shared/page-parts';
import dayCfg from '@/saved/day.config.json';
import cityCfg from '@/saved/city.config.json';
import { SCHED } from '@/lib/day-data';
import { DAY_KEYS, DEF, SCHED_KEYS, clampCfg, moments, win, type CityCfg, type Links } from '@/lib/city';
import { clockFrom, param, type Query } from '@/lib/clock';
import { FormsProvider } from '@/components/forms/forms-provider';
import { CityProvider } from './city-context';
import { CityMain } from './city-main';
import { CityMasthead, CityTitle } from './city-masthead';
import { Tower } from './tower';
import { EntriesTable, Ledger, RestOfDay } from './below-sheet';
import { CityFooter, CityHow } from './city-below';
import { ProjectSheet } from './project-sheet';
import '@/components/home/day.css';
import '@/components/shared/view-transitions.css';
import './city.css';
import '@/components/forms/forms.css';

/* the day's config decides the seed and the schedule, so the home and this page draw the same day; the city's config
   is the look; the URL previews a seed, a ground, a sort or a search */
export function savedCityCfg(): CityCfg {
  const base: Record<string, unknown> = { ...DEF, ...SCHED }, day = dayCfg as Record<string, unknown>, city = cityCfg as Record<string, unknown>;
  DAY_KEYS.forEach((k) => { if (day[k] != null) base[k] = day[k]; });
  Object.keys(city).forEach((k) => { if (SCHED_KEYS.indexOf(k) < 0 && city[k] != null) base[k] = city[k]; });
  return base as CityCfg;
}
export function cityConfig(id: string, q: Query): CityCfg {
  const c = savedCityCfg();
  c.city = id;
  (['seed', 'ground', 'sort', 'q'] as const).forEach((k) => { const v = param(q, k); if (v != null) (c as Record<string, unknown>)[k] = v; });
  c.mode = 'tower'; c.you = -1; if (param(q, 'still') === '1') c.rate = 0;
  return clampCfg(c);
}

export function CityPage({ id, q, nowMs }: { id: string; q: Query; nowMs: number }) {
  const cfg = cityConfig(id, q), Wn = win(cfg);
  const clock = clockFrom(q, nowMs, (mid) => { const m = moments(cfg).find((x) => x[0] === mid); return m ? m[2] : null; }, (t) => Wn.w0 + t * (Wn.w1 - Wn.w0));
  const links: Links = { kind: 'page', preview: clock.preview, still: clock.still, seed: param(q, 'seed'), ground: param(q, 'ground') };
  return (
    <FormsProvider>
      <CityProvider cfg={cfg} clock={clock} links={links} openSlug={param(q, 'p')}>
        <div className={FRAME} id="city" data-mode="tower">
          <CityMain>
            <CityMasthead />
            <CityTitle />
            <Tower />
            <Ledger />
            <EntriesTable />
            <CityHow c={cfg} />
            <RestOfDay />
            <CityFooter c={cfg} />
          </CityMain>
        </div>
        <ProjectSheet />
      </CityProvider>
    </FormsProvider>
  );
}
