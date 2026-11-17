'use client';
import { useEffect, useSyncExternalStore } from 'react';
import type { Project } from '@/lib/data';
import { PICTURE_H, PICTURE_W, drawPicture } from '@/lib/pictures';

/* Pictures for the ranking, small and many. The project pictures are drawn in the browser; the page's own hook draws
   each one at full size (1280 x 720) the moment a row asks, which is fine for one monitor and slow for sixty rows. This
   draws a thumbnail at the size it is shown, a few at a time while the page is idle, so the rows paint as text first
   and the pictures fill in. A project with a real screenshot (`image`) uses it as is.

   The pictures follow a broadcast gallery's rules (the ranking lab's "Pictures" modes):
   - every picture is a monitor: 16:9, letterboxed on the ground, a 1px rule, no radius, never cropped;
   - every monitor has a label strip under it (the UMD): place, name, votes; nothing is written over a picture;
   - a lamp (the tally) says which is on air: orange for the leader, blue for one you voted for;
   - a picture's size follows its band (the three finalists' places, then the rest), never its votes;
   - the pictures are the brightest things on the page, so they sit a step dimmer until you point at one. */

const cache = new Map<string, string>(), queue: { k: string; p: Project; w: number }[] = [], subs = new Set<() => void>();
let fonts = false, running = false, pending = 0;
function notify() { if (pending) return; pending = requestAnimationFrame(() => { pending = 0; subs.forEach((f) => f()); }); }
function subscribe(fn: () => void) {
  subs.add(fn);
  if (!fonts && typeof document !== 'undefined') document.fonts.ready.then(() => { if (fonts) return; fonts = true; pump(); });
  return () => { subs.delete(fn); };
}
type Idle = { timeRemaining: () => number };
const idle = (cb: (d: Idle) => void) => {
  const ric = (window as unknown as { requestIdleCallback?: (f: (d: Idle) => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (ric) ric(cb, { timeout: 300 }); else window.setTimeout(() => cb({ timeRemaining: () => 8 }), 16);
};
function families() {
  const cs = getComputedStyle(document.documentElement);
  return { sans: cs.getPropertyValue('--font-geist').trim() || '"Geist"', mono: cs.getPropertyValue('--font-geist-mono').trim() || '"Geist Mono"' };
}
function draw(j: { k: string; p: Project; w: number }) {
  const cv = document.createElement('canvas'), h = Math.round((j.w * PICTURE_H) / PICTURE_W);
  cv.width = j.w; cv.height = h;
  const c = cv.getContext('2d'); if (!c) { cache.set(j.k, ''); return; }
  c.setTransform(j.w / PICTURE_W, 0, 0, h / PICTURE_H, 0, 0);
  try { drawPicture(c, j.p, families()); } catch { /* a picture that fails stays an empty monitor */ }
  cv.toBlob((b) => { if (b) { cache.set(j.k, URL.createObjectURL(b)); notify(); } }, 'image/jpeg', 0.84);
}
function pump() {
  if (running || !fonts || !queue.length) return;
  running = true;
  const step = (d: Idle) => {
    do { const j = queue.shift(); if (j) draw(j); } while (queue.length && d.timeRemaining() > 4);
    if (queue.length) idle(step); else running = false;
  };
  idle(step);
}
/* the drawn width, in device pixels, rounded up to a few sizes so a knob that moves does not redraw everything */
const bucket = (cssW: number) => { const px = cssW * Math.min(2, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1); return px <= 160 ? 160 : px <= 320 ? 320 : 640; };
const keyOf = (p: Project, w: number) => p.id + ':' + w;

export function useThumb(p: Project, cssW: number): string {
  const w = bucket(cssW), k = keyOf(p, w);
  useEffect(() => {
    if (p.image || cache.has(k)) return;
    cache.set(k, ''); queue.push({ k, p, w }); pump();
  }, [k, p, w]);
  /* while a bigger size draws, show a smaller one already drawn, so a monitor never goes blank */
  return useSyncExternalStore(subscribe, () => p.image || cache.get(k) || cache.get(keyOf(p, 320)) || cache.get(keyOf(p, 160)) || '', () => p.image || '');
}

/* one monitor: the picture letterboxed in a 16:9 tube; an empty tube while it draws */
export function Thumb({ p, w, cls }: { p: Project; w: number; cls?: string }) {
  const src = useThumb(p, w);
  // eslint-disable-next-line @next/next/no-img-element -- a drawn blob URL, not a static asset
  return <span className={'rp-tube' + (cls ? ' ' + cls : '')} aria-hidden="true">{src ? <img src={src} alt="" decoding="async" /> : null}</span>;
}

/* the ranking's picture modes and their knobs */
export type PicMode = 'none' | 'thumbs' | 'strip' | 'multiview' | 'pip';
export type PicCfg = { pics: PicMode; thumbW: number; picRows: number; cols: number; tally: number; dim: number };
export const PIC_DEF: PicCfg = { pics: 'thumbs', thumbW: 112, picRows: 60, cols: 4, tally: 1, dim: 0.86 };
export const PIC_MODES: [PicMode, string][] = [['none', 'No pictures'], ['thumbs', 'A thumbnail per row'], ['strip', 'Contact strip over the list'], ['multiview', 'Multiviewer (a wall of monitors)'], ['pip', 'Picture in picture (follows the pointer)']];
export const PIC_BOUNDS = { thumbW: [64, 200, 4] as [number, number, number], picRows: [3, 60, 1] as [number, number, number], cols: [2, 6, 1] as [number, number, number], dim: [0.6, 1, 0.02] as [number, number, number] };
export function clampPics(s: Partial<PicCfg>): PicCfg {
  const c = { ...PIC_DEF, ...s };
  const cl = (v: number, [a, b]: [number, number, number]) => Math.min(b, Math.max(a, Number.isFinite(+v) ? +v : a));
  return {
    pics: PIC_MODES.some(([m]) => m === c.pics) ? c.pics : PIC_DEF.pics,
    thumbW: Math.round(cl(c.thumbW, PIC_BOUNDS.thumbW)), picRows: Math.round(cl(c.picRows, PIC_BOUNDS.picRows)), cols: Math.round(cl(c.cols, PIC_BOUNDS.cols)),
    tally: c.tally ? 1 : 0, dim: Math.round(cl(c.dim, PIC_BOUNDS.dim) * 100) / 100,
  };
}
