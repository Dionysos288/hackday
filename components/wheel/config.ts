/* The wheel's numbers. Every value here was a constant in the study (the wheel, the tube screen pass and the screen
   lines); here each one is a knob in /lab/wheel, saved to saved/wheel.config.json. The defaults are the study's own
   values, so the defaults draw the study. The land map is baked (tools/bake-land.mjs) and is not a knob. */

export type WheelFont = 'study' | 'geist';
export type WheelMark = 'hack' | 'both' | 'name';
export type WheelCfg = {
  /* the wheel */
  step: number; hubY: number; hubOfHeight: number; hubOfWidth: number;
  labelFrom: number; labelPush: number; labelSize: number; track: number;
  fadeFrom: number; fadeTo: number; face: number; ink: number; dim: number;
  wheelPx: number; dragPx: number; openScale: number;
  ease: number; yawEase: number; openEase: number;
  ghosts: number; ghostAlpha: number; ghostGap: number; ghostFrom: number;
  settleFrom: number; settleTo: number; pulseLow: number; pulseRate: number; statusDelay: number;
  font: WheelFont; mark: WheelMark;
  /* the tube screen pass */
  edgeFrom: number; edgeTo: number; edgeReach: number; edgeTaps: number;
  fringe: number; grain: number; glassSplit: number; core: number; vignette: number; paper: number;
  mirrorStart: number; mirrorSize: number; mirrorTip: number; mirrorDepth: number; mirrorSqueeze: number;
  mirrorBlur: number; mirrorGlow: number; mirrorSplit: number; mirrorStrength: number;
  /* the screen lines over the page, and the sound */
  lineAlpha: number; linePeriod: number; sound: number; volume: number;
};

export const WHEEL_DEF: WheelCfg = {
  step: 10, hubY: 0.52, hubOfHeight: 0.4, hubOfWidth: 0.28,
  labelFrom: 1.52, labelPush: 0.3, labelSize: 0.14, track: -0.03,
  fadeFrom: 1.2, fadeTo: 1.65, face: -0.6, ink: 232, dim: 0.42,
  wheelPx: 80, dragPx: 56, openScale: 1.14,
  ease: 9, yawEase: 5, openEase: 10,
  ghosts: 3, ghostAlpha: 0.22, ghostGap: 0.07, ghostFrom: 0.25,
  settleFrom: 0.02, settleTo: 0.35, pulseLow: 0.72, pulseRate: 1.25, statusDelay: 600,
  font: 'study', mark: 'hack',
  edgeFrom: 0.47, edgeTo: 1.25, edgeReach: 0.52, edgeTaps: 8,
  fringe: 1.2, grain: 0.045, glassSplit: 0.1, core: 0.86, vignette: 0.45, paper: 12,
  mirrorStart: 0.95, mirrorSize: 0.07, mirrorTip: 0.22, mirrorDepth: 0.68, mirrorSqueeze: 0.5,
  mirrorBlur: 0.006, mirrorGlow: 0.024, mirrorSplit: 0.012, mirrorStrength: 0.5,
  lineAlpha: 0.34, linePeriod: 3, sound: 1, volume: 1,
};

/* [min, max, step] for every number, tested in the lab: none of these ends breaks the picture */
export const WHEEL_BOUNDS: Record<string, [number, number, number]> = {
  step: [6, 16, 0.5], hubY: [0.35, 0.65, 0.01], hubOfHeight: [0.25, 0.55, 0.01], hubOfWidth: [0.18, 0.4, 0.01],
  labelFrom: [1.2, 2, 0.02], labelPush: [0, 0.6, 0.02], labelSize: [0.08, 0.22, 0.005], track: [-0.06, 0.02, 0.005],
  fadeFrom: [0.6, 1.5, 0.05], fadeTo: [1.2, 2, 0.05], face: [-1.2, 0.4, 0.05], ink: [160, 255, 1], dim: [0.15, 0.8, 0.01],
  wheelPx: [30, 200, 5], dragPx: [24, 120, 2], openScale: [1, 1.3, 0.01],
  ease: [3, 20, 0.5], yawEase: [1, 12, 0.5], openEase: [3, 20, 0.5],
  ghosts: [0, 5, 1], ghostAlpha: [0, 0.5, 0.01], ghostGap: [0.02, 0.15, 0.005], ghostFrom: [0.05, 1, 0.05],
  settleFrom: [0, 0.2, 0.01], settleTo: [0.1, 0.8, 0.01], pulseLow: [0.3, 1, 0.01], pulseRate: [0.3, 3, 0.05], statusDelay: [200, 1500, 50],
  edgeFrom: [0.2, 0.9, 0.01], edgeTo: [0.9, 1.6, 0.01], edgeReach: [0, 1, 0.02], edgeTaps: [2, 16, 1],
  fringe: [0, 3, 0.1], grain: [0, 0.12, 0.005], glassSplit: [0, 0.25, 0.01], core: [0.6, 0.98, 0.01], vignette: [0, 0.9, 0.01], paper: [0, 40, 1],
  mirrorStart: [0.8, 1.1, 0.01], mirrorSize: [0.03, 0.14, 0.005], mirrorTip: [0.05, 0.4, 0.01], mirrorDepth: [0.3, 1, 0.02], mirrorSqueeze: [0.2, 1, 0.02],
  mirrorBlur: [0, 0.02, 0.001], mirrorGlow: [0, 0.06, 0.002], mirrorSplit: [0, 0.04, 0.001], mirrorStrength: [0, 1, 0.02],
  lineAlpha: [0, 0.6, 0.01], linePeriod: [2, 6, 1], volume: [0, 2, 0.05],
};
export const WHEEL_CHOICES: Record<string, string[]> = { font: ['study', 'geist'], mark: ['hack', 'both', 'name'] };

/* the values the shader is built from: when one of these changes, the program is compiled again */
export const SHADER_KEYS = ['edgeFrom', 'edgeTo', 'edgeReach', 'edgeTaps', 'fringe', 'grain', 'glassSplit', 'core', 'vignette', 'paper',
  'mirrorStart', 'mirrorSize', 'mirrorTip', 'mirrorDepth', 'mirrorSqueeze', 'mirrorSplit', 'mirrorStrength'] as const;

export function clampWheel(c: Partial<WheelCfg> | Record<string, unknown>): WheelCfg {
  const o = { ...WHEEL_DEF } as Record<string, unknown>, src = c as Record<string, unknown>;
  for (const k of Object.keys(WHEEL_DEF)) {
    const v = src[k], b = WHEEL_BOUNDS[k];
    if (WHEEL_CHOICES[k]) { if (WHEEL_CHOICES[k].indexOf(String(v)) >= 0) o[k] = v; continue; }
    if (k === 'sound') { if (v !== undefined) o.sound = v ? 1 : 0; continue; }
    if (typeof v === 'number' && isFinite(v)) o[k] = b ? Math.min(b[1], Math.max(b[0], v)) : v;
  }
  if ((o.fadeTo as number) <= (o.fadeFrom as number)) o.fadeTo = (o.fadeFrom as number) + 0.05;
  if ((o.settleTo as number) <= (o.settleFrom as number)) o.settleTo = (o.settleFrom as number) + 0.05;
  return o as WheelCfg;
}

/* the faces: the study's stack (Inter where installed, else Helvetica Neue), or the site's Geist */
export const SANS: Record<WheelFont, string> = {
  study: '"Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
  geist: 'var(--font-geist), "Helvetica Neue", Helvetica, Arial, sans-serif',
};
export const MONO: Record<WheelFont, string> = {
  study: 'ui-monospace, "SF Mono", SFMono-Regular, Menlo, monospace',
  geist: 'var(--font-geist-mono), ui-monospace, "SF Mono", Menlo, monospace',
};
