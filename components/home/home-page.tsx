/* The home, as the server draws it: the config and the clock from the saved look and the URL, the frame, and the
   parts that follow the clock (client) beside the parts that do not (server). */
import { FRAME } from '@/components/shared/page-parts';
import type { CSSProperties } from 'react';
import saved from '@/saved/day.config.json';
import { nowOf, sched } from '@/lib/day-data';
import { clockFrom, param, type Query } from '@/lib/clock';
import { DEF, clampCfg, moments, pageVars, type Carry, type HomeCfg } from '@/lib/home';
import { DayProvider } from './day-context';
import { HomeMain } from './home-main';
import { HomeMasthead } from './home-masthead';
import { Timetable } from './timetable';
import { Pick } from './pick';
import { ArchivedRow } from './archived-row';
import { HomeFooter, HowItWorks, PastHackathons, Questions } from './below';
import './day.css';
import '@/components/forms/forms.css';
import '@/components/shared/view-transitions.css';

/* the saved config is the look; the clock, your city and the preview parameters are the page's own */
export function homeConfig(q: Query): HomeCfg {
  const c: HomeCfg = { ...DEF, ...(saved as Partial<HomeCfg>) };
  (['seed', 'ground'] as const).forEach((k) => { const v = param(q, k); if (v != null) (c as Record<string, unknown>)[k] = v; });
  c.mode = 'timetable'; c.you = -1;
  return clampCfg(c);
}

export function HomePage({ q, nowMs }: { q: Query; nowMs: number }) {
  const cfg = homeConfig(q), S = sched(cfg);
  const clock = clockFrom(q, nowMs, (id) => { const m = moments(cfg).find((x) => x[0] === id); return m ? m[2] : null; }, (t) => nowOf(t, S));
  const carry: Carry = { preview: clock.preview, still: clock.still, seed: param(q, 'seed'), ground: param(q, 'ground') };
  return (
    <div className={FRAME} id="day" data-mode="timetable">
      <h1 className="sr-only">Supabase Hackathon</h1>
      <DayProvider cfg={cfg} clock={clock} carry={carry}>
        <HomeMain style={pageVars(cfg) as CSSProperties}>
          <HomeMasthead />
          <Timetable />
          <Pick />
          <HowItWorks c={cfg} />
          <Questions />
          <PastHackathons first={<ArchivedRow />} />
          <HomeFooter />
        </HomeMain>
      </DayProvider>
    </div>
  );
}
