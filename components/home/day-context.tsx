'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { CITIES, EPOCH } from '@/lib/day-data';
import { clampCfg, world, type Carry, type HomeCfg, type HomeWorld } from '@/lib/home';
import type { ClockInit } from '@/lib/clock';
import { useFormsState, type FormsState } from '@/components/forms/store';
import { applyGround } from '@/components/ground/apply-ground';

/* The home's live state: the minute on screen and the motion that follows a change. The server draws the first
   frame at clock.at; the browser starts from the same minute (so hydration matches) and then follows the clock,
   drawing again whenever the minute changes. */
export type Ages = Record<string, number>;   /* a running animation's age in ms, by row key ('s3', 'l3', 'pick') */
type DayValue = { cfg: HomeCfg; W: HomeWorld; carry: Carry; ages: Ages };
const DayContext = createContext<DayValue | null>(null);
export function useDay(): DayValue { const v = useContext(DayContext); if (!v) throw new Error('useDay outside DayProvider'); return v; }

/* the person's own city, once they have entered (the forms); without it, no row is marked as theirs */
function yourCity(st: FormsState): number {
  const id = st.entry && st.entry.city, hit = id ? CITIES.find((x) => x.id === id) : null;
  return hit ? hit.i : -1;
}

/* the lab drives the clock itself: it passes the minute (or t) in cfg and sets live to false */
export function DayProvider({ cfg: cfgIn, clock, carry, live = true, children }: { cfg: HomeCfg; clock: ClockInit; carry: Carry; live?: boolean; children: ReactNode }) {
  const you = yourCity(useFormsState());
  const cfg = useMemo(() => clampCfg({ ...cfgIn, you: cfgIn.you >= 0 && !live ? cfgIn.you : you }), [cfgIn, you, live]);
  const [tick, setTick] = useState<{ now: number; ages: Ages }>({ now: clock.at, ages: {} });
  const now = live ? tick.now : cfgIn.now;
  const W = useMemo(() => world({ ...cfg, now }), [cfg, now]);

  /* the latest config, for the clock's interval (a ref, so the interval is set up once) */
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  useEffect(() => {
    if (!live) return;
    const real = () => (Date.now() - EPOCH) / 60000;
    const offset = clock.preview ? clock.at - real() : 0;
    const clockNow = () => (clock.still ? clock.at : real() + offset);
    /* what changed since the last frame, going forward in time: a city's slot swaps, a winner's line draws, the pick */
    const started: Record<string, number> = {};
    let prev: HomeWorld | null = null, lastMin: number | null = null;
    const go = () => {
      const c = cfgRef.current, n = clockNow(), next = world({ ...c, now: n }), tnow = performance.now();
      if (prev && next.now > prev.now) {
        const p = prev;
        next.cs.forEach((x, i) => { if (p.cs[i].state === x.state) return; started['s' + i] = tnow; if (x.state === 'done') started['l' + i] = tnow; });
        if (next.picked && !p.picked) started.pick = tnow;
      }
      prev = next;
      const spd = 1 / c.speed, DUR: Record<string, number> = { s: 280 * spd, l: 480 * spd, pick: 2400 * spd };   /* --dur-panel, --dur-draw, --dur-reveal */
      const ages: Ages = {};
      Object.keys(started).forEach((k) => { const age = tnow - started[k]; if (age > DUR[k === 'pick' ? 'pick' : k[0]]) delete started[k]; else ages[k] = Math.round(age); });
      setTick({ now: n, ages });
    };
    prev = world({ ...cfgRef.current, now: clock.at });
    const id = window.setInterval(() => { const m = Math.floor(clockNow()); if (m !== lastMin && !document.hidden) { lastMin = m; go(); } }, 1000);
    document.documentElement.dataset.ready = '1';
    return () => window.clearInterval(id);
  }, [live, clock.at, clock.preview, clock.still]);

  useEffect(() => { applyGround(cfg.ground); }, [cfg.ground]);

  const value = useMemo(() => ({ cfg, W, carry, ages: live ? tick.ages : {} }), [cfg, W, carry, live, tick.ages]);
  return <DayContext.Provider value={value}>{children}</DayContext.Provider>;
}
