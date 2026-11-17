'use client';
import { FRAME } from '@/components/shared/page-parts';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react';
import { CITIES, TA, sched } from '@/lib/day-data';
import { hhmm } from '@/lib/format';
import { BOUNDS as HB, CHOICES as HC, DEF as HD, clampCfg, moments, pageVars, view, world, type Carry, type HomeCfg } from '@/lib/home';
import { param, type Query } from '@/lib/clock';
import { DayProvider } from '@/components/home/day-context';
import { HomeMain } from '@/components/home/home-main';
import { LabPanel, LayoutPicker, greenShare, meterText, replayArrival, togglePanel, useLabSave, type Group } from './lab-kit';
import { LabFold, LabHomeProvider, zoomGain, type Dir, type HoverMode, type LabHome, type Round, type WireMode, type Zoom } from './home/parts';
import { BelowToday } from './home/below-today';
import { Diagram } from '@/components/home/final';
import { Ledger } from './home/ledger';
import { PrizeObject } from './home/prize-object';
import { CitiesFooter, HomeQuestions } from '@/components/home/final-parts';
import { Baseline } from './home/baseline';
import { Sheet } from '@/components/home/sheet';
import { FrontPage } from './home/front-page';
import { Focus } from './home/focus';
import '@/components/home/day.css';
import '@/components/shared/view-transitions.css';
import '@/components/home/sheet.css';
import './day-lab.css';
import './home/home-lab.css';

/* The revamp's tuning page for the home, in two rounds, driven by the config's t instead of the clock.
   Round 1 (round=first): the first viewport. Today's home as the baseline, and three directions (Sheet, Front page,
   Focus) on the same model; each direction keeps its own sizes.
   Round 3 (round=final): below the picked first viewport (Sheet). Today's home below the fold as the baseline, and
   three ways to show the final and the prizes (One diagram, Ledger, The object), each followed by the questions and
   the footer in the new format.
   Save writes saved/lab-home.config.json. The real home (Sheet + One diagram) reads its look from it: the Sheet's
   sizes, City names, the wire, the hover preview, the strip zoom, the prizes in the facts, and the diagram's two knobs.
   Keys: 1-4 the
   round's directions, left/right move time 15 min (shift: 1 h), N new seed, G grid, S save, \ panel. */
const DIRS: [Dir, string][] = [['baseline', 'Baseline'], ['sheet', 'Sheet'], ['front', 'Front page'], ['focus', 'Focus']];
/* round 3: below the picked first viewport (Sheet) */
type Below = 'today' | 'diagram' | 'ledger' | 'object';
const BELOWS: [Below, string][] = [['today', 'Today'], ['diagram', 'One diagram'], ['ledger', 'Ledger'], ['object', 'The object']];
const SIZE_KEYS: Record<Exclude<Dir, 'baseline'>, [string, string, string]> = { sheet: ['sheetNm', 'sheetRh', 'sheetSw'], front: ['frontNm', 'frontRh', 'frontSw'], focus: ['focusNm', 'focusRh', 'focusSw'] };
const SIZE_LABELS: Record<Exclude<Dir, 'baseline'>, [string, string, string]> = {
  sheet: ['City name, px', 'Row height, px', 'Slot, columns'],
  front: ['Title, px', 'Row height (below the fold), px', 'Slot, columns'],
  focus: ['Title, px', 'Open row height, px', 'Slot, columns'],
};
const LAB_DEF = {
  round: 'final', below: 'diagram', finRh: 18, curve: 50, objDim: 1, factPrizes: 0,
  dir: 'sheet', names: 'stacked', worst: 1, you: 4, wire: 'list', hover: 'strip', zoom: 'day', grid: 0, vp: 'fit',
  sheetNm: 44, sheetRh: 64, sheetSw: 3, frontNm: 128, frontRh: 88, frontSw: 4, focusNm: 72, focusRh: 136, focusSw: 3,
};
type R = [number, number, number];
const EXTRA = {
  def: LAB_DEF,
  bounds: {
    worst: [0, 1, 1] as R, grid: [0, 1, 1] as R, finRh: [16, 28, 2] as R, curve: [20, 80, 5] as R, objDim: [0, 1, 1] as R, factPrizes: [0, 1, 1] as R,
    sheetNm: [32, 64, 4] as R, sheetRh: [56, 88, 4] as R, sheetSw: [2, 4, 1] as R,
    frontNm: [80, 160, 8] as R, frontRh: [64, 112, 4] as R, frontSw: [3, 5, 1] as R,
    focusNm: [48, 96, 4] as R, focusRh: [120, 176, 8] as R, focusSw: [2, 4, 1] as R,
  },
  choices: { round: ['first', 'final'], below: BELOWS.map((d) => d[0]), dir: DIRS.map((d) => d[0]), names: ['stacked', 'ruled'], wire: ['off', 'sentence', 'list'], hover: ['off', 'strip', 'pointer', 'docked'], zoom: ['day', 'fitted', 'folded'], vp: ['fit', '390', '768', '1440'] },
};
const BOUNDS = { ...HB, ...EXTRA.bounds }, CHOICES = { ...HC, ...EXTRA.choices };
const URL_KEYS = ['seed', 't', 'round', 'below', 'dir', 'names', 'ground', 'vp', 'worst', 'wire', 'hover', 'zoom', 'you', 'grid', 'schedule'];
/* the now line is a 2px stroke inside a strip-wide box */
function weigh(e: Element, r: DOMRect): number { return e.classList.contains('now') ? 2 / Math.max(1, r.width) : 1; }
const CLOCK = { at: 0, preview: false, still: false };

export function HomeLab({ saved, q }: { saved: Partial<HomeCfg>; q: Query }) {
  const [cfg, setCfg] = useState<HomeCfg>(() => {
    const c = { ...HD, ...LAB_DEF, ...saved } as HomeCfg; delete c.now;
    URL_KEYS.forEach((k) => { const v = param(q, k); if (v != null) (c as Record<string, unknown>)[k] = v; });
    clampCfg(c, EXTRA);
    const mm = param(q, 'moment'), m = mm ? moments(c).find((x) => x[0] === mm) : null; if (m) c.t = m[2];
    return c;
  });
  const panelOn = param(q, 'panel') !== '0';
  const set = useCallback((k: string, v: unknown) => setCfg((c) => clampCfg({ ...c, [k]: v } as HomeCfg, EXTRA)), []);
  const round = cfg.round as Round, below = cfg.below as Below;
  /* round 3 is built on the picked first viewport: Sheet */
  const dir = (round === 'final' ? 'sheet' : cfg.dir) as Dir, W = useMemo(() => world(cfg), [cfg]);
  const carry = useMemo<Carry>(() => ({ preview: false, still: false, ground: cfg.ground, lab: { panel: panelOn } }), [cfg.ground, panelOn]);
  const { save, msg, rail } = useLabSave('lab-home', 'lab-home-saved');
  const doSave = useCallback(() => { const out: Record<string, unknown> = { ...clampCfg({ ...cfg }, EXTRA) }; delete out.now; return save(out); }, [cfg, save]);

  /* the URL follows the direction and the time, so a reload lands on the same view */
  useEffect(() => {
    const u = new URL(location.href); u.searchParams.set('round', round); u.searchParams.set(round === 'final' ? 'below' : 'dir', round === 'final' ? below : dir);
    u.searchParams.set('t', (+cfg.t).toFixed(3)); u.searchParams.delete('moment'); history.replaceState(null, '', u);
  }, [round, below, dir, cfg.t]);
  useEffect(() => { if (!panelOn) document.documentElement.classList.add('lab-closed', 'no-lab'); }, [panelOn]);
  const [meter, setMeter] = useState({ text: '', bad: false });
  useEffect(() => { const id = requestAnimationFrame(() => { const g = greenShare(document.querySelector('#day .dl-page'), weigh); setMeter({ text: meterText(g), bad: g >= 5 }); }); return () => cancelAnimationFrame(id); }, [cfg]);

  const newSeed = useCallback(() => set('seed', 1 + Math.floor(Math.random() * 9999)), [set]);
  const replay = useCallback(() => replayArrival('day-intro', cfg.speed, !!cfg.reduced), [cfg.speed, cfg.reduced]);
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    keyRef.current = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tg = e.target as HTMLElement | null; if (tg && (/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName) || tg.isContentEditable)) return;
      const S = sched(cfg), stepT = (e.shiftKey ? 60 : 15) / (S.winEnd - S.winStart) * TA, k = e.key;
      if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); set('t', Math.min(1, Math.max(0, cfg.t + (k === 'ArrowRight' ? stepT : -stepT)))); }
      else if (/^[1-4]$/.test(k)) { if (cfg.round === 'final') set('below', BELOWS[+k - 1][0]); else set('dir', DIRS[+k - 1][0]); }
      else if (k === 'n' || k === 'N') newSeed();
      else if (k === 'g' || k === 'G') set('grid', cfg.grid ? 0 : 1);
      else if (k === 's' || k === 'S') doSave();
      else if (k === '\\') togglePanel();
    };
  });
  useEffect(() => { const on = (e: KeyboardEvent) => keyRef.current(e); document.addEventListener('keydown', on); return () => document.removeEventListener('keydown', on); }, []);
  /* an in-page anchor scrolls when what it points at is on this page, and is a stub otherwise; a city's name opens its
     tuning page */
  const onClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a'), h = a?.getAttribute('href') || '';
    if (a && /^#/.test(h) && !(h.length > 1 && document.getElementById(h.slice(1)))) e.preventDefault();
  };

  const sk = dir === 'baseline' ? null : SIZE_KEYS[dir];
  const sizes = sk ? { nm: +(cfg[sk[0]] as number), rh: +(cfg[sk[1]] as number), sw: +(cfg[sk[2]] as number) } : { nm: 48, rh: 72, sw: 2 };
  const lab = useMemo<LabHome>(() => ({ dir, sizes, wire: cfg.wire as WireMode, hover: cfg.hover as HoverMode, zoom: cfg.zoom as Zoom, round, factPrizes: !!cfg.factPrizes }), [dir, sizes.nm, sizes.rh, sizes.sw, cfg.wire, cfg.hover, cfg.zoom, round, cfg.factPrizes]); // eslint-disable-line react-hooks/exhaustive-deps
  const finalKnobs = below === 'diagram' ? [{ k: 'finRh', kind: 'range' as const, label: 'A place’s row, px' }, { k: 'curve', kind: 'range' as const, label: 'Where the lines bend, %' }]
    : below === 'object' ? [{ k: 'objDim', kind: 'toggle' as const, label: 'Dimension lines' }] : [];
  const groups: Group[] = [
    { name: 'Round', knobs: [{ k: 'round', kind: 'select', label: 'Round' }, ...(round === 'final' ? [{ k: 'below', kind: 'select' as const, label: 'Below the fold' }, ...finalKnobs] : [])] },
    { name: round === 'final' ? 'First viewport (Sheet)' : 'Direction', knobs: [{ k: 'names', kind: 'select', label: 'City names' }, { k: 'zoom', kind: 'select', label: 'Strip zoom' }, { k: 'wire', kind: 'select', label: 'The wire' }, { k: 'hover', kind: 'select', label: 'Hover preview' }, { k: 'factPrizes', kind: 'toggle', label: 'Prizes in the facts' }] },
    ...(sk ? [{ name: 'Sizes: ' + DIRS.find((d) => d[0] === dir)![1], knobs: sk.map((k, i) => ({ k, kind: 'range' as const, label: SIZE_LABELS[dir as Exclude<Dir, 'baseline'>][i] })) }] : []),
    { name: 'Time and content', knobs: [{ k: 't', kind: 'range', label: 'Time' }, { k: 'schedule', kind: 'select', label: 'Schedule' }, { k: 'worst', kind: 'toggle', label: 'Worst content' }, { k: 'you', kind: 'range', label: 'Your city' }] },
    { name: 'View', knobs: [{ k: 'ground', kind: 'select', label: 'Ground' }, { k: 'vp', kind: 'select', label: 'Viewport' }, { k: 'grid', kind: 'toggle', label: 'Grid overlay' }] },
  ];
  const ms = moments(cfg); let cur = 0; ms.forEach((m, i) => { if (cfg.t >= m[2] - 0.0006) cur = i; });
  const gain = cfg.zoom === 'day' ? '' : ' (an hour is ' + zoomGain(W, view(cfg, W), cfg.zoom as Zoom).toFixed(2) + '× as wide)';
  const out = (k: string) => k === 't' ? (W.archived ? 'after' : hhmm(W.now)) : k === 'you' ? (cfg.you < 0 ? 'none' : CITIES[cfg.you].name) : k === 'zoom' ? cfg.zoom + gain : String(cfg[k]);
  const frame = FRAME + ' hs-on' + (cfg.grid ? ' grid-on' : '');
  const style = { ...pageVars(cfg), '--hs-nm': sizes.nm, '--hs-rh': sizes.rh, '--hs-sw': sizes.sw } as CSSProperties;
  return (
    <>
      <div className={frame} id="day" data-mode={dir === 'baseline' ? 'timetable' : dir} data-dir={dir} data-round={round} data-below={round === 'final' ? below : undefined} data-names={String(cfg.names)} data-vp={String(cfg.vp)} onClick={onClick}>
        <DayProvider cfg={cfg} clock={CLOCK} carry={carry} live={false}>
          <LabHomeProvider value={lab}>
            <HomeMain style={style}>
              {dir === 'baseline' ? <Baseline /> : dir === 'sheet' ? <Sheet /> : dir === 'front' ? <FrontPage /> : <Focus />}
              {round === 'first' ? <LabFold /> : below === 'today' ? <BelowToday /> : (
                <>
                  {below === 'diagram' ? <Diagram finRh={Number(cfg.finRh)} curve={Number(cfg.curve)} /> : below === 'ledger' ? <Ledger /> : <PrizeObject dim={!!cfg.objDim} />}
                  <HomeQuestions />
                  <CitiesFooter />
                </>
              )}
            </HomeMain>
          </LabHomeProvider>
        </DayProvider>
        <div className="dl-grid" aria-hidden="true" />
      </div>
      {panelOn ? (
        <LabPanel title={round === 'final' ? 'Home lab · round 3' : 'Home lab · round 1'} cfg={cfg} bounds={BOUNDS} choices={CHOICES} groups={groups} set={set} moments={ms} momentIdx={cur} out={out}
          optionLabel={(k, v) => (k === 'vp' && v !== 'fit' ? v + ' px' : v)}
          buttons={[['New seed', newSeed], ['Save', doSave, true]]}
          meter={meter} msg={msg} rail={rail} railLabel={(s) => (s.round === 'final' ? 'Sheet + ' + (BELOWS.find((d) => d[0] === s.below)?.[1] || String(s.below)) : DIRS.find((d) => d[0] === s.dir)?.[1] || String(s.dir)) + ' #' + s.seed}
          apply={(s) => setCfg(clampCfg({ ...HD, ...LAB_DEF, ...s } as HomeCfg, EXTRA))} />
      ) : null}
      {round === 'final'
        ? <LayoutPicker modes={BELOWS} mode={below} setMode={(m) => set('below', m)} replay={replay} />
        : <LayoutPicker modes={DIRS} mode={dir} setMode={(m) => set('dir', m)} replay={replay} />}
    </>
  );
}
