import { MONO, SANS, SHADER_KEYS, type WheelCfg } from './config';
import { asciiFrame, drawAscii, loadAscii, type AsciiFrames } from './ascii-globe';
import { createCrt, type Crt } from './crt';
import { click, settle, setVolume, unlock, type WheelStatus } from './click';

/* The wheel: the city names are the spokes of a wheel around a glass globe whose centre sits on the right edge of
   the screen. The name that points left is the active city. The mouse wheel, a drag, the arrow keys and a click on a
   name turn it, one city at a time, and after the last city comes the first. The names are drawn on a 2D canvas and
   shown through the tube screen pass (crt.ts); without WebGL the 2D canvas is the picture, with a flat disc for the
   globe.

   Three changes from the study: the 2D picture is drawn and uploaded only while it moves (at rest the frame is one
   shader pass, for the breathing light, which is a uniform); the loop stops while the tab is hidden or the wheel is
   off screen; and without WebGL the globe is a flat disc with the land map, not nothing.

   With cfg.globe 'ascii' the big globe is the turning world as text (ascii-globe.ts), drawn into the 2D picture. It
   follows the same turn as the glass, but steps to a new frame only cfg.globeFps times a second, so it turns like
   stop motion; at rest the city's mark blinks at the same low rate. */

export type WheelCity = { name: string; lat: number; lon: number; status: WheelStatus };
type Els = { pin: HTMLElement; canvas: HTMLCanvasElement; cells?: HTMLElement | null; lens?: HTMLElement | null; cta?: HTMLElement | null };
export type WheelEngine = {
  setCfg: (c: WheelCfg) => void; setCities: (c: WheelCity[]) => void; go: (slot: number) => void; jump: (slot: number) => void; step: (n: number) => void;
  measure: () => void; slot: () => number; gl: () => boolean; stats: () => { frames: number; pictures: number; glDraws: number }; destroy: () => void;
};

const clamp01 = (v: number) => Math.min(Math.max(v, 0), 1);
const smooth = (v: number) => v * v * (3 - 2 * v);
const smoothstep = (a: number, b: number, v: number) => smooth(clamp01((v - a) / (b - a)));
const rad = (d: number) => (d * Math.PI) / 180;
const OFF_CANVAS = 20000;
const LAND_URL = '/wheel/land.png';

/* a font stack for the canvas: var(--x) is read off the page, since a canvas does not know the page's variables */
function canvasFont(stack: string) {
  return stack.replace(/var\((--[\w-]+)\)/g, (_m, v: string) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || 'sans-serif');
}

export function createWheel(els: Els, first: { cfg: WheelCfg; cities: WheelCity[]; start: number; noGl?: boolean; onCity: (i: number) => void }): WheelEngine {
  const { pin, canvas } = els;
  let cfg = first.cfg, cities = first.cities;
  const crt: Crt | null = first.noGl ? null : createCrt(canvas, cfg);
  const picture = crt ? document.createElement('canvas') : canvas;
  const ctx = picture.getContext('2d')!;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = reduce.matches;

  const n = () => cities.length;
  const idx = (slot: number) => ((slot % n()) + n()) % n();
  const cityAt = (slot: number) => cities[idx(slot)];

  const view = { width: 1, height: 1, ratio: 1, x: 0, y: 0, radius: 1 };
  const turn = { yaw: 0 };
  const lens = { x: 0, y: 0, radius: 0, open: 0 };
  const cellsWidth = { row: 0, column: 0 };
  let target = first.start, position = first.start, clicked = Math.round(first.start), previous = -1;
  let wheelSum = 0, drag: { y: number; from: number; moved: boolean } | null = null;
  let shown = -1, settledOn = idx(first.start), ems: number[] = [];
  let drawnAt = NaN, dirty = true, lastGl = '', lastCells = '', lastOpacity = '';
  let land: HTMLImageElement | null = null, tinted: HTMLCanvasElement | null = null;
  let raf = 0, running = false, onScreen = true;
  let ascii: AsciiFrames | null = null, asciiK = -1, asciiTick = -1, asciiBlink = false, asciiKey = '';
  const stats = { frames: 0, pictures: 0, glDraws: 0 };
  /* the globe starts facing its city, as the study's does after its first turn */
  turn.yaw = cfg.face - rad(cityAt(target).lon);

  const font = () => canvasFont(SANS[cfg.font]);
  const measureEms = () => {
    ctx.font = `500 100px ${font()}`; ctx.letterSpacing = `${cfg.track * 100}px`;
    ems = cities.map((c) => ctx.measureText(c.name).width / 100);
  };

  const longest = () => ems.reduce((a, b) => Math.max(a, b), 0);
  /* how far a name reaches out past its inner end, in ems: its own width, or the longest's when they start on one line */
  const outEm = (i: number) => (cfg.align === 'start' ? longest() : ems[i] || 0);

  const measureLens = () => {
    const el = els.lens; if (!el) { lens.radius = 0; pin.style.setProperty('--small-radius', '0px'); return; }
    const frameBox = canvas.getBoundingClientRect(), box = el.getBoundingClientRect();
    lens.x = (box.left - frameBox.left + box.width / 2) * view.ratio;
    lens.y = (box.top - frameBox.top + box.height / 2) * view.ratio;
    lens.radius = (box.height / 2 / cfg.openScale) * view.ratio;
    pin.style.setProperty('--small-x', `${lens.x / view.ratio}px`);
    pin.style.setProperty('--small-y', `${lens.y / view.ratio}px`);
    pin.style.setProperty('--small-radius', `${box.height / 2}px`);
  };
  /* the cells' widths as one row and as one column, after their words change */
  const measureCells = () => {
    const c = els.cells; if (!c) return;
    c.classList.remove('is-docked', 'is-stacked'); cellsWidth.row = c.offsetWidth;
    c.classList.add('is-stacked'); cellsWidth.column = c.offsetWidth; lastCells = '';
  };

  const resize = () => {
    const width = pin.clientWidth, height = pin.clientHeight, ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = picture.width = Math.round(width * ratio); canvas.height = picture.height = Math.round(height * ratio);
    const radius = Math.min(cfg.hubOfHeight * height, cfg.hubOfWidth * width) * ratio;
    /* with no globe the hub moves off the right edge, so the names sit further right on the same curve */
    const x = width * ratio + (cfg.globe === 'none' ? cfg.bareShift * radius : 0);
    Object.assign(view, { width: width * ratio, height: height * ratio, ratio, x, y: cfg.hubY * height * ratio, radius });
    /* the screen lines leave a hole for the glass ball only; the text globe is on the screen, so it gets the lines */
    pin.style.setProperty('--globe-radius', `${cfg.globe === 'glass' ? view.radius / ratio : 0}px`);
    pin.style.setProperty('--globe-y', `${view.y / ratio}px`);
    measureLens(); dirty = true; lastGl = ''; lastCells = '';
  };

  /* ---- the picture: the names, and (without WebGL) the flat globe ---- */
  const ink = (a: number) => `rgba(${cfg.ink}, ${cfg.ink}, ${cfg.ink - 2}, ${a})`;
  const drawNames = (behind: number) => {
    const size = cfg.labelSize * view.radius, reach = cfg.labelFrom * view.radius, step = rad(cfg.step);
    /* aligned at the start, every name begins where the longest one does */
    const lead = cfg.align === 'start' ? longest() * size : 0;
    ctx.textAlign = cfg.align === 'start' ? 'left' : 'right'; ctx.textBaseline = 'middle';
    ctx.font = `500 ${size}px ${font()}`; ctx.letterSpacing = `${cfg.track * size}px`;
    const drawName = (slot: number, at: number, alpha: number) => {
      const angle = (at - slot) * step, near = 1 - clamp01(Math.abs(slot - at));
      const fade = 1 - smoothstep(cfg.fadeFrom, cfg.fadeTo, Math.abs(angle));
      if (fade <= 0) return;
      ctx.save(); ctx.translate(view.x, view.y); ctx.rotate(angle);
      ctx.fillStyle = ink((cfg.dim + (1 - cfg.dim) * smooth(near)) * fade * alpha);
      ctx.fillText(cityAt(slot).name, -reach - cfg.labelPush * view.radius * smooth(near) - lead, 0);
      ctx.restore();
    };
    const from = Math.floor(position) - 14;
    for (let slot = from; slot <= from + 28; slot++) {
      /* a fast turn leaves a short smear behind each name */
      for (let g = Math.round(cfg.ghosts); g >= 1 && Math.abs(behind) > cfg.ghostFrom; g--) drawName(slot, position - behind * cfg.ghostGap * g, cfg.ghostAlpha / g);
      drawName(slot, position, 1);
    }
    if (!crt || cfg.globe !== 'glass') return;
    /* the glass shows the start of each name at its rim: a small copy of the names drawn as soft shadow, off canvas */
    const small = cfg.mirrorSize * view.radius;
    ctx.font = `500 ${small}px ${font()}`; ctx.letterSpacing = `${cfg.track * small}px`; ctx.textAlign = 'left';
    ctx.shadowOffsetX = OFF_CANVAS;
    for (let slot = from; slot <= from + 28; slot++) {
      const angle = (position - slot) * step;
      if (Math.abs(angle) > 1) continue;
      const near = 1 - clamp01(Math.abs(slot - position));
      ctx.save(); ctx.translate(view.x - OFF_CANVAS, view.y); ctx.rotate(angle);
      ctx.shadowColor = ink(cfg.dim + (1 - cfg.dim) * smooth(near));
      for (const soft of [cfg.mirrorBlur, cfg.mirrorGlow]) { ctx.shadowBlur = soft * view.radius * 2; ctx.fillText(cityAt(slot).name, -cfg.mirrorStart * view.radius, 0); }
      ctx.restore();
    }
    ctx.shadowOffsetX = 0; ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  };

  /* without WebGL: the globe as a flat disc, the land map scrolled by the turn, the city as a small light */
  const tint = () => {
    if (!land || tinted) return;
    const t = document.createElement('canvas'); t.width = land.naturalWidth; t.height = land.naturalHeight;
    const p = t.getContext('2d')!; p.drawImage(land, 0, 0); p.globalCompositeOperation = 'multiply';
    p.fillStyle = 'rgb(63, 97, 80)'; p.fillRect(0, 0, t.width, t.height); tinted = t;
  };
  const disc = (cx: number, cy: number, r: number, withCity: boolean, glow: number) => {
    if (r <= 0) return;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgb(20, 24, 23)'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    const h = 2 * r * cfg.core, w = 2 * h, top = cy - h / 2;
    const centre = ((-turn.yaw / (Math.PI * 2) + 0.5) % 1 + 1) % 1;
    tint();
    if (tinted) {
      ctx.globalCompositeOperation = 'lighter';
      const x = cx - centre * w;
      for (const k of [-1, 0, 1]) ctx.drawImage(tinted, x + k * w, top, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (withCity && glow > 0) {
      const c = cityAt(target), u = rad(c.lon) / (Math.PI * 2) + 0.5;
      let du = u - centre; du -= Math.round(du);
      const px = cx + du * w, py = top + (0.5 - rad(c.lat) / Math.PI) * h;
      const blue = ctx.createRadialGradient(px, py, 0, px, py, r * 0.35);
      blue.addColorStop(0, `rgba(41, 97, 255, ${0.8 * glow})`); blue.addColorStop(1, 'rgba(41, 97, 255, 0)');
      ctx.fillStyle = blue; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      const orange = ctx.createRadialGradient(px, py, 0, px, py, r * 0.08);
      orange.addColorStop(0, `rgba(255, 117, 20, ${glow})`); orange.addColorStop(1, 'rgba(255, 117, 20, 0)');
      ctx.fillStyle = orange; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r - view.ratio / 2, 0, Math.PI * 2);
    ctx.strokeStyle = ink(0.45); ctx.lineWidth = view.ratio; ctx.stroke();
  };

  /* the text globe: the frame and the blink move on only at the low frame rate */
  const asciiOn = () => cfg.globe === 'ascii';
  const stepAscii = (time: number, settled: number) => {
    if (!ascii) return;
    const tick = Math.floor(time * cfg.globeFps);
    if (tick === asciiTick && asciiK >= 0) return;
    asciiTick = tick;
    asciiK = asciiFrame(-turn.yaw * 180 / Math.PI);
    asciiBlink = settled > 0.5 && (reduced || Math.floor(time * 2) % 2 === 0);
  };
  const drawGlobeText = () => {
    if (!ascii || asciiK < 0) return;
    const c = cityAt(target);
    drawAscii(ctx, ascii, asciiK, view.x - cfg.globeShift * view.radius, view.y, view.radius, canvasFont(MONO.geist), { lat: c.lat, lon: c.lon, bracket: asciiBlink });
  };

  /* ---- the loop ---- */
  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    stats.frames++;
    const time = now / 1000, dt = previous < 0 ? 0 : Math.min(time - previous, 0.1);
    previous = time;
    const e = (k: number) => (reduced ? 1 : 1 - Math.exp(-dt * k));
    position += (target - position) * e(cfg.ease);
    if (Math.abs(target - position) < 1e-4) position = target;
    const behind = target - position;
    if (Math.round(position) !== clicked) { clicked = Math.round(position); if (cfg.sound) click(); }

    const i = idx(target), city = cities[i];
    const rest = cfg.face - rad(city.lon), away = Math.atan2(Math.sin(rest - turn.yaw), Math.cos(rest - turn.yaw));
    turn.yaw += Math.abs(away) < 1e-5 ? away : away * e(cfg.yawEase);
    const isOpen = !!els.cta?.matches(':hover, :focus-visible');
    lens.open += ((isOpen ? 1 : 0) - lens.open) * e(cfg.openEase);
    if (Math.abs((isOpen ? 1 : 0) - lens.open) < 1e-4) lens.open = isOpen ? 1 : 0;

    if (shown !== i) { shown = i; first.onCity(i); }

    /* the cells sit before the active name and show when the wheel is at rest */
    const size = cfg.labelSize * view.radius;
    const settled = 1 - smoothstep(cfg.settleFrom, cfg.settleTo, Math.abs(behind));
    const cells = els.cells;
    if (cells) {
      const nameStart = view.x - cfg.labelFrom * view.radius - cfg.labelPush * view.radius - outEm(i) * size;
      const end = (nameStart - size * 0.6) / view.ratio;
      if (cfg.layout === 'column') {
        /* the column sits on the page's left margin, away from the arc of names, with the cells on the active name's line.
           When the cells in a row would reach the name they stack; with no room even for that (a phone), it docks at the top */
        const gutter = Math.min(88, Math.max(20, 0.046 * view.width / view.ratio));
        const stacked = gutter + cellsWidth.row > end && gutter + cellsWidth.column <= end, docked = gutter + cellsWidth.column > end, x = gutter;
        const key = `col|${docked}|${stacked}|${x}`;
        if (key !== lastCells) {
          lastCells = key; cells.classList.remove('is-docked'); cells.classList.toggle('is-stacked', stacked); cells.style.translate = '';
          pin.style.setProperty('--col-x', `${docked ? gutter : x}px`); pin.toggleAttribute('data-docked', docked);
        }
      } else {
        const stacked = end - cellsWidth.row < 20, docked = end - cellsWidth.column < 20;
        const key = `${stacked}|${docked}|${end}|${view.y}|${cfg.align}`;
        if (key !== lastCells) {
          lastCells = key; pin.removeAttribute('data-docked');
          cells.classList.toggle('is-stacked', stacked && !docked); cells.classList.toggle('is-docked', docked);
          cells.style.translate = docked ? '' : `${end}px ${view.y / view.ratio}px`;
        }
      }
      const op = cfg.cells === 'flip' ? '1' : settled.toFixed(3);
      if (op !== lastOpacity) { lastOpacity = op; cells.style.opacity = op; }
    }
    if (settled > 0.98 && settledOn !== i) { settledOn = i; if (cfg.sound) settle(city.status); }

    const pulse = reduced ? 1 : cfg.pulseLow + (1 - cfg.pulseLow) * Math.sin(time * cfg.pulseRate);
    const glow = settled * pulse;
    const small = { x: lens.x, y: lens.y, radius: lens.radius * (1 + (cfg.openScale - 1) * lens.open) };
    let textMoved = false;
    if (asciiOn()) {
      stepAscii(time, settled);
      const k = `${asciiK}|${asciiBlink}|${i}`;
      if (k !== asciiKey) { asciiKey = k; textMoved = true; }
    }

    if (crt) {
      const moved = dirty || textMoved || position !== drawnAt;
      if (moved) { ctx.clearRect(0, 0, view.width, view.height); drawNames(behind); if (asciiOn()) drawGlobeText(); drawnAt = position; dirty = false; stats.pictures++; }
      /* skip the pass when nothing at all changed (at rest under reduced motion, where the light does not breathe) */
      const key = `${moved}|${turn.yaw}|${small.radius}|${glow}`;
      if (moved || key !== lastGl) {
        lastGl = key; stats.glDraws++;
        crt.draw({ picture: moved ? picture : null, hub: view, radius: view.radius, small, ratio: view.ratio, yaw: turn.yaw, city: [rad(city.lat), rad(city.lon)], glow });
      }
    } else {
      /* the flat picture is drawn only when something in it moved; its city light does not breathe */
      const key = `${position}|${asciiOn() ? asciiKey : turn.yaw}|${small.radius}|${settled}|${dirty}|${!!tinted}`;
      if (key !== lastGl) {
        lastGl = key; dirty = false; drawnAt = position; stats.pictures++;
        ctx.clearRect(0, 0, view.width, view.height); drawNames(behind);
        if (asciiOn()) drawGlobeText(); else if (cfg.globe === 'glass') disc(view.x, view.y, view.radius, true, settled);
        disc(small.x, small.y, small.radius, false, 0);
      }
    }
  };
  const start = () => { if (running || document.hidden || !onScreen) return; running = true; previous = -1; raf = requestAnimationFrame(frame); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  /* ---- input ---- */
  const slotAt = (x: number, y: number): number | null => {
    const box = canvas.getBoundingClientRect();
    const dx = (x - box.left) * view.ratio - view.x, dy = (y - box.top) * view.ratio - view.y;
    const far = Math.hypot(dx, dy), angle = Math.atan2(-dy, -dx), step = rad(cfg.step);
    const slot = Math.round(position - angle / step), size = cfg.labelSize * view.radius;
    const near = 1 - clamp01(Math.abs(slot - position));
    const from = (cfg.labelFrom + cfg.labelPush * smooth(near)) * view.radius;
    const onLine = Math.abs(position - angle / step - slot) * step * far < size * 0.7;
    const inner = from + (outEm(idx(slot)) - (ems[idx(slot)] || 0)) * size;
    const onName = far > inner - size * 0.3 && far < inner + (ems[idx(slot)] || 0) * size + size * 0.3;
    return onLine && onName && Math.abs(angle) < cfg.fadeTo ? slot : null;
  };
  const onWheel = (ev: WheelEvent) => {
    if (ev.target instanceof Element && ev.target.closest('[data-wheel-skip]')) return;
    /* a mouse wheel gives lines, a trackpad gives pixels */
    wheelSum += ev.deltaY * (ev.deltaMode === 1 ? 16 : 1);
    const steps = Math.trunc(wheelSum / cfg.wheelPx); wheelSum -= steps * cfg.wheelPx; target += steps;
  };
  const onDown = (ev: PointerEvent) => { if (ev.target instanceof Element && ev.target.closest('a, button, input, select, textarea, [data-wheel-skip]')) return; drag = { y: ev.clientY, from: target, moved: false }; };
  const onMove = (ev: PointerEvent) => {
    if (!drag) { if (ev.pointerType === 'mouse') pin.style.cursor = slotAt(ev.clientX, ev.clientY) === null ? '' : 'pointer'; return; }
    const moved = ev.clientY - drag.y;
    if (Math.abs(moved) > 8) drag.moved = true;
    /* a drag up brings the next cities up */
    if (drag.moved) target = drag.from - Math.round(moved / cfg.dragPx);
  };
  const onUp = (ev: PointerEvent) => {
    if (!drag) return;
    const slot = drag.moved ? null : slotAt(ev.clientX, ev.clientY);
    drag = null;
    if (slot !== null) target = slot;
  };
  const onCancel = () => { drag = null; };
  const onKey = (ev: KeyboardEvent) => {
    if (ev.defaultPrevented || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const t = ev.target instanceof HTMLElement ? ev.target : null;
    if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable || t.closest('[data-wheel-skip]'))) return;
    const steps = ({ ArrowDown: 1, ArrowRight: 1, PageDown: 1, ArrowUp: -1, ArrowLeft: -1, PageUp: -1 } as Record<string, number>)[ev.key];
    if (!steps) return;
    ev.preventDefault(); target += steps;
  };
  const onVis = () => { if (document.hidden) stop(); else start(); };
  const onReduce = () => { reduced = reduce.matches; };
  const unlockTypes = ['pointerdown', 'pointerup', 'click', 'touchend', 'keydown'] as const;

  pin.addEventListener('wheel', onWheel, { passive: true });
  pin.addEventListener('pointerdown', onDown); pin.addEventListener('pointermove', onMove);
  pin.addEventListener('pointerup', onUp); pin.addEventListener('pointercancel', onCancel);
  window.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', onVis);
  reduce.addEventListener('change', onReduce);
  for (const t of unlockTypes) window.addEventListener(t, unlock, { capture: true });
  const ro = new ResizeObserver(resize); ro.observe(pin);
  const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) start(); else stop(); });
  io.observe(pin);

  const img = new Image();
  img.onload = () => { land = img; crt?.setLand(img); dirty = true; lastGl = ''; };
  img.onerror = () => console.warn('The land map did not load.');
  img.src = LAND_URL;
  let alive = true;
  const wantAscii = () => { if (asciiOn() && !ascii) loadAscii().then((f) => { if (alive && f) { ascii = f; asciiK = -1; dirty = true; lastGl = ''; } }); };
  wantAscii();

  setVolume(cfg.volume);
  measureEms(); resize(); measureCells(); start();
  /* the faces may still be loading: measure the names again once they are in */
  document.fonts?.ready.then(() => { measureEms(); dirty = true; });

  return {
    setCfg(c) {
      const old = cfg; cfg = c;
      if (SHADER_KEYS.some((k) => old[k] !== c[k])) crt?.rebuild(c);
      if (old.font !== c.font || old.track !== c.track) { measureEms(); document.fonts?.ready.then(() => { measureEms(); dirty = true; }); }
      setVolume(c.volume); wantAscii(); asciiKey = '';
      resize();
    },
    setCities(c) { cities = c; measureEms(); shown = -1; dirty = true; },
    go(slot) { const k = n(), cur = idx(target); let d = idx(slot) - cur; if (d > k / 2) d -= k; if (d < -k / 2) d += k; target += d; },
    /* straight to a city with no turn: the first city of a visit, once the page knows where the visitor is */
    jump(slot) { target = position = slot; clicked = Math.round(slot); settledOn = idx(slot); turn.yaw = cfg.face - rad(cityAt(slot).lon); dirty = true; lastGl = ''; },
    step(s) { target += s; },
    measure() { measureCells(); measureLens(); lastGl = ''; },
    slot: () => idx(target),
    gl: () => !!crt,
    stats: () => ({ ...stats }),
    destroy() {
      alive = false; stop(); ro.disconnect(); io.disconnect();
      pin.removeEventListener('wheel', onWheel); pin.removeEventListener('pointerdown', onDown); pin.removeEventListener('pointermove', onMove);
      pin.removeEventListener('pointerup', onUp); pin.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); reduce.removeEventListener('change', onReduce);
      for (const t of unlockTypes) window.removeEventListener(t, unlock, { capture: true });
      crt?.dispose();
    },
  };
}
