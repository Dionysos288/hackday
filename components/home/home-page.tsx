/* The home, as the server draws it: the config and the clock from the saved files and the URL, the frame, then the
   Sheet (the whole day in the first viewport), the final as one diagram, the questions and the footer. */
import { FRAME } from '@/components/shared/page-parts';
import type { CSSProperties } from 'react';
import saved from '@/saved/day.config.json';
import savedLook from '@/saved/lab-home.config.json';
import { nowOf, sched } from '@/lib/day-data';
import { clockFrom, param, type Query } from '@/lib/clock';
import { DEF, clampCfg, moments, pageVars, type Carry, type HomeCfg } from '@/lib/home';
import { DayProvider } from './day-context';
import { HomeMain } from './home-main';
import { LookProvider, type HoverMode, type Look, type WireMode, type Zoom } from './look';
import { Sheet } from './sheet';
import { Diagram } from './final';
import { CitiesFooter, HomeQuestions } from './final-parts';
import './day.css';
import './sheet.css';
import '@/components/forms/forms.css';
import '@/components/shared/view-transitions.css';

/* the schedule, the seed and the ground come from the day's saved config, which the city pages read too, so the two
   always agree; the clock, your city and the preview parameters are the page's own */
export function homeConfig(q: Query): HomeCfg {
  const c: HomeCfg = { ...DEF, ...(saved as Partial<HomeCfg>) };
  (['seed', 'ground'] as const).forEach((k) => { const v = param(q, k); if (v != null) (c as Record<string, unknown>)[k] = v; });
  c.mode = 'timetable'; c.you = -1;
  return clampCfg(c);
}

/* the look comes from the home's tuning page (saved/lab-home.config.json): the Sheet's sizes, how the city names sit,
   the wire, the hover preview, the strip's zoom, the prizes in the facts, and the diagram's row and bend */
type SavedLook = { sheetNm: number; sheetRh: number; sheetSw: number; names: string; wire: string; hover: string; zoom: string; factPrizes?: number; finRh: number; curve: number };
const L = savedLook as SavedLook;
const LOOK: Look = { wire: L.wire as WireMode, hover: L.hover as HoverMode, zoom: L.zoom as Zoom, round: 'final', factPrizes: !!L.factPrizes };

export function HomePage({ q, nowMs }: { q: Query; nowMs: number }) {
  const cfg = homeConfig(q), S = sched(cfg);
  const clock = clockFrom(q, nowMs, (id) => { const m = moments(cfg).find((x) => x[0] === id); return m ? m[2] : null; }, (t) => nowOf(t, S));
  const carry: Carry = { preview: clock.preview, still: clock.still, seed: param(q, 'seed'), ground: param(q, 'ground') };
  const style = { ...pageVars(cfg), '--hs-nm': L.sheetNm, '--hs-rh': L.sheetRh, '--hs-sw': L.sheetSw } as CSSProperties;
  return (
    <div className={FRAME + ' hs-on'} id="day" data-mode="sheet" data-names={L.names}>
      <DayProvider cfg={cfg} clock={clock} carry={carry}>
        <LookProvider value={LOOK}>
          <HomeMain style={style}>
            <Sheet />
            <Diagram finRh={L.finRh} curve={L.curve} />
            <HomeQuestions />
            <CitiesFooter />
          </HomeMain>
        </LookProvider>
      </DayProvider>
    </div>
  );
}
