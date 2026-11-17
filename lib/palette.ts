/* palette.ts: the three grounds, written once as OKLCH. brand tokens (app/globals.css) derive every colour role from
   the five values set here. Night is the default ground (Supabase's near-black, every grey on hue 157.5); paper is a
   neutral graphite paper; mint is a green-tinted paper.

   On the two light grounds the brand green (L 0.762) is only 1.6:1, so lines and labels use the same hue at L 0.46
   (5.5:1, APCA Lc 69): Supabase's own button green. Contrast repairs move L only; chroma is clamped to sRGB.
   The logo keeps the fixed brand green on every ground (--brand). Pure: applying it is components/ground. */
type Lch = [number, number, number];
const BRAND: Lch = [0.762, 0.154, 159.4], DEEP: Lch = [0.46, 0.105, 159.4], ONDEEP: Lch = [0.97, 0.01, 158];

export type Ground = 'night' | 'paper' | 'mint';
export const GROUNDS: Ground[] = ['night', 'paper', 'mint'];
const PAL: Record<Ground, { ground: Lch; ink: Lch; ink2: Lch; green: Lch; tagink: Lch }> = {
  night: { ground: [0.19, 0.0025, 157.5], ink: [0.95, 0.003, 157.5], ink2: [0.79, 0.003, 157.5], green: BRAND, tagink: [0.19, 0.03, 159.4] },
  paper: { ground: [0.93, 0.003, 250], ink: [0.2, 0.003, 250], ink2: [0.37, 0.003, 250], green: DEEP, tagink: ONDEEP },
  mint: { ground: [0.93, 0.052, 158], ink: [0.17, 0.04, 160], ink2: [0.38, 0.05, 160], green: DEEP, tagink: ONDEEP },
};
/* each ground in sRGB hex, for the browser's own chrome (<meta name="theme-color">) */
export const GROUND_HEX: Record<Ground, string> = { night: '#131413', paper: '#e6e8ea', mint: '#ccf3db' };

export function isGround(g: unknown): g is Ground { return typeof g === 'string' && g in PAL; }
function c(a: Lch): string { return 'oklch(' + a[0] + ' ' + a[1] + ' ' + a[2] + ')'; }
function m(a: Lch, b: Lch, t: number): Lch { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

/* the custom properties for a ground, and the data-paper value brand tokens key on */
export function groundVars(name: string): { key: Ground; paper: 'night' | 'graphite'; vars: Record<string, string> } {
  const key: Ground = isGround(name) ? name : 'night', p = PAL[key];
  const vars = { ground: c(p.ground), ink: c(p.ink), ink2: c(p.ink2), green: c(p.green), tagink: c(p.tagink), brand: c(BRAND), minor: c(m(p.ground, p.ink, 0.08)), major: c(m(p.ground, p.ink, 0.2)) };
  return { key, paper: key === 'night' ? 'night' : 'graphite', vars };
}
