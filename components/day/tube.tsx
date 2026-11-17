'use client';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { VW, VH, renderScope, reelStep, type Facts, type Scene, type ScopeCfg } from './scope';

/* One tube: a canvas that draws a scene from scope.ts. It runs only while it is on screen and the tab is visible,
   steps at the config's frame rate, and under reduced motion draws one still (the config's "still" phase) and stops.
   Pointing at it turns the beam up. The scan lines and corners are CSS (.sc in explain.css). */

/* one pause for every tube on the page (WCAG 2.2.2: anything that moves by itself for over 5 seconds can be paused);
   kept in localStorage, so a reader who paused once is not asked again on the next page or the next visit */
const KEY = 'hackday-tubes-paused', subs = new Set<() => void>();
let paused: boolean | null = null;
const getPaused = () => { if (paused === null) { try { paused = localStorage.getItem(KEY) === '1'; } catch { paused = false; } } return paused; };
const setPaused = (v: boolean) => { paused = v; try { localStorage.setItem(KEY, v ? '1' : '0'); } catch { /* private mode */ } subs.forEach((f) => f()); };
const subPaused = (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; };
export const useTubesPaused = () => useSyncExternalStore(subPaused, getPaused, () => false);
/* the key: a fixed name with a pressed state; hidden under reduced motion, where nothing moves */
export function TubePause() {
  const p = useTubesPaused();
  return (
    <button type="button" className="sc-pause" aria-pressed={p} onClick={() => setPaused(!p)}>
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1h3v10H2zM7 1h3v10H7z" fill="currentColor" /></svg>
      Pause drawings
    </button>
  );
}

const families = () => {
  const cs = getComputedStyle(document.documentElement);
  return { mono: cs.getPropertyValue('--font-geist-mono').trim() || 'ui-monospace, monospace', sans: cs.getPropertyValue('--font-geist').trim() || 'sans-serif' };
};

export function Tube({ scene, cfg, f, onStep, className, label }: {
  scene: Scene; cfg: ScopeCfg; f: Facts; onStep?: (i: number) => void; className?: string; label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null), stepRef = useRef(onStep), hold = useTubesPaused();
  useEffect(() => { stepRef.current = onStep; }, [onStep]);
  const key = JSON.stringify([scene, cfg, f, hold]);
  useEffect(() => {
    const cv = ref.current, c = cv?.getContext('2d'); if (!cv || !c) return;
    const [sc, cf, ff, held] = JSON.parse(key) as [Scene, ScopeCfg, Facts, boolean];
    const period = cf.loop * (sc === 'reel' ? 3 : 1), reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0, vis = false, t0 = performance.now(), last = -1, step = -1, boost = 1, target = 1, fo = families();
    const size = () => {
      const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.max(1, Math.round(r.width * dpr)); cv.height = Math.max(1, Math.round((r.width * VH / VW) * dpr));
    };
    const paint = (ph: number) => {
      renderScope(c, sc, ph, cf, ff, fo, cv.width / VW, boost);
      if (sc === 'reel') { const s = reelStep(ph); if (s !== step) { step = s; stepRef.current?.(s); } }
    };
    const still = () => paint(cf.still);
    const tick = (now: number) => {
      raf = 0; if (!vis || reduce.matches || held) return;
      raf = requestAnimationFrame(tick);
      boost += (target - boost) * 0.18;
      const frame = Math.floor(((now - t0) / 1000) * cf.fps);
      if (frame === last && Math.abs(target - boost) < 0.01) return;
      last = frame; paint(((frame / cf.fps) / period) % 1);
    };
    const run = () => { if (reduce.matches || held) { still(); return; } if (vis && !raf && !document.hidden) raf = requestAnimationFrame(tick); };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    size(); still();
    /* each time a tube comes into view it starts from the top, so the reel begins with Build, beside the first step */
    const io = new IntersectionObserver(([e]) => { const was = vis; vis = e.isIntersecting; if (vis) { if (!was) { t0 = performance.now(); last = -1; } run(); } else stop(); });
    io.observe(cv);
    const ro = new ResizeObserver(() => { size(); last = -1; if (reduce.matches || held || !vis) still(); });
    ro.observe(cv);
    const onVis = () => { if (document.hidden) stop(); else run(); };
    const onMotion = () => { stop(); last = -1; if (reduce.matches || held) still(); else { t0 = performance.now(); run(); } };
    const on = () => { if (cf.hover) { target = 1.9; run(); } }, off = () => { target = 1; };
    document.addEventListener('visibilitychange', onVis); reduce.addEventListener('change', onMotion);
    cv.addEventListener('pointerenter', on); cv.addEventListener('pointerleave', off);
    document.fonts?.ready.then(() => { fo = families(); last = -1; if (reduce.matches || held || !vis) still(); });
    return () => {
      stop(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); reduce.removeEventListener('change', onMotion);
      cv.removeEventListener('pointerenter', on); cv.removeEventListener('pointerleave', off);
    };
  }, [key]);
  return (
    <span className={'sc' + (className ? ' ' + className : '')} style={{ ['--sc-scan' as string]: cfg.scan }} aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      <canvas ref={ref} className="sc-cv" />
    </span>
  );
}
