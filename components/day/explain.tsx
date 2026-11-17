'use client';
import { useState, useSyncExternalStore } from 'react';
import { CITIES, EVENT } from '@/lib/day-data';
import { PRIZES } from '@/lib/prizes';
import { hhmm } from '@/lib/format';
import { CODE } from '@/lib/places';
import savedScope from '@/saved/explain.config.json';
import { clampScope, type Facts, type ScopeCfg } from './scope';
import { Tube, TubePause } from './tube';

/* How the day works and what it gives away, drawn on tubes (scope.ts): the build clock running down while the beam
   draws an app, votes arriving, thirty finalists becoming one pick; then the prizes, $10,000 rolling in on flaps and a
   laptop drawing itself. The look and every timing come from saved/explain.config.json, tuned at /lab/explain.
   Used in the wheel's sheet (the preview home), on the day home and on a city page. The register link goes to Luma;
   the real event links are not out yet, so every city points at one placeholder address (LUMA below).

   Placeholder, not confirmed: the Luma links. */

/* PLACEHOLDER: the Luma event links are not out yet */
export const LUMA = 'https://example.com/luma';
export const lumaHref = (city?: string) => LUMA + (city ? '?city=' + city : '');

export type ExplainFacts = { buildMin: number; voteAfter: number; startHour: number };
const SAVED = clampScope(savedScope as Partial<ScopeCfg>);
const cap = (s: string) => s.replace(/^an? /, '').replace(/^./, (c) => c.toUpperCase());
/* finalists and pick: the day's own count and pick once they are known, so this agrees with the rest of the page */
export type DayFinal = { finalists?: number; pick?: number; empty?: number[] };
const facts = (f?: ExplainFacts, d?: DayFinal): Facts => ({ buildMin: f?.buildMin ?? 90, voteAfter: f?.voteAfter ?? 30, startHour: f?.startHour ?? 9, codes: CITIES.map((c) => CODE[c.id]), top: EVENT.finalists, ...d });

const subReduce = (fn: () => void) => { const m = window.matchMedia('(prefers-reduced-motion: reduce)'); m.addEventListener('change', fn); return () => m.removeEventListener('change', fn); };
const useReduced = () => useSyncExternalStore(subReduce, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches, () => false);

const H = ({ level, id, children }: { level: 2 | 3; id: string; children: string }) => (level === 3 ? <h3 id={id} className="ex-h">{children}</h3> : <h2 id={id} className="ex-h">{children}</h2>);

/* the three steps; with the reel, one tube plays them in turn and the step it is on lights */
export function HowItWorks({ f, compact = false, id = 'how', scope, day, level = 2 }: { f: ExplainFacts; compact?: boolean; id?: string; scope?: ScopeCfg; day?: DayFinal; level?: 2 | 3 }) {
  const cfg = scope ?? SAVED, top = EVENT.finalists, F = facts(f, day), fin = F.finalists ?? top * CITIES.length, reduced = useReduced();
  const layout = cfg.layout === 'reel' && reduced ? 'stacked' : cfg.layout;
  const [on, setOn] = useState(0);
  const steps = [
    { scene: 'build' as const, k: 'Build', t: f.buildMin + ' minutes to build', p: 'Each city starts at ' + hhmm(f.startHour * 60) + ' local time. Build something new with Supabase and submit it on your city’s page before the clock runs out.' },
    { scene: 'vote' as const, k: 'Vote', t: 'Votes from the first minute', p: 'Voting opens when building starts and closes ' + f.voteAfter + ' minutes after it ends. Anyone with the link can vote; share your project while you build.' },
    { scene: 'final' as const, k: 'Final', t: fin + ' finalists, one pick', p: 'The top ' + top + ' in each city go to the final. ' + EVENT.pickers + ' pick one of the ' + fin + '.' },
  ];
  return (
    <section className="ex" data-compact={compact ? '' : undefined} data-layout={layout} aria-labelledby={id + '-h'}>
      <div className="ex-top"><H level={level} id={id + '-h'}>How it works</H><TubePause /></div>
      {layout === 'reel' ? <Tube scene="reel" cfg={cfg} f={F} onStep={setOn} className="ex-reel" /> : null}
      <ol className="ex-mons">
        {steps.map((s, i) => (
          <li key={s.k} className="ex-mon" data-on={layout === 'reel' && i === on ? '' : undefined}>
            {layout === 'reel' ? <span className="ex-lamp" aria-hidden="true" /> : <Tube scene={s.scene} cfg={cfg} f={F} className="ex-tube" />}
            <span className="ex-umd"><span className="ex-k">{s.k}</span><span className="ex-t">{s.t}</span></span>
            <p className="ex-p">{s.p}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* the prizes: the global one on flaps, the city prize as a laptop drawing itself, with the ten cities under it */
export function PrizeBlock({ compact = false, id = 'prize', winner, scope, f, day, level = 2 }: { compact?: boolean; id?: string; winner?: string | null; scope?: ScopeCfg; f?: ExplainFacts; day?: DayFinal; level?: 2 | 3 }) {
  const cfg = scope ?? SAVED, g = PRIZES.global.what, c = PRIZES.city.what, F = facts(f, day), fin = F.finalists ?? EVENT.finalists * CITIES.length;
  return (
    <section className="ex ex-prize" data-compact={compact ? '' : undefined} aria-labelledby={id + '-h'}>
      <div className="ex-top"><H level={level} id={id + '-h'}>Prizes</H><TubePause /></div>
      <div className="ex-glob">
        <span className="ex-k">The pick from the {fin} finalists</span>
        <Tube scene="cash" cfg={cfg} f={F} className="ex-tube" />
        <p className="ex-big" data-sk-skip>{g ? cap(g) : 'To be announced'}</p>
        <span className="ex-t">{winner ? 'Won by ' + winner : 'Picked by ' + EVENT.pickers}</span>
      </div>
      <div className="ex-city">
        <span className="ex-k">First place in each city</span>
        <Tube scene="neo" cfg={cfg} f={F} className="ex-tube" />
        <p className="ex-what" data-sk-skip>{c ? cap(c) : 'To be announced'}</p>
        <ul className="ex-codes" aria-label="One in each of the ten cities">{CITIES.map((x) => <li key={x.id}>{CODE[x.id]}</li>)}</ul>
      </div>
    </section>
  );
}
