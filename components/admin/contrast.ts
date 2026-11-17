import type { ScreenCfg } from '@/components/screen/config';

/* Contrast of the small text on a framed page, with the screen lines on. For each piece of text under the big-type
   size: its colour against what is behind it, on a plain row and on a line row, and the worse of the two counts.
   At depth "all" a line row darkens the text and its ground together (the page is masked over the ground); at
   "big" and "none" the text is over the lines, so only an open ground behind it gets darker. Colours are read
   through a canvas, so oklch and color-mix come out as the sRGB the screen shows. */

type RGBA = [number, number, number, number];
export type Contrast = { n: number; min: number; under: number; worst: { text: string; ratio: number }[] };

let pen: CanvasRenderingContext2D | null = null;
function rgba(css: string): RGBA {
  if (!pen) { const c = document.createElement('canvas'); c.width = c.height = 1; pen = c.getContext('2d', { willReadFrequently: true }); }
  const p = pen!; p.clearRect(0, 0, 1, 1); p.fillStyle = '#000'; p.fillStyle = css; p.fillRect(0, 0, 1, 1);
  const d = p.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}
const over = (top: RGBA, under: [number, number, number]): [number, number, number] => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3])) as [number, number, number];
const lum = (c: [number, number, number]) => { const f = (v: number) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
export const ratio = (a: [number, number, number], b: [number, number, number]) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const dim = (c: [number, number, number], a: number, g: [number, number, number]) => [0, 1, 2].map((i) => c[i] * (1 - a) + g[i] * a) as [number, number, number];

export function measure(doc: Document, cfg: ScreenCfg): Contrast {
  const win = doc.defaultView!;
  const ground = rgba(win.getComputedStyle(doc.documentElement).backgroundColor);
  const G: [number, number, number] = [ground[0], ground[1], ground[2]];
  const black: [number, number, number] = [0, 0, 0];
  const a = cfg.depth === 'none' ? 0 : cfg.lineAlpha;
  const out: { text: string; ratio: number }[] = [];
  doc.body.querySelectorAll<HTMLElement>('*').forEach((e) => {
    /* what a reader sees: drawn text counts even when a screen-reader copy stands in for it; the tuning chrome does not */
    if (e.closest('.lab, .lab-toggle, .proto-picker, .sk-layers, .sr-only, script, style, noscript')) return;
    let own = ''; e.childNodes.forEach((n) => { if (n.nodeType === 3) own += n.textContent || ''; });
    own = own.trim(); if (!own) return;
    const cs = win.getComputedStyle(e), r = e.getBoundingClientRect();
    if (r.width <= 1 || r.height <= 1 || cs.visibility === 'hidden' || parseFloat(cs.fontSize) >= cfg.bigFrom) return;
    let op = 1; for (let x: HTMLElement | null = e; x; x = x.parentElement) { op *= parseFloat(win.getComputedStyle(x).opacity); if (op === 0) return; }
    let bg: [number, number, number] | null = null;
    for (let x: HTMLElement | null = e; x && x !== doc.body; x = x.parentElement) {
      const b = rgba(win.getComputedStyle(x).backgroundColor);
      if (b[3] >= 0.5) { bg = over(b, G); break; }
    }
    const open = !bg; const back = bg ?? G;
    const fg0 = rgba(cs.color); const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * op], back);
    let worst = ratio(fg, back);
    if (a > 0 && cfg.depth === 'all') worst = Math.min(worst, ratio(dim(fg, a, G), dim(back, a, G)));
    else if (a > 0 && open) worst = Math.min(worst, ratio(fg, dim(back, a, black)));
    out.push({ text: own.slice(0, 40), ratio: worst });
  });
  out.sort((x, y) => x.ratio - y.ratio);
  return { n: out.length, min: out.length ? out[0].ratio : 0, under: out.filter((o) => o.ratio < 7).length, worst: out.slice(0, 8) };
}
