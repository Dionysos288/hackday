/* motion.ts: every motion value the pages use, as one config. The motion tuning page (/lab/motion) moves them and
   saves saved/motion.config.json; the root layout turns the saved file into the motion tokens on :root, so the pages
   read var(--dur-panel) and the rest and never hold a number of their own. Under reduced motion globals.css sets the
   durations to 0 and the scales to 1, and the saved values do not apply. Pure. */

export type MotionCfg = {
  /* press: a button pressed down scales to this, in durPress */
  press: number; durPress: number;
  /* hover: colours and the hover preview; the row wash is its own (0 is a snap) */
  durHover: number; wash: number; previewScale: number;
  /* the project sheet: in durPanel on easeDrawer, out in durPanelExit on easeExit; it slides from the edge or nudges in */
  durPanel: number; durPanelExit: number; easeDrawer: string; easeExit: string; sheetFrom: string;
  /* home to city: the shared name and bar */
  durVt: number;
  /* the wire: the new line slides in one line's height over slide, and is lit for durFlash */
  slide: number; durFlash: number;
  /* finalists landing: three lines draw in durDraw, each stagger after the last */
  durDraw: number; stagger: number;
  /* the pick, once: the line turns green and the join fills, all inside durReveal */
  durReveal: number;
  /* the tuning page only: everything runs this many times slower, to look at it */
  slow: number;
};

export const MOTION_DEF: MotionCfg = {
  press: 0.97, durPress: 90,
  durHover: 140, wash: 120, previewScale: 0.98,
  durPanel: 280, durPanelExit: 200, easeDrawer: 'drawer', easeExit: 'exit', sheetFrom: 'edge',
  durVt: 280,
  slide: 220, durFlash: 1600,
  durDraw: 480, stagger: 60,
  durReveal: 2400,
  slow: 1,
};

export const MOTION_BOUNDS: Record<string, [number, number, number]> = {
  press: [0.9, 1, 0.01], durPress: [0, 300, 10],
  durHover: [0, 400, 10], wash: [0, 400, 10], previewScale: [0.9, 1, 0.01],
  durPanel: [100, 700, 10], durPanelExit: [60, 500, 10],
  durVt: [0, 700, 10],
  slide: [0, 600, 10], durFlash: [0, 4000, 100],
  durDraw: [120, 1600, 20], stagger: [0, 240, 10],
  durReveal: [800, 6000, 100],
  slow: [1, 10, 1],
};

/* named curves: the select shows the names, the tokens get the cubic-bezier */
export const EASES: Record<string, string> = {
  drawer: 'cubic-bezier(0.32, 0.72, 0, 1)',
  out: 'cubic-bezier(0.23, 1, 0.32, 1)',
  expo: 'cubic-bezier(0.16, 1, 0.3, 1)',
  quart: 'cubic-bezier(0.25, 1, 0.5, 1)',
  exit: 'cubic-bezier(0.4, 0, 1, 1)',
  'in-quad': 'cubic-bezier(0.55, 0.085, 0.68, 0.53)',
  'in-out': 'cubic-bezier(0.77, 0, 0.175, 1)',
};
/* edge: the sheet slides its whole width from the right edge; nudge: it moves 32px and fades */
export const SHEET_FROM: Record<string, [string, number]> = { edge: ['100%', 1], nudge: ['32px', 0] };

export const MOTION_CHOICES: Record<string, string[]> = {
  easeDrawer: ['drawer', 'out', 'expo', 'quart'],
  easeExit: ['exit', 'in-quad', 'out', 'in-out'],
  sheetFrom: ['edge', 'nudge'],
};

export function clampMotion(c: Partial<MotionCfg>): MotionCfg {
  const o = { ...MOTION_DEF, ...c } as Record<string, unknown>;
  Object.keys(MOTION_BOUNDS).forEach((k) => { const b = MOTION_BOUNDS[k], v = Number(o[k]); o[k] = isFinite(v) ? Math.min(b[1], Math.max(b[0], v)) : (MOTION_DEF as Record<string, unknown>)[k]; });
  Object.keys(MOTION_CHOICES).forEach((k) => { if (MOTION_CHOICES[k].indexOf(String(o[k])) < 0) o[k] = (MOTION_DEF as Record<string, unknown>)[k]; });
  return o as MotionCfg;
}

/* the tokens; slow multiplies every duration (the tuning page uses it to look; the saved pages ignore it) */
export function motionVars(c: MotionCfg, slow = 1): Record<string, string> {
  const ms = (v: number) => Math.round(v * slow) + 'ms', from = SHEET_FROM[c.sheetFrom] || SHEET_FROM.edge;
  return {
    '--press': String(c.press), '--dur-press': ms(c.durPress),
    '--dur-hover': ms(c.durHover), '--dur-wash': ms(c.wash), '--preview-scale': String(c.previewScale),
    '--dur-panel': ms(c.durPanel), '--dur-panel-exit': ms(c.durPanelExit),
    '--ease-drawer': EASES[c.easeDrawer] || EASES.drawer, '--ease-exit': EASES[c.easeExit] || EASES.exit,
    '--sheet-from': from[0], '--sheet-fade': String(from[1]),
    '--dur-vt': ms(c.durVt),
    '--dur-slide': ms(c.slide), '--dur-flash': ms(c.durFlash),
    '--dur-draw': ms(c.durDraw), '--stagger': ms(c.stagger),
    '--dur-reveal': ms(c.durReveal),
  };
}
/* the saved values as CSS for the root layout: only when motion is allowed, so the reduced-motion zeros in
   globals.css still win for those who asked for them. :root:root outranks globals.css whatever the load order. */
export function motionCss(c: MotionCfg): string {
  const v = motionVars(c);
  return '@media (prefers-reduced-motion: no-preference){:root:root{' + Object.keys(v).map((k) => k + ':' + v[k]).join(';') + '}}';
}
