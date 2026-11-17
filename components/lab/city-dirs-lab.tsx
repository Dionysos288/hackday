'use client';
import { FRAME } from '@/components/shared/page-parts';
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { CITIES, TA, nowOf } from '@/lib/day-data';
import { BOUNDS as CB, CHOICES as CC, DEF as CD, clampCfg, local, moments, tAt, win, world, type CityCfg, type Links } from '@/lib/city';
import { param, type Query } from '@/lib/clock';
import { CityProvider, useCity } from '@/components/city/city-context';
import { CityMain } from '@/components/city/city-main';
import { CityMasthead, CityTitle } from '@/components/city/city-masthead';
import { EntriesTable } from '@/components/city/below-sheet';
import { FormsProvider } from '@/components/forms/forms-provider';
import { LabPanel, LayoutPicker, greenShare, meterText, togglePanel, useLabSave, type Group } from './lab-kit';
import { JudgeBar, LabCityProvider, ShareKit, YouBar, type CityDir, type PView, type Who } from './city/parts';
import { CityBaseline } from './city/baseline';
import { TowerFinal } from '@/components/city/tower-final';
import { Stage } from './city/stage';
import { Split } from './city/split';
import { ProjectView } from '@/components/city/project-view';
import '@/components/home/day.css';
import '@/components/shared/view-transitions.css';
import '@/components/city/city.css';
import '@/components/forms/forms.css';
import '@/components/city/final.css';
import './day-lab.css';
import './city/city-round.css';

/* Round 2 of the revamp's tuning pages: a city's page. Today's Tower as the baseline, the Tower with a final zone,
   Stage and Split; three ways to open a project (a side sheet, the row opening in place, a centred sheet); and the
   page as a visitor, a builder (your project always in view, the share kit) and a judge (a stepper per row, 50 votes).
   Driven by the config's t, never by the clock: layout only. Save writes saved/lab-city.config.json.
   Keys (besides J, K, V, Enter, Escape): 1-4 directions, left/right move time 5 min (shift: 30), N new seed, G grid,
   S save, \ panel. */
const DIRS: [CityDir, string][] = [['baseline', 'Baseline'], ['tower', 'Tower, final zone'], ['stage', 'Stage'], ['split', 'Split']];
const LAB_DEF = { mode: 'tower', view: 'side', who: 'visitor', share: 0, worst: 1, grid: 0, vp: 'fit', you: 12, rate: 0 };
const EXTRA = {
  def: LAB_DEF,
  bounds: { grid: [0, 1, 1] as [number, number, number], worst: [0, 1, 1] as [number, number, number], share: [0, 1, 1] as [number, number, number] },
  choices: { mode: DIRS.map((d) => d[0]), view: ['side', 'row', 'centred'], who: ['visitor', 'builder', 'judge'], vp: ['fit', '390', '768', '1440'] },
};
const BOUNDS = { ...CB, ...EXTRA.bounds }, CHOICES = { ...CC, ...EXTRA.choices };
const R = (k: string, label: string) => ({ k, kind: 'range' as const, label }), Sl = (k: string, label: string) => ({ k, kind: 'select' as const, label }), T = (k: string, label: string) => ({ k, kind: 'toggle' as const, label });
const GROUPS: Group[] = [
  { name: 'Direction', knobs: [Sl('view', 'Project opens as'), Sl('who', 'Looking as'), T('share', 'Share kit open'), R('top', 'Rows in the drawing')] },
  { name: 'Time and city', knobs: [R('t', 'Time'), Sl('city', 'City'), T('worst', 'Worst content'), R('you', 'Your entry'), Sl('schedule', 'Schedule')] },
  { name: 'Type and grid', knobs: [R('row', 'Row height'), R('nameSize', 'Name size'), R('disp', 'City size'), R('pic', 'Picture'), Sl('vp', 'Viewport'), T('grid', 'Grid overlay')] },
  { name: 'View', knobs: [Sl('ground', 'Ground')] },
];
const URL_KEYS = ['seed', 't', 'city', 'mode', 'ground', 'vp', 'grid', 'you', 'top', 'row', 'view', 'who', 'share', 'worst', 'nameSize', 'disp', 'pic', 'schedule'];
function weigh(e: Element, r: DOMRect): number { if (e.classList.contains('ft-pick') || e.classList.contains('you') || e.classList.contains('type-label')) return 0.25; return e.classList.contains('now') ? 2 / Math.max(1, r.width) : 1; }
const CLOCK = { at: 0, preview: false, still: false };

export function CityDirsLab({ saved, q }: { saved: Partial<CityCfg>; q: Query }) {
  const panelOn = param(q, 'panel') !== '0';
  const [cfg, setCfg] = useState<CityCfg>(() => {
    const c = { ...CD, ...LAB_DEF, ...saved } as CityCfg; delete c.now;
    URL_KEYS.forEach((k) => { const v = param(q, k); if (v != null) (c as Record<string, unknown>)[k] = v; });
    c.rate = 0; clampCfg(c, EXTRA);
    const ht = param(q, 'ht'), mm = param(q, 'moment');
    if (ht != null && isFinite(+ht)) { const Wn = win(c); c.t = +ht >= TA ? 1 : tAt(nowOf(+ht, Wn.S), Wn); }
    if (mm) { const m = moments(c).find((x) => x[0] === mm); if (m) c.t = m[2]; }
    if (c.t < 0) c.t = moments(c)[2][2];
    return c;
  });
  const set = useCallback((k: string, v: unknown) => setCfg((c) => clampCfg({ ...c, [k]: v } as CityCfg, EXTRA)), []);
  const who = cfg.who as Who, dir = cfg.mode as CityDir;
  /* only a builder has a project of their own on this page */
  const pcfg = useMemo(() => ({ ...cfg, you: who === 'builder' ? cfg.you : -1 }), [cfg, who]);
  const W = useMemo(() => world(pcfg, {}), [pcfg]);
  const links = useMemo<Links>(() => ({ kind: 'lab', preview: false, still: false, panel: panelOn }), [panelOn]);
  const { save, msg, rail } = useLabSave('lab-city', 'lab-city-saved');
  const doSave = useCallback(() => { const out: Record<string, unknown> = { ...clampCfg({ ...cfg }, EXTRA) }; delete out.now; return save(out); }, [cfg, save]);

  useEffect(() => {
    const u = new URL(location.href); u.searchParams.delete('ht'); u.searchParams.delete('moment');
    u.searchParams.set('city', cfg.city); u.searchParams.set('mode', dir); u.searchParams.set('t', (+cfg.t).toFixed(4));
    history.replaceState(null, '', u);
  }, [cfg.city, dir, cfg.t]);
  useEffect(() => { if (!panelOn) document.documentElement.classList.add('lab-closed', 'no-lab'); }, [panelOn]);
  const [meter, setMeter] = useState({ text: '', bad: false });
  useEffect(() => { const id = requestAnimationFrame(() => { const g = greenShare(document.querySelector('#city .dl-page'), weigh); setMeter({ text: meterText(g), bad: g >= 5 }); }); return () => cancelAnimationFrame(id); }, [cfg]);

  const newSeed = useCallback(() => set('seed', 1 + Math.floor(Math.random() * 9999)), [set]);
  const cfgRef = useRef(cfg);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);
  const onKey = useCallback((e: KeyboardEvent) => {
    const c = cfgRef.current, k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft') { e.preventDefault(); const Wn = win(c), st = (e.shiftKey ? 30 : 5) / (Wn.w1 - Wn.w0); set('t', Math.min(1, Math.max(0, c.t + (k === 'ArrowRight' ? st : -st)))); }
    else if (/^[1-4]$/.test(k)) set('mode', DIRS[+k - 1][0]);
    else if (k === 'n' || k === 'N') newSeed();
    else if (k === 'g' || k === 'G') set('grid', c.grid ? 0 : 1);
    else if (k === 's' || k === 'S') doSave();
    else if (k === '\\') togglePanel();
  }, [set, newSeed, doSave]);
  /* in-page anchors are stubs here; a city in the mini day opens its own tuning page */
  const onClick = (e: MouseEvent) => { const a = (e.target as HTMLElement).closest('a'); if (a && /^#(?!sheet|p-)/.test(a.getAttribute('href') || '') && !a.hasAttribute('data-row')) e.preventDefault(); };

  const ms = moments(cfg); let cur = -1; ms.forEach((m, i) => { if (Math.abs(cfg.t - m[2]) < 0.0008) cur = i; });
  const out = (k: string) => k === 't' ? local(W, W.now) : k === 'you' ? (cfg.you < 0 ? 'none' : '#' + (cfg.you + 1)) : String(cfg[k]);
  const fcls = FRAME + (cfg.grid ? ' grid-on' : '');
  return (
    <FormsProvider>
      <CityProvider cfg={pcfg} clock={CLOCK} links={links} live={false} frame="set" extra={EXTRA} onKey={onKey} who={who} pview={cfg.view as PView}>
        <LabCityProvider dir={dir}>
          <ShareOpen on={!!cfg.share} />
          <div className={fcls} id="city" data-mode={dir === 'baseline' ? 'tower' : dir} data-dir={dir} data-vp={String(cfg.vp)} onClick={onClick}>
            <CityMain>
              <CityMasthead />
              <CityTitle />
              {dir === 'baseline' ? <CityBaseline /> : dir === 'tower' ? <TowerFinal /> : dir === 'stage' ? <Stage /> : <Split />}
              {/* a builder's dock: the share kit opens above the bar, both always in view */}
              <div className="sticky bottom-0 z-20 mt-6"><ShareKit /><YouBar /></div>
              <JudgeBar />
              {dir === 'split' ? null : <EntriesTable />}
              <p className="mx-(--m) mt-12 mb-32 py-3 type-label text-ink-3 rule-t" aria-hidden="true">Tuning page: the rest of the city page is unchanged in this round</p>
            </CityMain>
            <div className="dl-grid cl" aria-hidden="true" />
          </div>
          <ProjectView mode={dir === 'baseline' ? 'centred' : dir === 'split' ? 'hidden' : undefined} />
        </LabCityProvider>
      </CityProvider>
      {panelOn ? (
        <LabPanel title="City lab · round 2" cfg={cfg} bounds={BOUNDS} choices={CHOICES} groups={GROUPS} set={set} moments={ms} momentIdx={cur} out={out}
          optionLabel={(k, v) => (k === 'vp' && v !== 'fit' ? v + ' px' : k === 'city' ? CITIES.find((x) => x.id === v)!.name : v)}
          buttons={[['New seed', newSeed], ['Save', doSave, true]]}
          meter={meter} msg={msg} rail={rail} railLabel={(s) => (DIRS.find((d) => d[0] === s.mode)?.[1] || String(s.mode)) + ' ' + s.city + ' #' + s.seed}
          apply={(s) => setCfg(clampCfg({ ...CD, ...LAB_DEF, ...s } as CityCfg, EXTRA))} />
      ) : null}
      <LayoutPicker modes={DIRS} mode={dir} setMode={(m) => set('mode', m)} replay={() => {}} />
    </FormsProvider>
  );
}

/* the Share kit knob opens and closes the kit the page keeps */
function ShareOpen({ on }: { on: boolean }) {
  const { setShare } = useCity();
  useEffect(() => { setShare(on); }, [on, setShare]);
  return null;
}
