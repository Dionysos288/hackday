'use client';
import { FRAME } from '@/components/shared/page-parts';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { CITIES, TA, sched } from '@/lib/day-data';
import { hhmm } from '@/lib/format';
import { BOUNDS as HB, CHOICES as HC, DEF as HD, clampCfg, moments, pageVars, world, type Carry, type HomeCfg, type HomeWorld } from '@/lib/home';
import { param, type Query } from '@/lib/clock';
import { DayProvider } from '@/components/home/day-context';
import { HomeMain } from '@/components/home/home-main';
import { HomeMasthead } from '@/components/home/home-masthead';
import { Timetable } from '@/components/home/timetable';
import { Pick } from '@/components/home/pick';
import { ArchivedRow } from '@/components/home/archived-row';
import { HomeFooter, HowItWorks, PastHackathons, Questions } from '@/components/home/below';
import { DayLayouts } from './day-layouts';
import { LabPanel, LayoutPicker, greenShare, meterText, replayArrival, togglePanel, useLabSave, type Group } from './lab-kit';
import '@/components/home/day.css';
import '@/components/shared/view-transitions.css';
import './lab-legacy.css';
import './day-lab.css';

/* The tuning page for the home: the real home, driven by the config's t (0 to 1 across the day; 0.94 and up is the
   day after) instead of the clock, three more layouts, the knob panel and Save (saved/day.config.json).
   Keys: 1-4 layouts, left/right move time 15 min (shift: 1 h), N new seed, R replay arrival, P play the day, G grid,
   S save, \ panel. Click empty ground for a new seed. */
const MODES: [string, string][] = [['timetable', 'Timetable'], ['index', 'Index'], ['wall', 'Wall'], ['dial', 'Dial']];
const LAB_DEF = { moves: 'line', bar: 'solid', join: 'bracket', grid: 0, vp: 'fit', you: 4 };
const EXTRA = {
  def: LAB_DEF,
  bounds: { grid: [0, 1, 1] as [number, number, number] },
  choices: { mode: MODES.map((m) => m[0]), ground: ['night', 'paper', 'mint', 'local'], moves: ['line', 'day'], bar: ['solid', 'outline', 'tint'], join: ['bracket', 'funnel', 'radial'], vp: ['fit', '390', '768', '1440'] },
};
const BOUNDS = { ...HB, ...EXTRA.bounds }, CHOICES = { ...HC, ...EXTRA.choices };
const GROUPS: Group[] = [
  { name: 'Time', knobs: [{ k: 't', kind: 'range', label: 'Time' }, { k: 'moves', kind: 'select', label: 'What moves' }, { k: 'schedule', kind: 'select', label: 'Schedule' }, { k: 'startHour', kind: 'range', label: 'Start (local)' }, { k: 'buildMin', kind: 'range', label: 'Build, min' }, { k: 'voteAfter', kind: 'range', label: 'Vote after build, min' }, { k: 'pickAfter', kind: 'range', label: 'Pick after, min' }] },
  { name: 'Type and grid', knobs: [{ k: 'display', kind: 'range', label: 'Display size' }, { k: 'ratio', kind: 'range', label: 'Type ratio' }, { k: 'row', kind: 'range', label: 'Row height' }, { k: 'slope', kind: 'range', label: 'Cascade slope' }, { k: 'hair', kind: 'range', label: 'Hairline' }, { k: 'vp', kind: 'select', label: 'Viewport' }, { k: 'grid', kind: 'toggle', label: 'Grid overlay' }] },
  { name: 'Tone', knobs: [{ k: 'ground', kind: 'select', label: 'Ground' }, { k: 'band', kind: 'range', label: 'Daylight band' }, { k: 'soft', kind: 'range', label: 'Band softness' }, { k: 'green', kind: 'range', label: 'Green budget' }, { k: 'you', kind: 'range', label: 'Your city' }] },
  { name: 'Pieces', knobs: [{ k: 'shot', kind: 'range', label: 'Screenshot' }, { k: 'bar', kind: 'select', label: 'Running bar' }, { k: 'join', kind: 'select', label: 'Join' }, { k: 'peek', kind: 'toggle', label: 'Hover peek' }, { k: 'seal', kind: 'toggle', label: 'Seal' }] },
  { name: 'Motion', knobs: [{ k: 'speed', kind: 'range', label: 'Motion speed' }, { k: 'reduced', kind: 'toggle', label: 'Reduced motion' }] },
];
const URL_KEYS = ['seed', 't', 'mode', 'ground', 'vp', 'join', 'bar', 'moves', 'schedule', 'display', 'row', 'grid', 'reduced', 'you', 'green', 'seal'];

/* ground "local": paper while it is day in your city */
function groundOf(c: HomeCfg, W: HomeWorld): string {
  if (c.ground !== 'local') return c.ground;
  const you = W.cs[c.you >= 0 ? c.you : 6], lm = (((W.now + you.city.offset) % 1440) + 1440) % 1440;
  return lm >= you.city.rise && lm < you.city.set ? 'paper' : 'night';
}
/* the now line is a 2px stroke inside a strip-wide box; the dial's lines and circles are strokes too */
function weigh(e: Element, r: DOMRect): number {
  if (e.tagName === 'circle') return 0.12;
  if (e.tagName === 'line' || e.tagName === 'g') return 2 / Math.max(1, Math.max(r.width, r.height)) * 1.4;
  return e.classList.contains('now') ? 2 / Math.max(1, r.width) : 1;
}
const CLOCK = { at: 0, preview: false, still: false };

export function DayLab({ saved, q }: { saved: Partial<HomeCfg>; q: Query }) {
  const [cfg, setCfg] = useState<HomeCfg>(() => {
    const c = { ...HD, ...LAB_DEF, ...saved } as HomeCfg; delete c.now;
    URL_KEYS.forEach((k) => { const v = param(q, k); if (v != null) (c as Record<string, unknown>)[k] = v; });
    clampCfg(c, EXTRA);
    const mm = param(q, 'moment'), m = mm ? moments(c).find((x) => x[0] === mm) : null; if (m) c.t = m[2];
    return c;
  });
  const panelOn = param(q, 'panel') !== '0';
  const set = useCallback((k: string, v: unknown) => setCfg((c) => clampCfg({ ...c, [k]: v } as HomeCfg, EXTRA)), []);
  const W = useMemo(() => world(cfg), [cfg]);
  const ground = groundOf(cfg, W);
  const pcfg = useMemo(() => ({ ...cfg, ground }), [cfg, ground]);
  const carry = useMemo<Carry>(() => ({ preview: false, still: false, ground, lab: { panel: panelOn } }), [ground, panelOn]);
  const { save, msg, rail } = useLabSave('day', 'day-saved');
  const doSave = useCallback(() => { const out: Record<string, unknown> = { ...clampCfg({ ...cfg }, EXTRA) }; delete out.now; return save(out); }, [cfg, save]);

  /* the URL follows the layout and the time, so a reload lands on the same view */
  useEffect(() => { const u = new URL(location.href); u.searchParams.set('mode', cfg.mode); u.searchParams.set('t', (+cfg.t).toFixed(3)); history.replaceState(null, '', u); }, [cfg.mode, cfg.t]);
  useEffect(() => { if (!panelOn) document.documentElement.classList.add('lab-closed', 'no-lab'); }, [panelOn]);
  /* the green meter reads the page as drawn */
  const [meter, setMeter] = useState({ text: '', bad: false });
  useEffect(() => { const id = requestAnimationFrame(() => { const g = greenShare(document.querySelector('#day .dl-page'), weigh); setMeter({ text: meterText(g), bad: g >= 5 }); }); return () => cancelAnimationFrame(id); }, [cfg]);

  const newSeed = useCallback(() => set('seed', 1 + Math.floor(Math.random() * 9999)), [set]);
  const replay = useCallback(() => replayArrival('day-intro', cfg.speed, !!cfg.reduced), [cfg.speed, cfg.reduced]);
  /* play the day: t runs from here to the end in 24 seconds */
  const playing = useRef(0);
  const play = useCallback(() => {
    if (playing.current) { cancelAnimationFrame(playing.current); playing.current = 0; return; }
    const from0 = cfg.t >= TA - 0.001 ? 0 : cfg.t, t0 = performance.now(), len = 24000 / cfg.speed; let lastR = 0;
    const step = (ts: number) => { const t = Math.min(TA - 0.0005, from0 + (ts - t0) / len * TA); if (ts - lastR > 33 || t >= TA - 0.0005) { lastR = ts; set('t', t); } playing.current = t < TA - 0.0005 ? requestAnimationFrame(step) : 0; };
    playing.current = requestAnimationFrame(step);
  }, [cfg.t, cfg.speed, set]);
  useEffect(() => () => cancelAnimationFrame(playing.current), []);
  const replayPick = useCallback(() => { const ms = moments(cfg); set('t', ms[3][2]); window.setTimeout(() => set('t', ms[4][2]), 50); }, [cfg, set]);

  /* keys; the arrows move time here */
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target as HTMLElement | null; if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
      const S = sched(cfg), stepT = (e.shiftKey ? 60 : 15) / (S.winEnd - S.winStart) * TA, k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); set('t', Math.min(1, Math.max(0, cfg.t + (k === 'ArrowRight' ? stepT : -stepT)))); }
      else if (/^[1-4]$/.test(k)) set('mode', MODES[+k - 1][0]);
      else if (k === 'n' || k === 'N') newSeed();
      else if (k === 'r' || k === 'R') replay();
      else if (k === 'p' || k === 'P') play();
      else if (k === 'g' || k === 'G') set('grid', cfg.grid ? 0 : 1);
      else if (k === 's' || k === 'S') doSave();
      else if (k === '\\') togglePanel();
    };
  });
  useEffect(() => { const on = (e: KeyboardEvent) => keyRef.current(e); document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on); }, []);
  /* a click on empty ground draws a new seed; a click on a row opens that city's tuning page; in-page anchors are stubs */
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement, a = t.closest('a');
    if (a) { if (/^#/.test(a.getAttribute('href') || '')) e.preventDefault(); return; }
    if (t.closest('button, input, select, label, dialog')) return;
    const go = t.closest('.row')?.querySelector<HTMLAnchorElement>('a[href^="/lab/city"]'); if (go) { go.click(); return; }
    newSeed();
  };

  const ms = moments(cfg); let cur = 0; ms.forEach((m, i) => { if (cfg.t >= m[2] - 0.0006) cur = i; });
  const out = (k: string) => k === 't' ? (W.archived ? 'after' : hhmm(W.now)) : k === 'you' ? (cfg.you < 0 ? 'none' : CITIES[cfg.you].name) : String(cfg[k]);
  const frame = FRAME + (cfg.grid ? ' grid-on' : '') + (cfg.reduced ? ' rm' : '') + (!cfg.peek ? ' no-peek' : '');
  return (
    <>
      <div className={frame} id="day" data-mode={cfg.mode} data-vp={String(cfg.vp)} data-join={String(cfg.join)} data-bar={String(cfg.bar)} onClick={onClick}>
        <DayProvider cfg={pcfg} clock={CLOCK} carry={carry} live={false}>
          <HomeMain style={pageVars(cfg) as CSSProperties}>
            {cfg.mode === 'timetable' ? <><HomeMasthead /><Timetable /></> : <DayLayouts mode={cfg.mode} />}
            <Pick />
            <HowItWorks c={cfg} />
            <Questions />
            <PastHackathons first={<ArchivedRow />} />
            <HomeFooter />
          </HomeMain>
        </DayProvider>
        <div className="dl-grid" aria-hidden="true" />
      </div>
      {panelOn ? (
        <LabPanel title="Day lab" cfg={cfg} bounds={BOUNDS} choices={CHOICES} groups={GROUPS} set={set} moments={ms} momentIdx={cur} out={out}
          optionLabel={(k, v) => (k === 'vp' && v !== 'fit' ? v + ' px' : v)}
          buttons={[['New seed', newSeed], ['Play the day', play], ['Replay arrival', replay], ['Replay pick', replayPick], ['Save', doSave, true]]}
          meter={meter} msg={msg} rail={rail} railLabel={(s) => (MODES.find((m) => m[0] === s.mode)?.[1] || String(s.mode)) + ' #' + s.seed}
          apply={(s) => setCfg(clampCfg({ ...HD, ...LAB_DEF, ...s } as HomeCfg, EXTRA))} />
      ) : null}
      <LayoutPicker modes={MODES} mode={cfg.mode} setMode={(m) => set('mode', m)} replay={replay} />
    </>
  );
}
