'use client';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { drawGlass, glassLand, type GlassGlobe } from './beam';
import { useReduced, useTubesStill } from './tube';
import { WHEEL_DEF } from '@/components/wheel/config';

/* The prizes under glass. Both prizes share one stage and one material: a picture (drawn once per size on a 2D canvas)
   and the wheel's glass globes in front of it, drawn in the tubes' shared WebGL context. Through a globe's core the
   picture shows upside down and smaller, as through a ball lens; its rim mirrors what lies just outside it, split into
   colours. The big globe turns slowly while on screen; Screen off and reduced motion hold it still, and pressing the
   globe (only the globe) holds it where it is. Without WebGL the picture alone is drawn. What the picture shows is also
   real text on the page (the caller's job); these canvases are decoration.

   - PrizeGlass: the pick's amount as big type, a big globe beside its last figure with its rim just touching it, lit
     at the pick's city, and ten small globes under it, one per city.
   - NeoGlass: the city prize, a dark laptop seen only by its screen's light and a rim of light on the lid and the
     base (one light, upper left; no outline), with a globe standing in front of the screen, bending its light. */

export type GlassCity = { code: string; lat: number; lon: number };
export type GlassLook = { mirror: number; through: number; fringe: number; turn: number };
export type GlassCfg = GlassLook & { size: number; row?: boolean; on?: boolean; big?: number; touch?: number };
/* the laptop: lid height (of its width), base depth, screen light, rim light, the diagonal streak across the screen,
   the screen's light from blue to white, and the globe's size and place on the screen */
export type NeoCfg = GlassLook & { lid: number; deck: number; screen: number; rim: number; streak: number; white: number; globe: number; gx: number; gy: number };

const INK = 'rgb(232 232 230)';
const face = WHEEL_DEF.face, rad = Math.PI / 180;
type Painted = { globes: GlassGlobe[]; hit: [number, number, number] };
type Paint = (p: { pctx: CanvasRenderingContext2D; w: number; h: number; fam: string; ratio: number }) => Painted;

function GlassStage({ paint, paintKey, look, hold, className, row }: { paint: Paint; paintKey: string; look: GlassLook; hold: string; className: string; row?: boolean }) {
  const host = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null), hit = useRef<HTMLSpanElement>(null), paused = useTubesStill(), reduced = useReduced();
  const paintRef = useRef(paint);
  useEffect(() => { paintRef.current = paint; }, [paint]);
  /* the globe turns by itself, so a press holds it where it is and a second press turns it on (as a tube does) */
  const [own, setOwn] = useState(false), holdRef = useRef<(v: boolean) => void>(() => {});
  const pressable = !paused && !reduced && look.turn > 0;
  if (!pressable && own) setOwn(false);
  const toggle = () => { const v = !own; setOwn(v); holdRef.current(v); };
  const onKey = (e: KeyboardEvent<HTMLSpanElement>) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!e.repeat) toggle(); } };
  const key = JSON.stringify([paintKey, look, paused]);
  useEffect(() => {
    const el = host.current, c = cv.current; if (!el || !c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    const pic = document.createElement('canvas'), pctx = pic.getContext('2d');
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || paused;
    let raf = 0, seen = false, last = 0, size = '', ver = 0, globes: GlassGlobe[] = [];
    let t0 = performance.now(), heldAt = -1, turnNow = 0;
    const rate = look.turn * 0.12;
    holdRef.current = (v: boolean) => {
      if (v) { heldAt = turnNow; cancelAnimationFrame(raf); raf = 0; }
      else if (heldAt >= 0) { t0 = performance.now() - (rate > 0 ? (heldAt / rate) * 1000 : 0); heldAt = -1; last = 0; go(); }
    };
    const lay = () => {
      const ratio = Math.min(devicePixelRatio || 1, 2), w = Math.round(el.clientWidth * ratio), h = Math.round(el.clientHeight * ratio);
      const s = w + 'x' + h + ':' + ver; if (s === size) return; size = s;
      c.width = w; c.height = h; pic.width = w; pic.height = h;
      if (!pctx) return;
      pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, w, h);
      const out = paintRef.current({ pctx, w, h, fam: getComputedStyle(el).fontFamily || 'sans-serif', ratio });
      globes = out.globes;
      /* only the globe is the button that holds it: what is beside it is just the picture */
      const hs = hit.current?.style, [hx, hy, hr] = out.hit;
      if (hs) { const k = 1 / ratio, r = (hr + 6 * ratio) * k; hs.left = hx * k - r + 'px'; hs.top = hy * k - r + 'px'; hs.width = hs.height = r * 2 + 'px'; }
    };
    const frame = (now: number) => {
      raf = 0;
      /* thirty frames a second is plenty for a slow turn */
      if (!still && last && now - last < 1000 / 31) { if (seen && !document.hidden) raf = requestAnimationFrame(frame); return; }
      last = now; lay();
      if (!globes.length) return;
      const turn = still ? 0 : heldAt >= 0 ? heldAt : ((now - t0) / 1000) * rate; turnNow = turn;
      const g = globes.map((o, i) => (i === 0 ? { ...o, yaw: o.yaw + turn } : o));
      if (!drawGlass(ctx, pic, size + paintKey, g, { mirror: look.mirror, through: look.through, fringe: look.fringe * Math.min(devicePixelRatio || 1, 2) })) {
        ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(pic, 0, 0);
        return;
      }
      if (!still && heldAt < 0 && seen && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const go = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const io = new IntersectionObserver(([e]) => { seen = e.isIntersecting; if (seen) go(); });
    io.observe(el);
    const ro = new ResizeObserver(() => go()); ro.observe(el);
    const vis = () => { if (!document.hidden) go(); };
    /* the face and the land picture can arrive after the first draw: draw again when each does */
    let gone = false;
    document.fonts?.ready.then(() => { if (!gone) { ver++; go(); } });
    glassLand.then(() => { if (!gone) go(); });
    document.addEventListener('visibilitychange', vis);
    go();
    return () => { gone = true; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', vis); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return (
    <div ref={host} className={className} data-row={row ? '' : undefined}>
      <canvas ref={cv} className="pg-cv" aria-hidden="true" />
      <span ref={hit} className="pg-hit" data-hold={pressable ? '' : undefined} hidden={!pressable}
        {...(pressable ? { role: 'button', tabIndex: 0, 'aria-pressed': own, 'aria-label': hold, onClick: toggle, onKeyDown: onKey } : {})} />
      {pressable && own ? <span className="sc-held" aria-hidden="true">Held · press to go on</span> : null}
    </div>
  );
}

export function PrizeGlass({ amount, cities, lit, cfg, className }: { amount: string; cities: GlassCity[]; lit?: GlassCity | null; cfg: GlassCfg; className?: string }) {
  const paint: Paint = ({ pctx, w, h, fam }) => {
    const pad = Math.round(h * 0.02);
    const setFont = (fs: number) => {
      pctx.font = `500 ${fs}px ${fam}`;
      try { (pctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = -0.04 * fs + 'px'; } catch { /* older browsers draw it unspaced */ }
      return pctx.measureText(amount).width;
    };
    /* the whole figure stays readable outside the glass; where the width is short the type is set smaller to make room */
    let fs = h * (cfg.row ? 0.5 : 0.62) * cfg.size, tw = setFont(fs);
    const room = w - pad * 2, big = cfg.big ?? 0.6, need = cfg.on ? tw + fs * big * (2 - (cfg.touch ?? 0.15)) : tw + fs * 1.35;
    if (need > room) { fs *= room / need; tw = setFont(fs); }
    pctx.fillStyle = INK; pctx.textBaseline = 'middle';
    const ty = h * (cfg.row ? 0.36 : 0.5);
    pctx.fillText(amount, pad, ty);
    /* on: a big globe beside the last figure, its rim just touching the 0 (touch: the share of its radius that
       overlaps); else it stands a quarter of the type's size clear of it */
    const R = cfg.on ? fs * big : fs * 0.5, bx = cfg.on ? Math.min(w - R - pad, pad + tw + R * (1 - (cfg.touch ?? 0.15))) : Math.min(w - R - pad, pad + tw + R + fs * 0.25);
    /* the ten small globes, one per city, under the amount */
    const row = cfg.row ? cities : [];
    const small = Math.min(h * 0.08, (w - pad * 2) / (Math.max(1, row.length) * 3.2)), gap = row.length > 1 ? (Math.min(w - pad * 2, tw) - small * 2) / (row.length - 1) : 0;
    return {
      hit: [bx, ty, R],
      globes: [
        { x: bx, y: ty, r: R, lat: lit?.lat ?? 0, lon: lit?.lon ?? 0, yaw: face - (lit?.lon ?? 0) * rad, glow: lit ? 1 : 0 },
        ...row.map((ct, i) => ({ x: pad + small + i * gap, y: h * 0.86, r: small, lat: ct.lat, lon: ct.lon, yaw: face - ct.lon * rad, glow: 1 })),
      ],
    };
  };
  const paintKey = JSON.stringify(['pg', amount, cities.map((c) => c.code), lit?.code ?? null, cfg]);
  return <GlassStage paint={paint} paintKey={paintKey} look={cfg} hold="Hold the prize globe" className={'pg ' + (className ?? '')} row={cfg.row} />;
}

/* the laptop's light: blue (the site's blue light) towards white */
const mix = (k: number, a: number) => `rgba(${Math.round(70 + 185 * k)}, ${Math.round(130 + 125 * k)}, 255, ${a})`;

export function NeoGlass({ cfg, lit, className }: { cfg: NeoCfg; lit?: GlassCity | null; className?: string }) {
  const paint: Paint = ({ pctx: p, w, h, ratio }) => {
    /* the laptop, seen from the front and a little above: the lid's width sets the rest */
    const LW = Math.min(w * 0.7, (h * 0.86) / (cfg.lid + 0.1 + cfg.deck)), cx = w / 2;
    const lidH = LW * cfg.lid, deckH = LW * cfg.deck, top = (h - (lidH + deckH + LW * 0.02)) / 2;
    const lx = cx - LW / 2, ly = top, lb = ly + lidH, bez = LW * 0.03, rr = LW * 0.025;
    const sx = lx + bez, sy = ly + bez, sw = LW - bez * 2, sh = lidH - bez * 2.4;
    const frontW = LW * 1.12, fy = lb + deckH, lip = Math.max(2, LW * 0.012);
    /* the lid: darker than the ground, so the laptop is told only by its light */
    p.fillStyle = '#070808';
    p.beginPath(); p.roundRect(lx, ly, LW, lidH, [rr, rr, 2, 2]); p.fill();
    /* the screen: its own light, brightest in the middle, fading to the bezel */
    const sg = p.createRadialGradient(sx + sw * cfg.gx, sy + sh * cfg.gy, 0, sx + sw / 2, sy + sh / 2, Math.hypot(sw, sh) * 0.62);
    sg.addColorStop(0, mix(cfg.white, Math.min(1, 0.7 * cfg.screen)));
    sg.addColorStop(0.3, mix(cfg.white * 0.7, 0.34 * cfg.screen));
    sg.addColorStop(0.75, mix(0, 0.1 * cfg.screen));
    sg.addColorStop(1, 'rgba(4, 7, 16, 1)');
    p.save(); p.beginPath(); p.roundRect(sx, sy, sw, sh, rr * 0.4); p.clip();
    p.fillStyle = '#05070c'; p.fillRect(sx, sy, sw, sh);
    p.fillStyle = sg; p.fillRect(sx, sy, sw, sh);
    /* the streak: one diagonal reflection across the glass, from the upper left */
    if (cfg.streak > 0) {
      const g = p.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.6);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.48, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${0.09 * cfg.streak})`); g.addColorStop(0.62, `rgba(255,255,255,${0.03 * cfg.streak})`); g.addColorStop(0.64, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      p.fillStyle = g; p.fillRect(sx, sy, sw, sh);
    }
    p.restore();
    /* the deck: seen from above, wider at the front; the screen's light falls on it */
    p.beginPath(); p.moveTo(lx, lb); p.lineTo(lx + LW, lb); p.lineTo(cx + frontW / 2, fy); p.lineTo(cx - frontW / 2, fy); p.closePath();
    p.fillStyle = '#080909'; p.fill();
    const spill = p.createRadialGradient(cx, lb, 0, cx, lb, LW * 0.55);
    spill.addColorStop(0, mix(cfg.white, 0.22 * cfg.screen)); spill.addColorStop(1, mix(cfg.white, 0));
    p.save(); p.clip(); p.fillStyle = spill; p.fillRect(lx - LW, lb, LW * 3, deckH); p.restore();
    /* the front lip under the deck */
    p.fillStyle = '#050606'; p.beginPath(); p.roundRect(cx - frontW / 2, fy, frontW, lip, [0, 0, lip, lip]); p.fill();
    /* the rim light: one light from the upper left, so the edges are bright on the left and gone by the right. Never a
       closed outline: the lid's top and left edge, and the deck's front edge */
    const lw = Math.max(1, 1.2 * ratio);
    const rim = (x0: number, y0: number, x1: number, y1: number, a: number) => {
      const g = p.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, `rgba(255,255,255,${Math.min(1, a * cfg.rim)})`); g.addColorStop(0.55, `rgba(255,255,255,${0.25 * a * cfg.rim})`); g.addColorStop(1, 'rgba(255,255,255,0)');
      p.strokeStyle = g; p.lineWidth = lw; p.beginPath(); p.moveTo(x0, y0); p.lineTo(x1, y1); p.stroke();
    };
    rim(lx + rr, ly + lw / 2, lx + LW - rr, ly + lw / 2, 0.85);
    rim(lx + lw / 2, ly + rr, lx + lw / 2, lb - 2, 0.55);
    rim(cx - frontW / 2, fy, cx + frontW / 2, fy, 0.7);
    rim(lx, lb + lw / 2, lx + LW, lb + lw / 2, 0.25);
    /* the globe stands in front of the screen */
    const R = sh * cfg.globe, gx = sx + sw * cfg.gx, gy = sy + sh * cfg.gy;
    return { hit: [gx, gy, R], globes: [{ x: gx, y: gy, r: R, lat: lit?.lat ?? 0, lon: lit?.lon ?? 0, yaw: face - (lit?.lon ?? 0) * rad, glow: lit ? 1 : 0 }] };
  };
  const paintKey = JSON.stringify(['neo', cfg, lit?.code ?? null]);
  return <GlassStage paint={paint} paintKey={paintKey} look={cfg} hold="Hold the laptop's globe" className={'pg pg-neo ' + (className ?? '')} />;
}
