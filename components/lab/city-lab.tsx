'use client';
import { FRAME } from '@/components/shared/page-parts';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { CITIES, TA, nowOf, tOf } from '@/lib/day-data';
import { BOUNDS as CB, CHOICES as CC, DEF as CD, clampCfg, local, moments, tAt, win, world, type CityCfg, type Links } from '@/lib/city';
import { param, type Query } from '@/lib/clock';
import { CityProvider } from '@/components/city/city-context';
import { CityMain } from '@/components/city/city-main';
import { CityMasthead, CityTitle } from '@/components/city/city-masthead';
import { EntriesTable, Ledger, RestOfDay } from '@/components/city/below-sheet';
import { CityFooter, CityHow } from '@/components/city/city-below';
import { ProjectSheet } from '@/components/city/project-sheet';
import { CitySheet } from './city-layouts';
import { LabPanel, LayoutPicker, greenShare, meterText, replayArrival, togglePanel, useLabSave, type Group } from './lab-kit';
import '@/components/home/day.css';
import '@/components/shared/view-transitions.css';
import '@/components/city/city.css';
import './lab-legacy.css';
import './day-lab.css';
import './city-lab.css';

/* The tuning page for a city (/lab/city-sheet): the real city page, driven by the config's t (a position in the city's window, from an
   hour before it starts to half an hour after the pick), played forward at the Live clock rate. Three more layouts,
   the knob panel and Save (saved/city.config.json). ?ht= takes the home lab's clock, so a link from it lands on the
   same moment. Keys (besides J, K, V, Enter, Escape): 1-4 layouts, left/right move time 5 min (shift: 30), N new seed,
   R replay arrival, G grid, S save, \ panel. */
const MODES: [string, string][] = [['tower', 'Tower'], ['race', 'Race'], ['gallery', 'Gallery'], ['leader', 'Leader']];
const LAB_DEF = { title: 'band', mini: 'cascade', grid: 0, vp: 'fit', you: 12 };
const EXTRA = {
  def: LAB_DEF,
  bounds: { grid: [0, 1, 1] as [number, number, number] },
  choices: { mode: MODES.map((m) => m[0]), title: ['band', 'poster'], mini: ['cascade', 'ticks'], vp: ['fit', '390', '768', '1440'] },
};
const BOUNDS = { ...CB, ...EXTRA.bounds }, CHOICES = { ...CC, ...EXTRA.choices };
const R = (k: string, label: string) => ({ k, kind: 'range' as const, label }), Sl = (k: string, label: string) => ({ k, kind: 'select' as const, label }), T = (k: string, label: string) => ({ k, kind: 'toggle' as const, label });
const GROUPS: Group[] = [
  { name: 'Time', knobs: [R('t', 'Time'), R('rate', 'Live clock'), R('reorder', 'Reorder every'), Sl('schedule', 'Schedule'), R('startHour', 'Start (local)'), R('buildMin', 'Build, min'), R('voteAfter', 'Vote after build, min'), R('pickAfter', 'Pick after, min')] },
  { name: 'City', knobs: [Sl('city', 'City'), R('you', 'Your entry'), Sl('ground', 'Ground')] },
  { name: 'Type and grid', knobs: [R('top', 'Top count'), R('row', 'Row height'), R('nameSize', 'Name size'), R('disp', 'City size'), Sl('title', 'Title'), R('table', 'Table row'), Sl('vp', 'Viewport'), T('grid', 'Grid overlay')] },
  { name: 'Pieces', knobs: [Sl('strip', 'Strip shows'), R('trace', 'Trace weight'), Sl('cut', 'Cut line'), Sl('ledger', 'Latest votes'), R('pic', 'Picture'), T('peek', 'Hover peek'), Sl('mini', 'Mini day'), T('seal', 'Seal')] },
  { name: 'Motion', knobs: [R('speed', 'Motion speed'), T('reduced', 'Reduced motion')] },
];
const URL_KEYS = ['seed', 't', 'city', 'mode', 'ground', 'vp', 'grid', 'reduced', 'you', 'top', 'row', 'title', 'strip', 'cut', 'ledger', 'mini', 'rate', 'sort', 'q', 'seal', 'peek', 'pic', 'nameSize', 'disp', 'trace', 'table', 'reorder'];
/* the now line is a 2px stroke inside a strip-wide box; green text covers about a quarter of its box */
function weigh(e: Element, r: DOMRect): number { if (e.classList.contains('ft-pick') || e.classList.contains('you')) return 0.25; return e.classList.contains('now') ? 2 / Math.max(1, r.width) : 1; }
const CLOCK = { at: 0, preview: false, still: false };
type Held = { t: number; city: string; now: number } | null;

export function CityLab({ saved, q }: { saved: Partial<CityCfg>; q: Query }) {
  const still = param(q, 'still') === '1', panelOn = param(q, 'panel') !== '0';
  /* a home-lab clock earlier than this city's window (the city starts hours later) is held as that minute, so the
     countdown matches the home row; any change of time lets it go */
  const [init] = useState(() => {
    const c = { ...CD, ...LAB_DEF, ...saved } as CityCfg; delete c.now; let held: Held = null;
    URL_KEYS.forEach((k) => { const v = param(q, k); if (v != null) (c as Record<string, unknown>)[k] = v; });
    if (still) c.rate = 0;
    clampCfg(c, EXTRA);
    const ht = param(q, 'ht'), mm = param(q, 'moment');
    if (ht != null && isFinite(+ht)) { const Wn = win(c), hm = nowOf(+ht, Wn.S); c.t = +ht >= TA ? 1 : tAt(hm, Wn); if (+ht < TA && hm < Wn.w0) held = { t: c.t, city: c.city, now: hm }; }
    if (mm) { const m = moments(c).find((x) => x[0] === mm); if (m) c.t = m[2]; }
    if (c.t < 0) c.t = moments(c)[2][2];
    return { c, held };
  });
  const [cfg, setCfg] = useState<CityCfg>(init.c), [held, setHeld] = useState<Held>(init.held), [frame, setFrame] = useState<'live' | 'set'>('set');
  const set = useCallback((k: string, v: unknown) => {
    setFrame('set');
    setCfg((c) => {
      const n = { ...c, [k]: v } as CityCfg;
      /* a new city keeps the moment of the day */
      if (k === 'city') { const Wo = win(c), m = held && held.city === c.city ? held.now : Wo.w0 + c.t * (Wo.w1 - Wo.w0); clampCfg(n, EXTRA); n.t = tAt(nowOf(tOf(m, Wo.S), win(n).S), win(n)); }
      return clampCfg(n, EXTRA);
    });
  }, [held]);
  const pcfg = useMemo(() => (held && held.t === cfg.t && held.city === cfg.city ? { ...cfg, now: held.now } : cfg), [cfg, held]);
  /* the held minute lets go for good once the moment or the city changes */
  if (held && (held.t !== cfg.t || held.city !== cfg.city)) setHeld(null);
  const W = useMemo(() => world(pcfg, {}), [pcfg]);
  const links = useMemo<Links>(() => ({ kind: 'lab', preview: false, still: false, panel: panelOn }), [panelOn]);
  const { save, msg, rail } = useLabSave('city', 'city-saved');
  const doSave = useCallback(() => { const out: Record<string, unknown> = { ...clampCfg({ ...cfg }, EXTRA) }; delete out.now; return save(out); }, [cfg, save]);

  /* the live clock: other people's votes are the shared data played forward at the rate, so this page and the home
     lab keep agreeing. Runs while building and voting, never in stills. */
  const live = useRef({ W, cfg });
  useEffect(() => { live.current = { W, cfg }; }, [W, cfg]);
  useEffect(() => {
    let raf = 0, tickT = performance.now();
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const { W: w, cfg: c } = live.current;
      if (!c.rate || still || document.hidden || (w.state !== 'vote' && w.state !== 'build')) { tickT = ts; return; }
      if (ts - tickT < 250) return;
      const dt = Math.min(1000, ts - tickT) / 60000 * c.rate, Wn = win(c); tickT = ts;
      setFrame('live'); setCfg((x) => ({ ...x, t: Math.min(1, Math.max(0, x.t + dt / (Wn.w1 - Wn.w0))) }));
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [still]);

  /* the URL follows the city, the layout and the time (every two seconds while the clock runs) */
  const urlT = useRef(0);
  useEffect(() => {
    const tn = performance.now(); if (frame === 'live' && tn - urlT.current <= 2000) return; urlT.current = tn;
    const u = new URL(location.href); u.searchParams.delete('ht'); u.searchParams.delete('moment');
    u.searchParams.set('city', cfg.city); u.searchParams.set('mode', cfg.mode); u.searchParams.set('t', (+cfg.t).toFixed(4));
    history.replaceState(null, '', u);
  }, [cfg.city, cfg.mode, cfg.t, frame]);
  useEffect(() => { if (!panelOn) document.documentElement.classList.add('lab-closed', 'no-lab'); }, [panelOn]);
  const [meter, setMeter] = useState({ text: '', bad: false });
  useEffect(() => { if (frame === 'live') return; const id = requestAnimationFrame(() => { const g = greenShare(document.querySelector('#city .dl-page'), weigh); setMeter({ text: meterText(g), bad: g >= 5 }); }); return () => cancelAnimationFrame(id); }, [cfg, frame]);

  const newSeed = useCallback(() => set('seed', 1 + Math.floor(Math.random() * 9999)), [set]);
  const replay = useCallback(() => replayArrival('city-intro', cfg.speed, !!cfg.reduced), [cfg.speed, cfg.reduced]);
  /* keys the page does not have; the arrows move time here */
  const onKey = useCallback((e: KeyboardEvent) => {
    const c = live.current.cfg, k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); const Wn = win(c), st = (e.shiftKey ? 30 : 5) / (Wn.w1 - Wn.w0); set('t', Math.min(1, Math.max(0, c.t + (k === 'ArrowRight' ? st : -st)))); }
    else if (/^[1-4]$/.test(k)) set('mode', MODES[+k - 1][0]);
    else if (k === 'n' || k === 'N') newSeed();
    else if (k === 'r' || k === 'R') replay();
    else if (k === 'g' || k === 'G') set('grid', c.grid ? 0 : 1);
    else if (k === 's' || k === 'S') doSave();
    else if (k === '\\') togglePanel();
  }, [set, newSeed, replay, doSave]);
  /* in-page anchors are stubs here; a click on empty ground draws a new seed */
  const onClick = (e: MouseEvent) => {
    const t = e.target as HTMLElement, a = t.closest('a');
    if (a && /^#(?!sheet)/.test(a.getAttribute('href') || '') && !a.hasAttribute('data-row')) { e.preventDefault(); return; }
    if (t.closest('a, button, input, select, label, dialog')) return;
    newSeed();
  };

  const ms = moments(cfg); let cur = -1; ms.forEach((m, i) => { if (Math.abs(cfg.t - m[2]) < 0.0008) cur = i; });
  const out = (k: string) => k === 't' ? local(W, W.now) : k === 'you' ? (cfg.you < 0 ? 'none' : '#' + (cfg.you + 1)) : k === 'rate' ? (cfg.rate ? cfg.rate + '×' : 'off') : k === 'reorder' ? cfg.reorder + ' s' : String(cfg[k]);
  const fcls = FRAME + (cfg.grid ? ' grid-on' : '') + (cfg.reduced ? ' rm' : '') + (!cfg.peek ? ' no-peek' : '');
  return (
    <>
      <CityProvider cfg={pcfg} clock={CLOCK} links={links} live={false} frame={frame} extra={EXTRA} onKey={onKey}>
        <div className={fcls} id="city" data-mode={cfg.mode} data-vp={String(cfg.vp)} onClick={onClick}>
          <CityMain>
            <CityMasthead />
            <CityTitle />
            <CitySheet mode={cfg.mode} />
            <Ledger />
            <EntriesTable />
            <CityHow c={cfg} />
            <RestOfDay />
            <CityFooter c={cfg} />
          </CityMain>
          <div className="dl-grid cl" aria-hidden="true" />
        </div>
        <ProjectSheet />
      </CityProvider>
      {panelOn ? (
        <LabPanel title="City lab" cfg={cfg} bounds={BOUNDS} choices={CHOICES} groups={GROUPS} set={set} moments={ms} momentIdx={cur} out={out}
          optionLabel={(k, v) => (k === 'vp' && v !== 'fit' ? v + ' px' : k === 'city' ? CITIES.find((x) => x.id === v)!.name : v)}
          buttons={[['New seed', newSeed], ['Replay arrival', replay], ['Save', doSave, true]]}
          meter={meter} msg={msg} rail={rail} railLabel={(s) => (MODES.find((m) => m[0] === s.mode)?.[1] || String(s.mode)) + ' ' + s.city + ' #' + s.seed}
          apply={(s) => { setFrame('set'); setCfg(clampCfg({ ...CD, ...LAB_DEF, ...s } as CityCfg, EXTRA)); }} />
      ) : null}
      <LayoutPicker modes={MODES} mode={cfg.mode} setMode={(m) => set('mode', m)} replay={replay} />
    </>
  );
}
