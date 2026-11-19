/* The preview page without its sheet: the wheel as the first screen, the day under the fold. Every taste value of
   the page is here, tuned at /lab/fold and saved in saved/fold.config.json, which /preview reads. The motion values
   (the *Ms knobs and the curves) are kept here until the motion config can take them. Pure. */

export type FoldDir = 'base' | 'plain' | 'line' | 'unroll';
export type FoldCfg = {
  dir: FoldDir;
  /* modes */
  glass: 'fixed' | 'today'; globe: 'docks' | 'leaves'; input: 'hand' | 'globe'; jump: 'roll' | 'smooth' | 'cut';
  cities: 'belt' | 'board' | 'clocks'; ready: 'dry' | 'steps'; questions: 'open' | 'index' | 'reveal';
  order: 'prize-first' | 'cities-first' | 'how-first'; words: 'lede' | 'none'; arrive: 'tube' | 'none';
  /* the first screen's arrival: the names turn in from a little back and fade up (sweep), only fade up (fade), or are
     simply there (none); the words and the link follow */
  intro: 'sweep' | 'fade' | 'none';
  /* the black bar of facts under the wheel (date, cities, build), or none */
  bar: 'none' | 'cells';
  /* the link at the top right of the first screen */
  topLink: 'none' | 'how';
  /* the account (door-plan.md, D3): with a place, the register cell becomes the account (merged) or the account cell
     sits beside it (beside); Sign in only in the header's cells (link) or also at the very top (both) */
  acct: 'merged' | 'beside'; acctTop: 'link' | 'both';
  /* the first screen; the space above the first part (under the wheel, on the page's ground) */
  peek: number; firstTop: number;
  /* the globe's dock: its size in the header, how much of the wheel's height the dock takes, its turn with the scroll */
  dockSize: number; dockEnd: number; dockTurn: number;
  /* the bar */
  barPad: number; cellPad: number; dotSize: number;
  /* the header: its height and when it changes (the share of the wheel scrolled away) */
  hdrH: number; hdrAt: number;
  /* the belt */
  beltH: number; beltInk: number; tickH: number; beltLead: number; beltSpan: number; beltMs: number; beltFade: number;
  /* the board */
  rowH: number; citySize: number; dim: number;
  /* layout */
  width: number; gutter: number; gap: number; gapPhone: number; wordsPhone: number;
  /* motion */
  convFrom: number; convMs: number; rowStep: number; flapMs: number; flapStagger: number; flaps: number;
  introSweep: number; introMs: number; introWords: number; introStagger: number; introLead: number; rowTotal: number;
  bloom: number; bloomMs: number; rollMs: number; rollBar: number; dryStep: number; dryHold: number; writeStep: number;
  /* unroll (lab only) */
  unrollFrom: number; unrollSpread: number;
};

export const FOLD_DEF: FoldCfg = {
  dir: 'line',
  glass: 'fixed', globe: 'docks', input: 'hand', jump: 'roll', cities: 'belt', ready: 'dry', questions: 'open', order: 'prize-first', words: 'lede', arrive: 'tube', intro: 'sweep', bar: 'none', topLink: 'none', acct: 'merged', acctTop: 'both',
  peek: 56, firstTop: 28,
  dockSize: 26, dockEnd: 0.62, dockTurn: 0.3,
  barPad: 22, cellPad: 12, dotSize: 2,
  hdrH: 64, hdrAt: 0.45,
  beltH: 64, beltInk: 0.55, tickH: 10, beltLead: 160, beltSpan: 140, beltMs: 180, beltFade: 40,
  rowH: 72, citySize: 32, dim: 0.42,
  width: 1264, gutter: 88, gap: 160, gapPhone: 96, wordsPhone: 20,
  convFrom: 5, convMs: 260, rowStep: 45, flapMs: 45, flapStagger: 22, flaps: 4,
  introSweep: 1.5, introMs: 420, introWords: 300, introStagger: 60, introLead: 120, rowTotal: 360,
  bloom: 0, bloomMs: 420, rollMs: 260, rollBar: 48, dryStep: 150, dryHold: 450, writeStep: 30,
  unrollFrom: 0.15, unrollSpread: 0.35,
};

export const FOLD_BOUNDS: Record<string, [number, number, number]> = {
  peek: [40, 80, 1], firstTop: [0, 160, 2],
  dockSize: [16, 40, 1], dockEnd: [0.3, 0.9, 0.01], dockTurn: [0, 1.5, 0.05],
  barPad: [12, 56, 1], cellPad: [8, 24, 1], dotSize: [1, 4, 0.5],
  hdrH: [52, 96, 1], hdrAt: [0.3, 0.9, 0.01],
  beltH: [28, 96, 1], beltInk: [0.2, 1, 0.01], tickH: [4, 24, 1], beltLead: [0, 480, 10], beltSpan: [60, 300, 5], beltMs: [0, 600, 10], beltFade: [0, 120, 2],
  rowH: [52, 112, 1], citySize: [20, 56, 1], dim: [0.2, 0.8, 0.01],
  width: [960, 1600, 8], gutter: [20, 120, 1], gap: [64, 280, 4], gapPhone: [48, 200, 4], wordsPhone: [16, 28, 1],
  convFrom: [0, 12, 0.5], convMs: [0, 600, 10], rowStep: [0, 160, 5], flapMs: [20, 120, 5], flapStagger: [0, 80, 2], flaps: [0, 8, 1],
  introSweep: [0, 4, 0.1], introMs: [0, 900, 10], introWords: [0, 600, 10], introStagger: [0, 160, 5], introLead: [0, 400, 10], rowTotal: [0, 1200, 10],
  bloom: [0, 0.02, 0.001], bloomMs: [0, 900, 10], rollMs: [0, 400, 10], rollBar: [0, 160, 2], dryStep: [0, 400, 10], dryHold: [0, 2000, 50], writeStep: [0, 120, 5],
  unrollFrom: [0, 0.5, 0.01], unrollSpread: [0, 0.8, 0.01],
};

export const FOLD_CHOICES: Record<string, string[]> = {
  dir: ['base', 'plain', 'line', 'unroll'],
  glass: ['fixed', 'today'], globe: ['docks', 'leaves'], input: ['hand', 'globe'], jump: ['roll', 'smooth', 'cut'],
  cities: ['belt', 'board', 'clocks'], ready: ['dry', 'steps'], questions: ['open', 'index', 'reveal'], order: ['prize-first', 'cities-first', 'how-first'], words: ['lede', 'none'], arrive: ['tube', 'none'], intro: ['sweep', 'fade', 'none'], bar: ['none', 'cells'], topLink: ['none', 'how'], acct: ['merged', 'beside'], acctTop: ['link', 'both'],
};

export const FOLD_INT = new Set(['peek', 'firstTop', 'gapPhone', 'wordsPhone', 'dockSize', 'barPad', 'cellPad', 'hdrH', 'beltH', 'tickH', 'beltLead', 'beltSpan', 'beltMs', 'beltFade', 'rowH', 'citySize', 'width', 'gutter', 'gap', 'convMs', 'rowStep', 'flapMs', 'flapStagger', 'flaps', 'introMs', 'introWords', 'introStagger', 'introLead', 'rowTotal', 'bloomMs', 'rollMs', 'rollBar', 'dryStep', 'dryHold', 'writeStep']);

export function clampFold(c: Partial<FoldCfg> | Record<string, unknown>): FoldCfg {
  const o = { ...FOLD_DEF } as Record<string, unknown>, src = c as Record<string, unknown>;
  for (const k of Object.keys(FOLD_DEF)) {
    const v = src[k], b = FOLD_BOUNDS[k];
    if (FOLD_CHOICES[k]) { if (FOLD_CHOICES[k].indexOf(String(v)) >= 0) o[k] = v; continue; }
    if (typeof v === 'number' && isFinite(v)) o[k] = b ? Math.min(b[1], Math.max(b[0], v)) : v;
  }
  return o as FoldCfg;
}

/* the page's values as custom properties on its root */
export function foldVars(c: FoldCfg): Record<string, string> {
  return {
    '--pf-peek': c.peek + 'px', '--pf-first': c.firstTop + 'px', '--pf-dock': c.dockSize + 'px', '--pf-bar-pad': c.barPad + 'px', '--pf-cell-pad': c.cellPad + 'px', '--pf-dot': c.dotSize + 'px',
    '--pf-hdr': c.hdrH + 'px', '--pf-belt': c.beltH + 'px', '--pf-belt-ink': String(c.beltInk), '--pf-tick': c.tickH + 'px', '--pf-belt-fade': c.beltFade + 'px',
    '--pf-row': c.rowH + 'px', '--pf-city': c.citySize + 'px', '--pf-dim': String(c.dim),
    '--pf-width': c.width + 'px', '--pf-gutter-max': c.gutter + 'px', '--pf-gap': c.gap + 'px', '--pf-gap-phone': c.gapPhone + 'px', '--pf-words-phone': c.wordsPhone + 'px',
    '--pf-conv-from': c.convFrom + 'px', '--pf-conv-ms': c.convMs + 'ms', '--pf-bloom': String(1 + c.bloom), '--pf-bloom-ms': c.bloomMs + 'ms',
    '--pf-in-ms': c.introWords + 'ms', '--pf-in-step': c.introStagger + 'ms', '--pf-in-lead': c.introLead + 'ms',
    '--pf-roll-ms': c.rollMs + 'ms', '--pf-roll-bar': c.rollBar + 'px', '--pf-write-step': c.writeStep + 'ms',
  };
}
