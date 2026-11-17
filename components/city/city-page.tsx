/* A city's page, as the server draws it: the config from the saved looks and the URL, the clock, the frame, and the
   parts that follow the clock (client) beside the parts that do not (server). */
import { FRAME } from '@/components/shared/page-parts';
import dayCfg from '@/saved/day.config.json';
import cityCfg from '@/saved/city.config.json';
import cityLook from '@/saved/lab-city.config.json';
import { SCHED } from '@/lib/day-data';
import { DAY_KEYS, DEF, SCHED_KEYS, clampCfg, moments, slugOf, win, world, type CityCfg, type Links } from '@/lib/city';
import { clockFrom, param, type Query } from '@/lib/clock';
import { FormsProvider } from '@/components/forms/forms-provider';
import { CityProvider, type PView, type Who } from './city-context';
import { CityMain } from './city-main';
import { CityMasthead, CityTitle } from './city-masthead';
import { TowerFinal } from './tower-final';
import { JudgeBar, ShareKit, YouBar } from './final-parts';
import { EntriesTable, Ledger, RestOfDay } from './below-sheet';
import { CityFooter, CityHow } from './city-below';
import { ProjectView } from './project-view';
import '@/components/home/day.css';
import '@/components/shared/view-transitions.css';
import './city.css';
import './final.css';
import '@/components/forms/forms.css';

/* the day's config decides the seed and the schedule, so the home and this page draw the same day; the city's config
   is the look; the URL previews a seed, a ground, a sort or a search */
export function savedCityCfg(): CityCfg {
  const base: Record<string, unknown> = { ...DEF, ...SCHED }, day = dayCfg as Record<string, unknown>, city = cityCfg as Record<string, unknown>;
  DAY_KEYS.forEach((k) => { if (day[k] != null) base[k] = day[k]; });
  Object.keys(city).forEach((k) => { if (SCHED_KEYS.indexOf(k) < 0 && city[k] != null) base[k] = city[k]; });
  return base as CityCfg;
}
/* ?as=builder and ?as=judge preview the page as a builder (with one of the city's entries as theirs, ?you=<n>) or as a
   judge, until there is an admin panel for judges. Without them, a person whose entry is in this city is its builder. */
const PREVIEW_ENTRY = 12;
export function previewWho(q: Query): Who | undefined { const a = param(q, 'as'); return a === 'builder' || a === 'judge' ? a : undefined; }
export function cityConfig(id: string, q: Query): CityCfg {
  const c = savedCityCfg();
  c.city = id;
  (['seed', 'ground', 'sort', 'q'] as const).forEach((k) => { const v = param(q, k); if (v != null) (c as Record<string, unknown>)[k] = v; });
  c.mode = 'tower'; c.you = previewWho(q) === 'builder' ? Number(param(q, 'you') ?? PREVIEW_ENTRY) : -1; if (param(q, 'still') === '1') c.rate = 0;
  return clampCfg(c);
}
/* how a project opens comes from the city's tuning page */
const PVIEW = (['side', 'row', 'centred'].indexOf(String((cityLook as Record<string, unknown>).view)) >= 0 ? (cityLook as Record<string, unknown>).view : 'side') as PView;

/* a project by its address, at the moment the URL asks for (or now): its row, and the city's world then */
export function projectAt(id: string, slug: string, q: Query, nowMs: number) {
  const cfg = cityConfig(id, q), Wn = win(cfg);
  const clock = clockFrom(q, nowMs, (mid) => { const m = moments(cfg).find((x) => x[0] === mid); return m ? m[2] : null; }, (t) => Wn.w0 + t * (Wn.w1 - Wn.w0));
  const W = world({ ...cfg, you: -1, now: clock.at }, {}), row = W.rows.find((o) => slugOf(o.p) === slug) || null;
  return { W, row, listed: !!row && W.arrived.indexOf(row) >= 0 };
}

/* slug: the project in the address (/city/<city>/p/<slug>), drawn open over its city */
export function CityPage({ id, q, nowMs, slug }: { id: string; q: Query; nowMs: number; slug?: string }) {
  const cfg = cityConfig(id, q), Wn = win(cfg);
  const clock = clockFrom(q, nowMs, (mid) => { const m = moments(cfg).find((x) => x[0] === mid); return m ? m[2] : null; }, (t) => Wn.w0 + t * (Wn.w1 - Wn.w0));
  const links: Links = { kind: 'page', preview: clock.preview, still: clock.still, seed: param(q, 'seed'), ground: param(q, 'ground') };
  return (
    <FormsProvider>
      <CityProvider cfg={cfg} clock={clock} links={links} openSlug={slug} who={previewWho(q)} pview={PVIEW}>
        <div className={FRAME} id="city" data-mode="tower">
          <CityMain>
            <CityMasthead />
            <CityTitle />
            <TowerFinal />
            <Ledger />
            <EntriesTable />
            <CityHow c={cfg} />
            <RestOfDay />
            <CityFooter c={cfg} />
            {/* the builder's dock (the share kit opens above its bar) and the judge's bar: last in the page and sticky,
                so they stay in view from the sheet to the footer (rule 24) */}
            <div className="sticky bottom-0 z-20"><ShareKit /><YouBar /></div>
            <JudgeBar />
          </CityMain>
        </div>
        <ProjectView />
      </CityProvider>
    </FormsProvider>
  );
}
