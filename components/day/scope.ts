/* The tube: the how-it-works and prize drawings as a vector monitor draws them. A beam goes only where a line is, so
   every drawing is lines (a flap face, a lit screen and the pick's cell are the only fills); a line is drawn on from a hot head; a new thing flashes blue-white and fades to an
   orange afterglow (a radar tube's two-colour phosphor); the clock and the prize are segment digits or flaps, which
   can only pass through the states their hardware allows. The scan lines and the dark corners are CSS on the tube.

   Rules (fixed here; everything else is a knob in /lab/explain, saved to saved/explain.config.json):
   - one ground (#0e0f0f), white ink, blue for what is new or yours, orange for the leader and the pick; nothing else;
   - lines, 1-2px, with a glow (fills only for a flap face, a lit screen, the pick's cell); text only as segment digits, flaps or the mono face;
   - the motion is the day's own mechanics (a clock running down, votes arriving, thirty becoming one), never decoration;
   - motion steps at the tube's frame rate (12 is "on twos"), so it reads as drawn, not tweened;
   - the drawing is a pure function of (scene, phase, config, facts): the seed makes every variation, and a still under
     reduced motion is the same drawing at one phase.

   Drawn in a 320 x 180 space; the canvas scales it. */

export type BuildMode = 'beam' | 'boot';
export type VoteMode = 'trace' | 'radar';
export type FinalMode = 'thirty' | 'lissajous';
export type CashMode = 'flap' | 'vector';
export type NeoMode = 'laptop' | 'ten';
export type ScopeLayout = 'reel' | 'stacked' | 'side';
export type Scene = 'build' | 'vote' | 'final' | 'cash' | 'neo' | 'reel';

export type ScopeCfg = {
  seed: number; build: BuildMode; vote: VoteMode; final: FinalMode; cash: CashMode; neo: NeoMode; layout: ScopeLayout;
  loop: number; fps: number; hold: number; still: number;
  glow: number; lw: number; jitter: number; trail: number; decay: number; scan: number; blips: number; hover: number;
};
export const SCOPE_DEF: ScopeCfg = {
  seed: 7, build: 'beam', vote: 'trace', final: 'thirty', cash: 'flap', neo: 'laptop', layout: 'reel',
  loop: 9, fps: 24, hold: 0.22, still: 0.9, glow: 6, lw: 1.3, jitter: 0.35, trail: 6, decay: 0.62, scan: 0.22, blips: 22, hover: 1,
};
export const SCOPE_CHOICES: Record<string, string[]> = {
  build: ['beam', 'boot'], vote: ['trace', 'radar'], final: ['thirty', 'lissajous'], cash: ['flap', 'vector'], neo: ['laptop', 'ten'], layout: ['reel', 'stacked', 'side'],
};
export const SCOPE_LABELS: Record<string, string> = {
  beam: 'Beam draws the app', boot: 'Terminal boot log', trace: 'Live step chart', radar: 'Radar sweep', thirty: 'Thirty into one', lissajous: 'Thirty figures lock',
  flap: 'Split-flap roll', vector: 'Beam-drawn figure', laptop: 'Wireframe laptop', ten: 'Ten laptops', reel: 'One tube plays the day', stacked: 'A tube per step', side: 'Small tube beside the words',
};
export const SCOPE_BOUNDS: Record<string, [number, number, number]> = {
  loop: [4, 20, 0.5], fps: [8, 60, 1], hold: [0, 0.5, 0.02], still: [0, 1, 0.01], glow: [0, 16, 0.5], lw: [0.75, 2.5, 0.05],
  jitter: [0, 1.5, 0.05], trail: [0, 14, 1], decay: [0.3, 0.9, 0.02], scan: [0, 0.5, 0.02], blips: [6, 48, 1], seed: [1, 99999, 1],
};
export function clampScope(s: Partial<ScopeCfg>): ScopeCfg {
  const c = { ...SCOPE_DEF, ...s } as ScopeCfg & Record<string, unknown>, o = { ...c } as Record<string, unknown>;
  for (const [k, list] of Object.entries(SCOPE_CHOICES)) if (!list.includes(String(c[k]))) o[k] = SCOPE_DEF[k as keyof ScopeCfg];
  for (const [k, [a, b]] of Object.entries(SCOPE_BOUNDS)) { const v = Number(c[k]); o[k] = Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : SCOPE_DEF[k as keyof ScopeCfg]; }
  o.seed = Math.round(o.seed as number); o.fps = Math.round(o.fps as number); o.trail = Math.round(o.trail as number); o.blips = Math.round(o.blips as number); o.hover = c.hover ? 1 : 0;
  return o as ScopeCfg;
}

/* finalists: how many made the final (fewer than codes x top when a city had no entries); empty: the cells (city x top +
   place) no finalist fills, drawn as a dashed gap; pick: the picked cell
   (city x top + place) once the pick is made, so the drawing never lights a different one from the page */
export type Facts = { buildMin: number; voteAfter: number; startHour: number; codes: string[]; top: number; finalists?: number; pick?: number; empty?: number[] };
const finN = (f: Facts) => f.finalists ?? f.codes.length * f.top;
export type Fonts = { mono: string; sans: string };
export const VW = 320, VH = 180;
const INK = '#f4f4f2', BLUE = '#4d6bff', ORANGE = '#ff7a1a', GREY = '#6b6c6b', LABEL = '#a3a39f', DIM = '#2b2c2c', FLASH = '#e4e9ff', FACE = '#151616';

type Pt = [number, number]; type Poly = Pt[];
type X = { c: CanvasRenderingContext2D; cfg: ScopeCfg; f: Facts; fo: Fonts; k: number; boost: number; frame: number; ph: number };

/* seeded numbers: the same seed and index always give the same value */
function hash(...n: number[]): number {
  let h = 2166136261 >>> 0;
  for (const v of n) { h ^= Math.floor(v * 1000) | 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995) >>> 0; }
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
const cl = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const eio = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = (t: number) => 1 - Math.pow(1 - t, 3);
const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (m: number) => pad(Math.floor(m / 60) % 24) + ':' + pad(Math.floor(m % 60));
/* the share of the loop before the hold */
const act = (x: X, ph = x.ph) => cl(ph / Math.max(0.05, 1 - x.cfg.hold));

/* --- drawing --- */
function jit(x: X, p: Pt, i: number): Pt {
  const j = x.cfg.jitter; if (!j) return p;
  return [p[0] + (hash(x.cfg.seed, x.frame, i, 1) - 0.5) * j, p[1] + (hash(x.cfg.seed, x.frame, i, 2) - 0.5) * j];
}
function glow(x: X, col: string, more = 1) { x.c.shadowColor = col; x.c.shadowBlur = x.cfg.glow * x.k * x.boost * more; }
function stroke(x: X, polys: Poly[], col: string, a = 1, w = 1, more = 1) {
  if (!polys.length || a <= 0) return;
  const c = x.c; c.save(); c.globalAlpha = cl(a); c.strokeStyle = col; c.lineWidth = x.cfg.lw * w; c.lineJoin = 'round'; c.lineCap = 'round'; glow(x, col, more);
  c.beginPath(); let i = 0;
  for (const p of polys) p.forEach((q, n) => { const [px, py] = jit(x, q, i++); if (n) c.lineTo(px, py); else c.moveTo(px, py); });
  c.stroke(); c.restore();
}
function dot(x: X, p: Pt, r: number, col: string, a = 1, more = 1.4) {
  const c = x.c; c.save(); c.globalAlpha = cl(a); c.fillStyle = col; glow(x, col, more); c.beginPath(); c.arc(p[0], p[1], r, 0, Math.PI * 2); c.fill(); c.restore();
}
function text(x: X, s: string, px: number, py: number, size: number, col: string, a = 1, align: CanvasTextAlign = 'left', face = x.fo.mono) {
  const c = x.c; if (col === GREY) col = LABEL; if (size < 9) size = 9; c.save(); c.globalAlpha = cl(a); c.fillStyle = col; glow(x, col, 0.6); c.font = '500 ' + size + 'px ' + face; c.textAlign = align; c.textBaseline = 'alphabetic'; c.fillText(s, px, py); c.restore();
}
function rect(x0: number, y0: number, x1: number, y1: number): Poly { return [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]; }
function arc(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n = 24): Poly {
  const p: Poly = []; for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } return p;
}
const plen = (p: Poly) => { let s = 0; for (let i = 1; i < p.length; i++) s += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]); return s; };
/* the first share t of a drawing, by length, and where the beam is */
function cut(polys: Poly[], t: number): { out: Poly[]; head: Pt | null } {
  const total = polys.reduce((s, p) => s + plen(p), 0); let left = total * cl(t); const out: Poly[] = []; let head: Pt | null = null;
  for (const p of polys) {
    if (left <= 0) break; const q: Poly = [p[0]];
    for (let i = 1; i < p.length; i++) {
      const d = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]);
      if (d <= left) { q.push(p[i]); left -= d; head = p[i]; } else { const r = left / d; head = [p[i - 1][0] + (p[i][0] - p[i - 1][0]) * r, p[i - 1][1] + (p[i][1] - p[i - 1][1]) * r]; q.push(head); left = 0; break; }
    }
    out.push(q);
  }
  return { out, head: t >= 1 ? null : head };
}
/* a beam drawing on: the drawn part in ink, the head a hot dot */
function drawOn(x: X, polys: Poly[], t: number, col = INK, a = 0.9) {
  const { out, head } = cut(polys, t); stroke(x, out, col, a); if (head) dot(x, head, 1.6 * x.cfg.lw, FLASH, 1);
}

/* segment digits: the only states a seven-segment tube has */
const SEG: Record<string, [number, number, number, number]> = { a: [0, 0, 1, 0], b: [1, 0, 1, 0.5], c: [1, 0.5, 1, 1], d: [0, 1, 1, 1], e: [0, 0.5, 0, 1], f: [0, 0, 0, 0.5], g: [0, 0.5, 1, 0.5] };
const DIG: Record<string, string> = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg', $: 'afgcd' };
function segText(s: string, x0: number, y0: number, w: number, h: number): { polys: Poly[]; width: number } {
  const polys: Poly[] = []; let x = x0; const gap = w * 0.42;
  for (const ch of s) {
    if (ch === ':') { polys.push([[x + 1, y0 + h * 0.3], [x + 1, y0 + h * 0.32]], [[x + 1, y0 + h * 0.7], [x + 1, y0 + h * 0.72]]); x += gap + 2; continue; }
    if (ch === ',') { polys.push([[x + 2, y0 + h * 0.92], [x, y0 + h * 1.12]]); x += gap + 3; continue; }
    if (ch === ' ') { x += w * 0.6; continue; }
    const segs = DIG[ch]; if (!segs) { x += w + gap; continue; }
    for (const sg of segs) { const [a, b, c, d] = SEG[sg]; polys.push([[x + a * w, y0 + b * h], [x + c * w, y0 + d * h]]); }
    if (ch === '$') polys.push([[x + w / 2, y0 - h * 0.14], [x + w / 2, y0 + h * 1.14]]);
    x += w + gap;
  }
  return { polys, width: x - gap - x0 };
}

/* the two-colour phosphor: a hit flashes blue-white, turns blue, then fades through an orange afterglow */
function p7(age: number): [string, number] {
  if (age < 0) return [INK, 0];
  if (age < 0.06) return [FLASH, 1];
  if (age < 0.2) return [BLUE, 1 - ((age - 0.06) / 0.14) * 0.25];
  return [ORANGE, Math.max(0, 0.75 * (1 - (age - 0.2) / 0.8))];
}
const pick = <T,>(x: X, list: T[], salt: number) => list[Math.floor(hash(x.cfg.seed, salt) * list.length) % list.length];

/* ===== Build ===== */
function clock(x: X, u: number, px: number, py: number, w: number, h: number, col = INK) {
  const left = Math.round(x.f.buildMin * 60 * (1 - u)), s = Math.floor(left / 3600) + ':' + pad(Math.floor((left % 3600) / 60)) + ':' + pad(left % 60);
  stroke(x, segText(s, px, py, w, h).polys, col, 0.95);
}
function timeline(x: X, u: number, y: number) {
  const f = x.f, all = f.buildMin + f.voteAfter, x0 = 18, x1 = 302, bx = x0 + ((x1 - x0) * f.buildMin) / all, start = f.startHour * 60;
  stroke(x, [[[x0, y], [x1, y]]], DIM, 1);
  stroke(x, [[[x0, y], [x0 + (bx - x0) * u, y]]], INK, 1, 1.6);
  stroke(x, [[[bx, y], [x1, y]]], BLUE, 0.55, 1.6);
  stroke(x, [[[bx, y - 4], [bx, y + 4]]], GREY, 1);
  text(x, hhmm(start), x0, y + 13, 7.5, GREY); text(x, hhmm(start + f.buildMin), bx, y + 13, 7.5, GREY, 1, 'center'); text(x, hhmm(start + all), x1, y + 13, 7.5, GREY, 1, 'right');
}
function appShape(): Poly[] {
  const p: Poly[] = [];
  p.push(arc(62, 92, 26, 6, 0, Math.PI * 2, 28), [[36, 92], [36, 132]], [[88, 92], [88, 132]], arc(62, 132, 26, 6, 0, Math.PI, 14), arc(62, 112, 26, 6, 0, Math.PI, 14));
  p.push([[90, 112], [150, 112]]);
  p.push(rect(150, 16, 302, 120), [[150, 30], [302, 30]], [[157, 23], [158, 23]], [[163, 23], [164, 23]], [[169, 23], [170, 23]], [[184, 30], [184, 120]]);
  p.push([[158, 42], [176, 42]], [[158, 52], [172, 52]], [[158, 62], [174, 62]]);
  p.push(rect(194, 40, 292, 110));
  for (let y = 54; y < 110; y += 14) p.push([[194, y], [292, y]]);
  p.push([[226, 40], [226, 110]], [[262, 40], [262, 110]]);
  return p;
}
function buildBeam(x: X) {
  const u = act(x), done = x.ph > 1 - x.cfg.hold;
  clock(x, u, 18, 18, 10, 20);
  text(x, 'LEFT TO BUILD', 18, 54, 7.5, GREY);
  drawOn(x, appShape(), eio(u), done ? ORANGE : INK, done ? 0.95 : 0.9);
  if (done) { const k = (x.ph - (1 - x.cfg.hold)) / Math.max(0.01, x.cfg.hold); stroke(x, [rect(150, 16, 302, 120)], ORANGE, 1 - k * 0.5, 1.4, 2 - k); text(x, 'SUBMITTED', 302, 132, 7.5, ORANGE, 1, 'right'); }
  timeline(x, u, 158);
}
function buildBoot(x: X) {
  const u = act(x), code = pick(x, x.f.codes, 11), at = x.f.startHour * 60 + Math.round(x.f.buildMin * 0.93);
  const lines: [string, string, string][] = [
    ['~/hack $ supabase init', '', INK], ['~/hack $ supabase start', '', INK], ['  API ready on :54321', '', GREY],
    ['> create table entries', 'OK', INK], ['> alter publication realtime', 'OK', INK], ['> insert into entries', 'OK', INK],
    ['~/hack $ git push', 'OK', INK], ['submitted to ' + code + ' at ' + hhmm(at), '', ORANGE],
  ];
  const total = lines.reduce((s, l) => s + l[0].length + 4, 0); let left = Math.floor(total * eio(u)), y = 46, cx = 18, cy = 46;
  text(x, code + ' · BUILD', 18, 22, 7.5, GREY);
  clock(x, u, 226, 12, 6, 12);
  for (const [s, ok, col] of lines) {
    if (left <= 0) break; const n = Math.min(s.length, left); left -= s.length + 4;
    text(x, s.slice(0, n), 18, y, 8.5, col, col === GREY ? 1 : 0.92);
    if (ok && left > 0) text(x, '[ ' + ok + ' ]', 302, y, 8.5, BLUE, 1, 'right');
    cx = 18 + n * 5.15; cy = y; y += 14;
  }
  const sec = x.ph * x.cfg.loop;
  if (sec % 1 < 0.55) stroke(x, [rect(cx + 1, cy - 8, cx + 6, cy + 1)], INK, 0.9);
  timeline(x, u, 162);
}

/* ===== Vote ===== */
function series(x: X, n: number): number[][] {
  return [0, 1, 2].map((s) => {
    const base = 0.6 + hash(x.cfg.seed, 40, s) * 1.4, amp = 0.4 + hash(x.cfg.seed, 41, s) * 1.6, w = 0.6 + hash(x.cfg.seed, 42, s) * 2.2, ph = hash(x.cfg.seed, 43, s) * 6.28;
    const out = [0]; for (let i = 1; i <= n; i++) out.push(out[i - 1] + Math.max(0, Math.round(base + amp * Math.sin((i / n) * Math.PI * w + ph) + (hash(x.cfg.seed, 44, s, i) - 0.5) * 2.2)));
    return out;
  });
}
function voteTrace(x: X) {
  const u = act(x), N = 36, S = series(x, N), x0 = 18, x1 = 244, y0 = 22, y1 = 146, kf = u * N, k = Math.floor(kf);
  /* zoomed to the votes so far, the way the ranking's chart is zoomed to its ten */
  const vmax = Math.max(8, ...S.map((a) => a[k])) * 1.18;
  const X = (i: number) => x0 + ((x1 - x0) * i) / N, Y = (v: number) => y1 - ((y1 - y0) * v) / vmax;
  const closeAt = (N * x.f.buildMin) / (x.f.buildMin + x.f.voteAfter);
  for (const t of [0.33, 0.66]) stroke(x, [[[x0, y1 - (y1 - y0) * t], [x1, y1 - (y1 - y0) * t]]], DIM, 0.8, 0.7, 0);
  stroke(x, [[[x0, y1], [x1, y1]]], GREY, 0.8, 0.8, 0);
  const cxp = X(closeAt); for (let yy = y0; yy < y1; yy += 6) stroke(x, [[[cxp, yy], [cxp, yy + 3]]], GREY, 0.7, 0.7, 0);
  text(x, 'ENTRIES CLOSE', cxp - 4, y0 + 6, 7.5, GREY, 1, 'right');
  const now = S.map((a) => a[k]), lead = now.indexOf(Math.max(...now));
  const colOf = (s: number) => [BLUE, INK, LABEL][s] ?? INK;
  S.forEach((a, s) => {
    const p: Poly = [[X(0), Y(0)]]; for (let i = 1; i <= k; i++) { p.push([X(i), Y(a[i - 1])], [X(i), Y(a[i])]); } p.push([X(kf), Y(a[k])]);
    stroke(x, [p], colOf(s), s === lead ? 1 : 0.8, s === lead ? 1.8 : 0.9);
    for (let i = Math.max(1, k - 5); i <= k; i++) if (a[i] > a[i - 1]) { const [col, al] = p7((kf - i) / 6); dot(x, [X(i), Y(a[i])], 1.7, col, al); }
    dot(x, [X(kf), Y(a[k])], s === lead ? 2.8 : 2.2, s === lead ? ORANGE : colOf(s), 1);
  });
  /* the places, re-sorted as the lines cross; the board changes at once, the way a results board does */
  const order = [0, 1, 2].sort((p, q) => now[q] - now[p] || p - q);
  order.forEach((s, r) => { const y = 34 + r * 16; text(x, String(r + 1), 256, y, 8, GREY); stroke(x, [[[266, y - 3], [276, y - 3]]], colOf(s), 1, 1.6); text(x, String(now[s]), 302, y, 8.5, INK, 1, 'right'); });
  text(x, 'TOTAL', 256, 112, 7.5, GREY);
  const tot = String(now.reduce((p, q) => p + q, 0)), tw = segText(tot, 0, 0, 7, 14).width;
  stroke(x, segText(tot, 302 - tw, 118, 7, 14).polys, INK, 0.95);
  text(x, hhmm(x.f.startHour * 60), x0, 160, 7.5, GREY); text(x, hhmm(x.f.startHour * 60 + x.f.buildMin + x.f.voteAfter), x1, 160, 7.5, GREY, 1, 'right');
}
function voteRadar(x: X) {
  const cx = 92, cy = 90, R = 72, turns = 2, ang = x.ph * Math.PI * 2 * turns - Math.PI / 2, n = x.cfg.blips;
  for (const r of [R / 3, (2 * R) / 3, R]) stroke(x, [arc(cx, cy, r, r, 0, Math.PI * 2, 48)], INK, 0.22, 0.8, 0);
  stroke(x, [[[cx - R, cy], [cx + R, cy]], [[cx, cy - R], [cx, cy + R]]], INK, 0.14, 0.7, 0);
  /* the sweep and its afterglow wedge */
  for (let k = x.cfg.trail * 3; k >= 0; k--) { const a = ang - k * 0.03; stroke(x, [[[cx, cy], [cx + Math.cos(a) * R, cy + Math.sin(a) * R]]], k < 2 ? FLASH : BLUE, Math.pow(x.cfg.decay, k * 0.5) * 0.8, k < 2 ? 1.1 : 0.9, k < 2 ? 1 : 0); }
  let seen = 0; const recent: [number, string][] = [];
  for (let i = 0; i < n; i++) {
    const th = hash(x.cfg.seed, 60, i) * Math.PI * 2 - Math.PI, r = (0.18 + 0.78 * Math.sqrt(hash(x.cfg.seed, 61, i))) * R, arrive = hash(x.cfg.seed, 62, i) * 0.82;
    const d = (((ang - th) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) / (Math.PI * 2), last = x.ph - d / turns;
    if (last < arrive) continue;
    seen++; recent.push([last, pick(x, x.f.codes, 70 + i)]);
    const [col, al] = p7(d); dot(x, [cx + Math.cos(th) * r, cy + Math.sin(th) * r], 2.1, col, Math.max(al, 0.18));
  }
  text(x, 'VOTES', 190, 40, 7.5, GREY);
  stroke(x, segText(String(seen), 190, 48, 14, 28).polys, INK, 0.95);
  if ((x.ph * x.cfg.loop) % 1 < 0.5) dot(x, [302, 37], 2.4, ORANGE, 1); text(x, 'LIVE', 296, 40, 7.5, GREY, 1, 'right');
  recent.sort((p, q) => q[0] - p[0]).slice(0, 4).forEach(([, c], r) => text(x, c + '  +1', 190, 104 + r * 13, 8, r ? GREY : INK));
}

/* ===== Final ===== */
function finalThirty(x: X) {
  const u = act(x), cw = 15, g = 3, gx = 18, gy = 36, J: Pt = [292, 62], n = x.f.codes.length, top = x.f.top;
  let pickI = x.f.pick ?? Math.floor(hash(x.cfg.seed, 80) * n * top);
  while (x.f.empty?.includes(pickI) && x.f.empty.length < n * top) pickI = (pickI + 1) % (n * top);
  const cell = (i: number) => { const col = Math.floor(i / top), row = i % top; return [gx + col * (cw + g), gy + row * (cw + g)] as Pt; };
  text(x, finN(x.f) + ' FINALISTS', 18, 22, 7.5, GREY); text(x, 'ONE PICK', 302, 22, 7.5, GREY, 1, 'right');
  x.f.codes.forEach((c, i) => text(x, c, gx + i * (cw + g) + cw / 2, gy + top * (cw + g) + 9, 7.5, GREY, 1, 'center'));
  const scanT = cl((u - 0.62) / 0.24), landed = u >= 0.86, landK = cl((u - 0.86) / 0.14);
  const scanAt = scanT > 0 && !landed ? Math.floor(hash(x.cfg.seed, 81, Math.floor(Math.sqrt(scanT) * 16)) * n * top) : -1;
  for (let i = 0; i < n * top; i++) {
    const [px, py] = cell(i), city = Math.floor(i / top), litAt = (0.3 * city) / n + 0.01 * (i % top), age = (u - litAt) / 0.08;
    if (x.f.empty?.includes(i)) { for (let d = 0; d < cw; d += 5) stroke(x, [[[px + d, py + cw], [px + Math.min(cw, d + 2), py + cw]]], DIM, 1, 0.8, 0); continue; }
    if (age < 0) { stroke(x, [rect(px, py, px + cw, py + cw)], DIM, 1, 0.8, 0); continue; }
    const isPick = landed && i === pickI, isScan = i === scanAt;
    const col = isPick ? ORANGE : isScan ? BLUE : age < 1 ? FLASH : INK, al = landed && !isPick ? 0.35 : age < 1 ? 1 : 0.8;
    stroke(x, [rect(px, py, px + cw, py + cw)], col, al, isPick || isScan ? 1.3 : 0.9, isPick ? 2.2 - landK : 1);
    if (isPick) { const c = x.c; c.save(); c.globalAlpha = 0.85; c.fillStyle = ORANGE; c.fillRect(px + 3, py + 3, cw - 6, cw - 6); c.restore(); }
    /* each finalist's line to the join */
    const lt = cl((u - 0.3 - city * 0.012) / 0.24);
    if (lt > 0) {
      const from: Pt = [px + cw, py + cw / 2], mid: Pt = [252, from[1]], line: Poly[] = [[from, mid, J]];
      if (isPick) stroke(x, line, ORANGE, 1, 1.4, 1.6); else if (isScan) stroke(x, line, BLUE, 0.9, 1.1); else drawOn(x, line, lt, INK, landed ? 0.1 : 0.28);
    }
  }
  const jk = cl((u - 0.5) / 0.12);
  if (jk > 0) { stroke(x, [arc(J[0], J[1], 7, 7, 0, Math.PI * 2 * jk, 20)], landed ? ORANGE : INK, 0.9, 1.1); }
  if (landed) { text(x, '1', J[0], J[1] + 22, 14, ORANGE, 1, 'center'); text(x, 'THE PICK', 302, 118, 7.5, ORANGE, 1, 'right'); }
}
function finalLissajous(x: X) {
  const u = act(x), cx = 160, cy = 84, A = 92, B = 56, n = x.f.codes.length * x.f.top, m = eio(cl((u - 0.15) / 0.6)), locked = u >= 0.82;
  const curve = (i: number, ph: number): Poly => {
    const a0 = 1 + Math.floor(hash(x.cfg.seed, 90, i) * 5), b0 = 1 + Math.floor(hash(x.cfg.seed, 91, i) * 4), d0 = hash(x.cfg.seed, 92, i) * 6.28, s = 0.3 + hash(x.cfg.seed, 93, i);
    const a = a0 + (3 - a0) * m, b = b0 + (2 - b0) * m, d = d0 + ph * 6.28 * s * (1 - m) + (Math.PI / 2 - d0) * m, p: Poly = [];
    for (let k = 0; k <= 140; k++) { const t = (k / 140) * Math.PI * 2; p.push([cx + A * Math.sin(a * t + d), cy + B * Math.sin(b * t)]); }
    return p;
  };
  if (!locked) {
    for (let k = Math.min(x.cfg.trail, 6); k >= 0; k--) {
      const ph = x.ph - k * 0.004, polys: Poly[] = []; for (let i = 0; i < n; i++) polys.push(curve(i, ph));
      stroke(x, polys, k ? BLUE : INK, (k ? Math.pow(x.cfg.decay, k) * 0.25 : 0.32) * (1 - m * 0.4), 0.6, k ? 0 : 0.6);
    }
  }
  if (m > 0.6) stroke(x, [curve(0, x.ph)], locked ? ORANGE : INK, locked ? 1 : (m - 0.6) * 2, locked ? 1.3 : 1, locked ? 1.8 : 1);
  text(x, finN(x.f) + ' FINALISTS', 18, 22, 7.5, GREY);
  if (locked) text(x, 'ONE PICK', 302, 22, 7.5, ORANGE, 1, 'right');
  text(x, finN(x.f) + ' → 1', 302, 168, 8, locked ? ORANGE : GREY, 1, 'right');
}

/* ===== The global prize ===== */
const DRUM = ' $0123456789,';
function cashFlap(x: X) {
  const u = act(x), s = '$10,000', cw = 36, ch = 60, g = 4, x0 = (VW - (s.length * cw + (s.length - 1) * g)) / 2, y0 = 42, c = x.c, L = DRUM.length;
  const lastAt = 0.14 + (s.length - 1) * 0.075, lk = cl((u - lastAt) / 0.18);
  [...s].forEach((t, i) => {
    const px = x0 + i * (cw + g), at = 0.14 + i * 0.075, ti = DRUM.indexOf(t), rate = 70, left = (at - u) * rate, flips = Math.max(0, Math.ceil(left));
    const shown = u < 0.04 ? ' ' : DRUM[(((ti - flips) % L) + L) % L];
    c.save(); c.fillStyle = FACE; c.fillRect(px, y0, cw, ch); c.restore();
    stroke(x, [rect(px, y0, px + cw, y0 + ch)], DIM, 1, 0.8, 0);
    const col = lk > 0 ? (lk < 1 ? ORANGE : INK) : INK;
    text(x, shown, px + cw / 2, y0 + ch / 2 + 15, 42, col, 1, 'center');
    stroke(x, [[[px, y0 + ch / 2], [px + cw, y0 + ch / 2]]], '#000000', 0.9, 1.2, 0);
    if (flips > 0 && u >= 0.04) { const f = left - Math.floor(left); stroke(x, [[[px + 1, y0 + ch * f], [px + cw - 1, y0 + ch * f]]], FLASH, 0.5, 0.8); }
  });
  if (lk > 0 && lk < 1) stroke(x, [rect(x0 - 6, y0 - 6, x0 + s.length * (cw + g) + 2, y0 + ch + 6)], ORANGE, 1 - lk, 1, 2.4 * (1 - lk));
  text(x, '1 of ' + finN(x.f) + ' finalists', 18, 132, 8, INK, 0.9);
  timeOdometer(x, u);
}
function timeOdometer(x: X, u: number) { stroke(x, [[[18, 164], [18 + 284 * eo(cl(u / 0.7)), 164]]], ORANGE, 0.8, 1.2); stroke(x, [[[18, 164], [302, 164]]], DIM, 0.6, 1, 0); }
function cashVector(x: X) {
  const u = act(x), s = segText('$10,000', 26, 46, 26, 54), t = eio(cl(u / 0.62)), sweep = cl((u - 0.68) / 0.22), done = u >= 0.92;
  const dollar = s.polys.slice(0, 6), rest = s.polys.slice(6);
  drawOn(x, [...dollar, ...rest], t, INK, 0.95);
  if (done) stroke(x, dollar, ORANGE, 1, 1.2, 1.6);
  if (sweep > 0 && sweep < 1) { const sx = 18 + sweep * 290, c = x.c; c.save(); c.beginPath(); c.rect(sx - 14, 0, 28, VH); c.clip(); stroke(x, s.polys, FLASH, 0.95, 1.4, 2); c.restore(); }
  text(x, '1 of ' + finN(x.f) + ' finalists', 18, 132, 8, INK, 0.9);
  timeOdometer(x, u);
}

/* ===== The city prize ===== */
type V3 = [number, number, number];
function neoLaptop(x: X) {
  const u = act(x), open = eio(cl((u - 0.04) / 0.38)), th = open * (Math.PI * 0.6), power = cl((u - 0.46) / 0.14), yaw = -0.55 + 0.32 * Math.sin(x.ph * Math.PI * 2), pitch = 0.42;
  const P = ([px, py, pz]: V3): Pt => {
    const x1 = px * Math.cos(yaw) - pz * Math.sin(yaw), z1 = px * Math.sin(yaw) + pz * Math.cos(yaw);
    const y2 = py * Math.cos(pitch) - z1 * Math.sin(pitch), z2 = py * Math.sin(pitch) + z1 * Math.cos(pitch), d = 5, fl = 215;
    return [168 + (fl * x1) / (z2 + d), 128 - (fl * y2) / (z2 + d)];
  };
  const W = 1, D = 0.7, T = 0.07, Lh = 1.3;
  const lid = (sx: number, s: number): V3 => [sx, T + s * Math.sin(th), -D + s * Math.cos(th)];
  const poly = (pts: V3[]) => pts.map(P);
  const base: Poly[] = [
    poly([[-W, 0, -D], [W, 0, -D], [W, 0, D], [-W, 0, D], [-W, 0, -D]]), poly([[-W, T, -D], [W, T, -D], [W, T, D], [-W, T, D], [-W, T, -D]]),
    poly([[-W, 0, D], [-W, T, D]]), poly([[W, 0, D], [W, T, D]]), poly([[W, 0, -D], [W, T, -D]]), poly([[-W, 0, -D], [-W, T, -D]]),
    poly([[-0.32, T, 0.28], [0.32, T, 0.28], [0.32, T, 0.6], [-0.32, T, 0.6], [-0.32, T, 0.28]]),
  ];
  for (let r = 0; r < 4; r++) base.push(poly([[-0.82, T, -0.56 + r * 0.17], [0.82, T, -0.56 + r * 0.17]]));
  stroke(x, base, INK, 0.8, 0.9);
  const lidO = [lid(-W, 0), lid(W, 0), lid(W, Lh), lid(-W, Lh), lid(-W, 0)].map(P), lidI = [lid(-W + 0.08, 0.08), lid(W - 0.08, 0.08), lid(W - 0.08, Lh - 0.08), lid(-W + 0.08, Lh - 0.08), lid(-W + 0.08, 0.08)].map(P);
  stroke(x, [lidO], INK, 0.95, 1.1); stroke(x, [lidI], INK, 0.5, 0.8);
  if (power > 0) {
    const c = x.c; c.save(); c.beginPath(); lidI.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.clip();
    c.globalAlpha = 0.16 * power; c.fillStyle = BLUE; c.fillRect(0, 0, VW, VH); c.restore();
    if (power < 1) { const s = Lh - 0.08 - power * (Lh - 0.16); stroke(x, [[P(lid(-W + 0.08, s)), P(lid(W - 0.08, s))]], FLASH, 1, 1.2, 1.6); }
    else {
      const codes = x.f.codes, i = Math.min(codes.length - 1, Math.floor(cl((u - 0.6) / 0.4) * codes.length)), ctr = P(lid(0, Lh / 2));
      text(x, codes[i], ctr[0], ctr[1] + 6, 17, INK, 1, 'center');
    }
  }
}
function neoTen(x: X) {
  const u = act(x), codes = x.f.codes, per = Math.ceil(codes.length / 2);
  codes.forEach((code, i) => {
    const col = i % per, row = Math.floor(i / per), cx = 18 + 28 + col * 56.8, by = 78 + row * 74, at = 0.04 + i * 0.065, o = eo(cl((u - at) / 0.12)), lit = u - at > 0.14;
    const lh = 34 * Math.sin(o * Math.PI * 0.5), lw = 21;
    stroke(x, [[[cx - 26, by], [cx + 26, by], [cx + 22, by - 5], [cx - 22, by - 5], [cx - 26, by]]], INK, 0.75, 0.9);
    if (lh > 0.5) {
      stroke(x, [rect(cx - lw, by - 5 - lh, cx + lw, by - 5)], lit ? INK : GREY, lit ? 0.95 : 0.7, 1);
      if (lit) { const c = x.c; c.save(); c.globalAlpha = 0.18; c.fillStyle = BLUE; c.fillRect(cx - lw + 2, by - 3 - lh, lw * 2 - 4, lh - 4); c.restore(); text(x, code, cx, by - 5 - lh / 2 + 3, 8, INK, 1, 'center'); }
    } else stroke(x, [[[cx - lw, by - 6], [cx + lw, by - 6]]], GREY, 0.8);
    const age = (u - at - 0.14) / 0.3; if (age > 0 && age < 1) { const [cc, al] = p7(age); dot(x, [cx + lw - 4, by - 9 - lh + 4], 1.6, cc, al); }
  });
}

/* ===== One tube plays the day: build, vote, final, with a picture-tube switch between ===== */
const SCENES: Record<string, Record<string, (x: X) => void>> = {
  build: { beam: buildBeam, boot: buildBoot }, vote: { trace: voteTrace, radar: voteRadar }, final: { thirty: finalThirty, lissajous: finalLissajous },
  cash: { flap: cashFlap, vector: cashVector }, neo: { laptop: neoLaptop, ten: neoTen },
};
export const reelStep = (ph: number) => Math.min(2, Math.floor(ph * 3));

export function renderScope(c: CanvasRenderingContext2D, scene: Scene, ph: number, cfg: ScopeCfg, f: Facts, fo: Fonts, k: number, boost = 1) {
  const frame = Math.floor(ph * cfg.loop * cfg.fps * (scene === 'reel' ? 3 : 1));
  c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, c.canvas.width, c.canvas.height); c.restore();
  c.setTransform(k, 0, 0, k, 0, 0);
  if (scene !== 'reel') { const mode = cfg[scene] as string; SCENES[scene][mode]({ c, cfg, f, fo, k, boost, frame, ph }); return; }
  const step = reelStep(ph), sub = ph * 3 - step, name = (['build', 'vote', 'final'] as const)[step];
  /* the switch: the picture collapses to a line and opens again on the next one */
  const edge = 0.035, s = sub < edge ? sub / edge : sub > 1 - edge ? (1 - sub) / edge : 1;
  if (s < 1) { c.translate(0, VH / 2); c.scale(1, Math.max(0.02, eo(s))); c.translate(0, -VH / 2); }
  SCENES[name][cfg[name] as string]({ c, cfg, f, fo, k, boost: boost * (s < 1 ? 1 + (1 - s) * 2 : 1), frame, ph: sub });
  if (s < 1) { c.setTransform(k, 0, 0, k, 0, 0); const x: X = { c, cfg, f, fo, k, boost, frame, ph: sub }; stroke(x, [[[0, VH / 2], [VW, VH / 2]]], FLASH, 1 - s, 1.2, 2); }
}
