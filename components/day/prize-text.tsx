'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { MONO, type WheelCfg } from '@/components/wheel/config';
import { globeLook } from '@/components/wheel/globe-look';
import { STUDY, drawTextGlobe, layoutOf, loadFrames, loadLand, sizeOf, type Frames, type LandMap, type Layout, type TextGlobeLook } from '@/components/wheel/text-globe';
import { useReduced } from './tube';
import './prize-text.css';

/* The pick's prize with the text globe (the preview page, when the wheel's globe is the text globe). The amount is big
   type on a canvas (the words are in the page beside it, for reading aloud and copying); `cfg.prize` says what the globe
   does with it:

   - lens: the text globe, about twice the digits' height, sits over the end of the amount. Inside its disc the type is
     not drawn: the part of the last 0 that falls inside is redrawn in the globe's own cells, solid, chosen by how much
     of the digit covers each cell (the edge cells by which half it covers), so the 0 keeps its outer shape and its open
     middle while the land steps past behind it. `prizeOverlap` puts the disc's edge through the 0's open middle (half
     type, half cells) or the whole 0 inside. On a phone the globe hangs below the amount and takes the 0's lower quarter.
   - beside: the globe beside the last figure, its rim just touching it (the first try, kept for comparing).
   - protected: no globe; a band of the land's hatch or of stars runs the full width into and out of the digits, the
     way a cheque writer protects an amount, with one green cell after it.
   - none: no globe and no band; the digits step into place once, the last a beat late.

   `prizeBand` adds the band to the lens too. With `prizeTurn: once` the globe turns once when the amount comes into
   view, on the globe's own steps, and comes to rest facing the Americas (the shirt's face); the green brackets visit
   each city as it passes the front. Still, they visit the cities on this side once. Reduced motion: no turn, no visit,
   the digits at once. Under it, a globe of dots for each city, facing it, its code under it. */

export type TextCity = { code: string; lat: number; lon: number };
const font = (v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const wrap = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
const grey = (v: number, a: number) => `rgba(${v}, ${v}, ${Math.max(0, v - 2)}, ${a})`;

/* The digit's cells inside the disc: which cells the type is cut from, and what is drawn in each (a whole cell or one
   half of it). Measured once per size from a picture of the type itself, so the cells line up with the type. */
type Rect = [number, number, number, number];
type Lens = { cut: Rect[]; fill: Rect[]; full: Rect[] };
function lensCells(mask: Uint8ClampedArray, mw: number, mh: number, lay: Layout, cx: number, cy: number, R: number, cover: number): Lens {
  const { colW, lineH, left, top, g } = lay, cut: Rect[] = [], fill: Rect[] = [], full: Rect[] = [];
  /* the share of a rectangle the type covers (alpha over half) */
  const share = (x0: number, y0: number, w: number, h: number) => {
    let n = 0, k = 0;
    for (let y = Math.max(0, y0); y < Math.min(mh, y0 + h); y++) for (let x = Math.max(0, x0); x < Math.min(mw, x0 + w); x++) { k++; if (mask[(y * mw + x) * 4 + 3] > 127) n++; }
    return k ? n / k : 0;
  };
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const x = left + c * colW, y = top + r * lineH;
    if ((x + colW / 2 - cx) ** 2 + (y + lineH / 2 - cy) ** 2 > R * R) continue;
    if (x + colW < 0 || x > mw || y + lineH < 0 || y > mh) continue;
    const all = share(x, y, colW, lineH);
    if (all === 0) continue;
    cut.push([x, y, colW, lineH]);
    if (all >= cover) { fill.push([x, y, colW, lineH]); full.push([x, y, colW, lineH]); continue; }
    /* an edge cell: the half the digit covers most, if it covers enough of it */
    const hw = Math.round(colW / 2), hh = Math.round(lineH / 2);
    const halves: [number, Rect][] = [
      [share(x, y, hw, lineH), [x, y, hw, lineH]], [share(x + hw, y, colW - hw, lineH), [x + hw, y, colW - hw, lineH]],
      [share(x, y, colW, hh), [x, y, colW, hh]], [share(x, y + hh, colW, lineH - hh), [x, y + hh, colW, lineH - hh]],
    ];
    halves.sort((a, b) => b[0] - a[0]);
    if (halves[0][0] >= cover) fill.push(halves[0][1]);
  }
  return { cut, fill, full };
}

/* `rule`: the line that says who wins, set right under the amount (before the row of small globes) */
export function PrizeText({ amount, cities, cfg, check = false, rule }: { amount: string; cities: TextCity[]; cfg: WheelCfg; check?: boolean; rule?: ReactNode }) {
  const host = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), reduced = useReduced();
  useEffect(() => {
    const el = host.current, c = cv.current; if (!el || !c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let art: { frames: Frames | null; land: LandMap | null } | null = null, live = true, raf = 0, timer = 0;
    /* the motion's state: the step of the turn (-1: not begun), the city visited (still), the digits shown (none) */
    let turn = -1, visit = -1, shown = reduced ? Infinity : 0, low = false;
    const fam = font('--font-geist') || 'sans-serif', mono = MONO.geist.replace(/var\((--[\w-]+)\)/g, (_m, v: string) => font(v) || 'monospace');
    const green = font('--green') || '#3ecf8e';
    const mode = cfg.prize, still = STUDY.first, steps = STUDY.frames;
    const ink = `rgb(${cfg.ink} ${cfg.ink} ${cfg.ink - 2})`;
    const look: TextGlobeLook = { ...globeLook(cfg, mono, green), marks: 'all', rim: false };
    /* the cities on the shirt's side, in the order they start (the list is east to west, the order of the day) */
    const near = cities.map((ct, i) => ({ ct, i })).filter(({ ct }) => Math.cos((ct.lat * Math.PI) / 180) * Math.cos(((ct.lon - still) * Math.PI) / 180) > 0.08);
    const facingNow = () => (turn >= 0 && turn < steps ? still - turn * STUDY.step : still);
    /* the city the brackets are on: in the turn, the one passing the front; still, the one being visited */
    const activeNow = (facing: number) => {
      if (turn >= 0 && turn < steps) {
        let best = -1, d = 14;
        cities.forEach((ct, i) => { const a = Math.abs(wrap(ct.lon - facing)); if (a < d) { d = a; best = i; } });
        return best;
      }
      return visit >= 0 ? near[visit]?.i ?? -1 : -1;
    };
    type Geo = { fs: number; base: number; yc: number; R: number; cx: number; cy: number; zr: number; x0: number; mask: Uint8ClampedArray; lens: Lens | null; lay: Layout | null };
    let memo: { key: string; geo: Geo | null } = { key: '', geo: null };

    const draw = () => {
      raf = 0;
      const ratio = Math.min(devicePixelRatio || 1, 3), w = Math.round(el.clientWidth * ratio), h = Math.round(el.clientHeight * ratio);
      if (!w || !h) return;
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      ctx.clearRect(0, 0, w, h);
      const phone = el.clientWidth < 560;
      const set = (s: number) => { ctx.font = `500 ${s}px ${fam}`; ctx.letterSpacing = -0.04 * s + 'px'; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; return ctx.measureText(amount); };
      /* the digits' height and how far the baseline sits below their middle, for a size */
      const digit = (s: number) => { set(s); const z = ctx.measureText('0'); return { capH: z.actualBoundingBoxAscent + z.actualBoundingBoxDescent, lift: (z.actualBoundingBoxAscent - z.actualBoundingBoxDescent) / 2 }; };
      const facing = facingNow(), active = activeNow(facing);

      if (mode === 'beside' || mode === 'none') {
        let fs = h * 0.62, m = set(fs);
        const globe = (s: number) => s * 0.62, room = mode === 'beside' ? 2 * globe(fs) : 0;
        if (m.width + room > w) { fs *= w / (m.width + room); m = set(fs); }
        const base = h / 2 + digit(fs).lift;
        set(fs); ctx.fillStyle = ink;
        if (mode === 'none') {
          /* the digits in place up to `shown`, the newest a little low for one step; the final width is the canvas's */
          const glyphs = Array.from(amount), n = Math.min(glyphs.length, shown);
          for (let k = 0; k < n; k++) {
            const x = m.width - ctx.measureText(glyphs.slice(k).join('')).width;
            ctx.fillText(glyphs[k], x, base + (low && k === n - 1 ? 0.06 * fs : 0));
          }
          return;
        }
        ctx.fillText(amount, 0, base);
        if (!art) return;
        const R = Math.min(globe(fs), h / 2 - ratio), x = Math.min(w - R, m.actualBoundingBoxRight + R);
        const size = sizeOf(R, ratio, { mid: 120, large: cfg.globeLarge });
        drawTextGlobe(ctx, { x, y: h / 2, r: R, ratio, facing, cities, active, bracket: active >= 0, frames: art.frames, land: art.land, look, size });
        return;
      }

      /* lens and protected: the type's size from the room, the globe's from the type; measured once per size */
      const lensed = mode === 'lens' && !!art?.frames;
      const key = [w, h, amount, mode, lensed, phone, cfg.prizeSize, cfg.prizeY, cfg.prizeOverlap, cfg.prizeCover].join(':');
      if (memo.key !== key) {
        let fs = lensed && !phone ? (h - 2 * ratio) / (cfg.prizeSize * 0.73) : h * 0.62;
        const off = document.createElement('canvas'); off.width = w; off.height = h;
        const o = off.getContext('2d'); if (!o) return;
        let geo: Geo | null = null;
        for (let tries = 0; tries < 5 && !geo; tries++) {
          const m = set(fs), d = digit(fs);
          /* protected: the band shows before the amount too, three cells of it */
          const R0 = (cfg.prizeSize * d.capH) / 2, x0 = mode === 'protected' ? 3 * Math.max(1, Math.round(R0 / STUDY.rx)) : 0;
          const room = lensed && !phone ? w : w * 0.94;
          if (m.width + x0 > room) { fs *= room / (m.width + x0); continue; }
          const yc = phone && lensed ? 2 * ratio + d.capH * 0.62 : h / 2, base = yc + d.lift;
          set(fs);
          o.clearRect(0, 0, w, h); o.font = ctx.font; o.letterSpacing = ctx.letterSpacing; o.textBaseline = 'alphabetic'; o.fillStyle = '#fff';
          o.fillText(amount, x0, base);
          const mask = o.getImageData(0, 0, w, h).data;
          /* the last figure's ink: the rightmost column with ink, then left to the first column without */
          const y0 = Math.max(0, Math.floor(yc - d.capH)), y1 = Math.min(h, Math.ceil(yc + d.capH));
          const has = (x: number) => { for (let y = y0; y < y1; y++) if (mask[(y * w + x) * 4 + 3] > 127) return true; return false; };
          let zr = w - 1; while (zr > 0 && !has(zr)) zr--;
          let zl = zr; while (zl > 0 && has(zl)) zl--;
          zl++;
          let R = R0, cx: number, cy = yc + cfg.prizeY * R;
          if (phone) {
            /* the globe hangs below, centred under the last 0, its top through the 0's lower part (the 0 before it all but
               untouched), at least 150 px tall so its characters read; the amount is set smaller until it fits */
            const dip = yc + 0.3 * d.capH;
            R = Math.min(Math.max(R0, 75 * ratio), (h - ratio - dip) / 2);
            cx = (zl + zr) / 2; cy = dip + R;
            if (lensed && cx + R > w - ratio && tries < 4) { fs *= (w - R - ratio) / cx; continue; }
            cx = Math.min(cx, w - R - ratio);
          } else {
            cx = cfg.prizeOverlap === 'whole' ? zl + 0.86 * R : (zl + zr) / 2 + R;
            if (lensed && cx + R > w - ratio) { fs *= (w - ratio) / (cx + R); continue; }
          }
          let lay: Layout | null = null, lens: Lens | null = null;
          if (lensed && art) {
            lay = layoutOf({ x: cx, y: cy, r: R, ratio, facing: still, frames: art.frames, land: art.land, look, size: 'large' });
            lens = lay ? lensCells(mask, w, h, lay, cx, cy, R, cfg.prizeCover) : null;
          }
          geo = { fs, base, yc, R, cx, cy, zr, x0, mask, lens, lay };
        }
        if (!geo) return;
        memo = { key, geo };
      }
      const geo = memo.geo!, { R, cx, cy, base, x0, mask, lens, lay } = geo;
      set(geo.fs);

      /* the type, cut out where the lens's cells are */
      ctx.save();
      if (lens) { ctx.beginPath(); ctx.rect(0, 0, w, h); for (const [x, y, cw, ch] of lens.cut) ctx.rect(x, y, cw, ch); ctx.clip('evenodd'); }
      ctx.fillStyle = ink; ctx.fillText(amount, x0, base);
      ctx.restore();

      /* the band: the land's hatch or stars across the whole width, where the type is not, up to the globe's disc */
      const band = mode === 'protected' ? (cfg.prizeBand === 'off' ? 'stars' : cfg.prizeBand) : cfg.prizeBand;
      if (band !== 'off') {
        const colW = lay?.colW ?? Math.max(1, Math.round(R / STUDY.rx)), lineH = lay?.lineH ?? Math.max(1, Math.round(R / STUDY.ry));
        const ox = lay ? ((lay.left % colW) + colW) % colW : 0, n = cfg.prizeBandRows, top = Math.round(geo.yc - (n * lineH) / 2);
        ctx.font = `500 ${colW / 0.6}px ${mono}`; ctx.letterSpacing = '0px'; ctx.textBaseline = 'middle';
        let lit = false;
        for (let r = 0; r < n; r++) for (let x = ox; x + colW <= w; x += colW) {
          const y = top + r * lineH, my = Math.round(y + lineH / 2);
          if (lens && (x + colW / 2 - cx) ** 2 + (my - cy) ** 2 <= (R + colW) ** 2) continue;
          let inked = false;
          for (let yy = Math.max(0, y); yy < Math.min(h, y + lineH) && !inked; yy += 2) for (let xx = x; xx < x + colW; xx += 2) if (mask[(yy * w + xx) * 4 + 3] > 40) { inked = true; break; }
          if (inked) continue;
          const after = mode === 'protected' && !lit && r === Math.floor((n - 1) / 2) && x > geo.zr + colW;
          if (after) lit = true;
          ctx.fillStyle = after ? green : grey(cfg.ink, cfg.globeMarkInk);
          ctx.fillText(after ? '+' : band === 'stars' ? '*' : (Math.round(x / colW) + r) % 3 === 0 ? '|' : ':', x, my);
        }
        set(geo.fs);
      }

      if (lens && lay && art) {
        drawTextGlobe(ctx, { x: cx, y: cy, r: R, ratio, facing, cities, active, bracket: active >= 0, frames: art.frames, land: art.land, look, size: 'large' });
        /* the digit's cells: each cell cleared, then filled solid (a hairline left between cells) or with the densest
           character */
        for (const [x, y, cw, ch] of lens.cut) ctx.clearRect(x, y, cw, ch);
        ctx.fillStyle = ink;
        if (cfg.prizeCell === 'char') {
          ctx.font = `500 ${lay.colW / 0.6}px ${mono}`; ctx.letterSpacing = '0px'; ctx.textBaseline = 'middle';
          for (const [x, y, , ch] of lens.full) ctx.fillText('#', x, y + ch / 2);
        } else {
          const gap = cfg.prizeCell === 'gap' ? Math.max(1, Math.round(ratio * 0.75)) : 0;
          for (const [x, y, cw, ch] of lens.fill) ctx.fillRect(x, y, Math.max(1, cw - gap), Math.max(1, ch - gap));
        }
        set(geo.fs);
      }
      /* the lab's check: the real type drawn over the cells, to see that they line up */
      if (check) { ctx.fillStyle = 'rgba(255, 70, 70, 0.45)'; ctx.fillText(amount, x0, base); }
    };
    const go = () => { if (!raf) raf = requestAnimationFrame(draw); };
    Promise.all([loadFrames(), loadLand(), document.fonts?.ready]).then(([frames, land]) => { if (live) { art = { frames, land }; go(); } });
    /* the motion: once, when the amount is well in view */
    const stepMs = 1000 / cfg.globeFps;
    let looping = false;
    const io = new IntersectionObserver(([e]) => {
      if (looping && !e.isIntersecting) { window.clearTimeout(timer); looping = false; return; }
      if (!e.isIntersecting || reduced) return;
      if (!(mode === 'lens' && cfg.prizeTurn === 'loop')) io.disconnect();
      if (mode === 'none') {
        /* a digit a step, each a little low for its first step; the last waits a beat */
        const n = Array.from(amount).length;
        const next = () => {
          if (shown >= n) { low = false; shown = Infinity; go(); return; }
          shown++; low = true; go();
          timer = window.setTimeout(next, shown === n - 1 ? stepMs * 3 : stepMs);
        };
        next();
        return;
      }
      if (mode === 'protected') return;
      if (mode === 'lens' && cfg.prizeTurn === 'loop') {
        /* the turn goes round for as long as the amount is on screen, and rests when it is not */
        if (looping) return;
        looping = true;
        const next = () => { turn = (turn + 1) % steps; go(); timer = window.setTimeout(next, stepMs); };
        turn = 0; go(); timer = window.setTimeout(next, stepMs);
        return;
      }
      if (mode === 'lens' && cfg.prizeTurn === 'once') {
        const next = () => { turn++; go(); if (turn < steps) timer = window.setTimeout(next, stepMs); };
        turn = 0; go(); timer = window.setTimeout(next, stepMs);
        return;
      }
      if (!near.length) return;
      const next = () => { visit++; go(); if (visit < near.length) timer = window.setTimeout(next, stepMs * 2); else { visit = near.length; go(); } };
      visit = 0; go(); timer = window.setTimeout(next, stepMs * 2);
    }, { threshold: 0.6 });
    io.observe(el);
    const ro = new ResizeObserver(go); ro.observe(el);
    go();
    return () => { live = false; cancelAnimationFrame(raf); window.clearTimeout(timer); io.disconnect(); ro.disconnect(); };
  }, [amount, cities, cfg, reduced, check]);
  return (
    <div className="pt" data-prize={cfg.prize}>
      <div ref={host} className="pt-stage"><canvas ref={cv} aria-hidden="true" /></div>
      {rule}
      <ul className="pt-row" aria-label={`One in each of the ${cities.length} cities`}>
        {cities.map((ct) => <li key={ct.code}><span className="pt-dot" data-dot="" data-lat={ct.lat} data-lon={ct.lon} aria-hidden="true" /><span>{ct.code}</span></li>)}
      </ul>
    </div>
  );
}
