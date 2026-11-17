'use client';
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from 'react';
import { tokMs } from '@/components/shared/motion';
import { step as stepClick, wake } from '@/components/board/prefs';
import { MOVE } from './acts';
import type { Facts, ScopeCfg } from './scope';
import { Tube, useReduced, useTubesStill, type TubeClock } from './tube';

/* How it works: one tube plays the day as one loop, Build into Vote into Final and round to Build again, with no stop
   between steps. Each step's heading is a button that moves the drawing to that step and plays on from there; the day
   bar under the tube scrubs it. Pressing the drawing holds it (WCAG 2.2.2); Screen off and reduced motion show each step
   as a still of its finished drawing. A config with the tour off waits for "Play the day". Seconds per step and the
   jump come from the motion tokens (--tour-step, --dur-jump).

   The words never change: all three steps stay on the page, so reading never waits on the drawing. */

type Mode = 'tour' | 'step';

/* The day's clock: t runs 0 to 3 (Build, Vote, Final) and comes round to 0. The tube reads it every frame it draws;
   between reads nothing runs, so off screen or in a hidden tab the day waits where it is. */
class DayClock implements TubeClock {
  t = 0; from: number | undefined; fast = false; mode: Mode = 'tour';
  grabbed = false; paused = false; still = false; cut = false;
  stepMs = 12000; jumpMs = 700; stillAt = 0.9;
  private onFrame?: () => void;
  private last = 0; private subs = new Set<() => void>(); private uis = new Set<() => void>(); private snapV = '0|tour';

  get act() { return Math.min(2, Math.max(0, Math.floor(this.t))); }
  get moving() { return this.mode === 'tour' && !this.paused && !this.still && !this.grabbed; }
  read = (now: number) => {
    const dt = this.last ? Math.min(100, Math.max(0, now - this.last)) : 0; this.last = now;
    if (this.moving && dt > 0) this.advance(dt);
    this.onFrame?.();
    return { ph: Math.min(0.99999, this.t / 3), from: this.from, moving: this.moving };
  };
  private advance(dt: number) {
    const a = this.act; let u = this.t - a;
    /* a press moves the picture in durJump; the rest of a step runs at the step's own pace */
    u += this.fast && u < MOVE ? (dt / this.jumpMs) * MOVE : dt / this.stepMs;
    if (u >= MOVE && this.from !== undefined) { this.from = undefined; this.fast = false; }
    /* the end of Final runs on into Build: the drawings move from Final's last pose to Build's first on their own */
    this.t = a + u >= 3 ? a + u - 3 : a + u;
    if (this.act !== a) this.ui();
  }
  private to(a: number, fast: boolean) {
    const was = this.t;
    if (this.paused || this.still) { this.t = a + this.stillAt; this.from = undefined; this.fast = false; }
    else if (this.cut) { this.t = a + MOVE; this.from = undefined; this.fast = false; }
    else { this.from = was; this.t = a; this.fast = fast; }
    this.ui(); this.poke();
  }
  /* a step's button, its arrow keys and "Next": move there and play on */
  press(a: number) {
    const n = Math.min(2, Math.max(0, a)), was = this.mode; this.mode = 'tour';
    if (n === this.act && was === 'tour' && !this.still) { this.poke(); return; }
    this.to(n, true);
  }
  /* the day bar: straight to that moment */
  scrub(t: number) {
    this.t = Math.min(2.9999, Math.max(0, t)); this.from = undefined; this.fast = false;
    this.ui(); this.poke();
  }
  play() { this.mode = 'tour'; this.to(0, true); }
  tune(stepMs: number, jumpMs: number, stillAt: number, cut: boolean) { this.stepMs = stepMs; this.jumpMs = jumpMs; this.stillAt = stillAt; this.cut = cut; }
  /* one watcher of each drawn frame (the lamp's fill and the bar) */
  watch(f: () => void) { this.onFrame = f; f(); return () => { if (this.onFrame === f) this.onFrame = undefined; }; }
  setPaused(p: boolean) { if (p !== this.paused) { this.paused = p; this.poke(); } }
  setGrab(g: boolean) { if (g !== this.grabbed) { this.grabbed = g; this.poke(); } }
  setStill(s: boolean) { this.still = s; if (s) { this.t = this.act + this.stillAt; this.from = undefined; this.fast = false; } this.ui(); this.poke(); }
  start(mode: Mode) { this.mode = mode; this.t = this.still ? this.stillAt : 0; this.from = undefined; this.fast = false; this.ui(); this.poke(); }
  snap = () => this.snapV;
  subUi = (f: () => void) => { this.uis.add(f); return () => { this.uis.delete(f); }; };
  listen = (f: () => void) => { this.subs.add(f); return () => { this.subs.delete(f); }; };
  private ui() { const v = this.act + '|' + this.mode; if (v !== this.snapV) { this.snapV = v; this.uis.forEach((f) => f()); } }
  private poke() { this.subs.forEach((f) => f()); }
}


export type TourStep = { k: string; t: string; p: string };
type Day = { buildMin: number; voteAfter: number; startHour: number };

/* the bar's reading: the step, and how far through it the drawing is. The drawing runs the day through the ten cities
   on one clock (UTC, written in the tube), so the bar names the step rather than one city's local time. */
function valueText(t: number, d: Day, names: string[]) {
  void d;
  const a = Math.min(2, Math.max(0, Math.floor(t))), u = Math.min(1, Math.max(0, t - a));
  return names[a] + ', step ' + (a + 1) + ' of 3' + (u > 0.02 && u < 0.98 ? ', ' + Math.round(u * 100) + '% through' : u >= 0.98 ? ', at its end' : '');
}

export function DayTour({ cfg, F, steps, day, compact, id, heading, style }: {
  cfg: ScopeCfg; F: Facts; steps: TourStep[]; day: Day; compact: boolean; id: string; heading: ReactNode; style?: React.CSSProperties;
}) {
  const [clock] = useState(() => new DayClock());
  const snap = useSyncExternalStore(clock.subUi, clock.snap, () => '0|tour');
  const [actS, mode] = snap.split('|') as [string, Mode];
  /* Screen off stills the drawing as reduced motion does (a still, no tour, no Play); a press on the tube holds it */
  const act = Number(actS), screenOff = useTubesStill(), reduced = useReduced(), still = reduced || screenOff, [held, setHeldBy] = useState(false);
  /* Screen off or reduced motion lets go of a held drawing, so turning them back gives a moving one */
  if (still && held) setHeldBy(false);
  const fills = useRef<(HTMLLIElement | null)[]>([]), btns = useRef<(HTMLButtonElement | null)[]>([]), bar = useRef<HTMLInputElement>(null);
  const names = steps.map((s) => s.k), sec = useRef<HTMLElement>(null);

  /* how it opens: playing, unless the config has the tour off (or off on a phone), or the drawings are still */
  useEffect(() => {
    clock.tune(Math.max(tokMs('--tour-step') || 12000, cfg.loop * 1000), tokMs('--dur-jump') || 700, cfg.still, cfg.jump === 'cut');
  }, [clock, cfg.loop, cfg.still, cfg.jump]);
  useEffect(() => {
    const phone = window.matchMedia('(max-width: 640px)').matches;
    clock.start(cfg.tour && !still && (!phone || cfg.tourPhone) ? 'tour' : 'step');
  }, [clock, cfg.tour, cfg.tourPhone, still]);
  useEffect(() => { clock.setStill(still); }, [clock, still]);
  useEffect(() => { clock.setPaused(held); }, [clock, held]);

  /* each frame the tube draws: the current step's lamp fills with the tour, the bar follows the drawing */
  useEffect(() => {
    let text = '';
    return clock.watch(() => {
      /* the lamp fills with the step: how far the drawing is through it */
      const a = clock.act, p = clock.still ? 1 : Math.min(1, Math.max(0, clock.t - a));
      fills.current.forEach((el, i) => { el?.style.setProperty('--ex-fill', i === a ? String(p) : '0'); });
      const b = bar.current;
      if (b) {
        const v = String(Math.round(clock.t * 1000) / 1000); if (b.value !== v) b.value = v;
        const tx = valueText(clock.t, day, names); if (tx !== text) { text = tx; b.setAttribute('aria-valuetext', tx); }
      }
    });
  });

  const go = (i: number) => { wake(); clock.press(i); stepClick(true); };
  const onSteps = (e: KeyboardEvent<HTMLOListElement>) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    const i = btns.current.findIndex((b) => b === document.activeElement); if (i < 0) return;
    e.preventDefault(); const n = Math.min(2, Math.max(0, i + d)); btns.current[n]?.focus(); if (n !== act) go(n);
  };
  const onBarKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'PageUp' || e.key === 'PageDown') { e.preventDefault(); const n = Math.min(2, Math.max(0, act + (e.key === 'PageUp' ? 1 : -1))); if (n !== act) go(n); }
  };
  const onBar = (v: number) => {
    const before = clock.act; clock.scrub(v);
    const tx = valueText(clock.t, day, names); bar.current?.setAttribute('aria-valuetext', tx);
    if (clock.act !== before) { wake(); stepClick(true); }
  };
  const play = () => {
    /* the key goes away once the day plays: focus moves to the step it is on, so it is never lost */
    setHeldBy(false); wake(); clock.play();
    btns.current[clock.act]?.focus();
  };

  return (
    <section id={id} ref={sec} className="ex" data-compact={compact ? '' : undefined} data-layout="reel" data-tour={mode === 'tour' ? '' : undefined} aria-labelledby={id + '-h'} style={style}
>
      <div className="ex-top">
        {heading}
        <span className="ex-keys">
          {/* only where the day does not play by itself (a config with the tour off); once it plays, it loops */}
          {!still && mode !== 'tour' ? <button type="button" className="ex-key ex-play" onClick={play}>
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 1l9 5-9 5z" fill="currentColor" /></svg>
            Play the day
          </button> : null}
        </span>
      </div>
      <div className="ex-stage">
        <Tube scene={cfg.story === 'scenes' ? 'reel' : 'day'} cfg={cfg} f={F} clock={clock} held={held} onHold={setHeldBy} what="day drawing" className="ex-reel" />
        {cfg.bar ? (
          <div className="ex-bar">
            <input ref={bar} className="ex-range" type="range" min={0} max={3} step={0.05} defaultValue={0} aria-label="Moment in the day" aria-valuetext={valueText(0, day, names)}
              onInput={(e) => onBar(Number(e.currentTarget.value))} onKeyDown={onBarKey} onPointerDown={() => clock.setGrab(true)} onPointerUp={() => clock.setGrab(false)} onPointerCancel={() => clock.setGrab(false)} onBlur={() => clock.setGrab(false)} />
            <ol className="ex-ticks" aria-hidden="true">
              <li>{names[0]}</li><li>{names[1]}</li><li>{names[2]}</li>
            </ol>
          </div>
        ) : null}
      </div>
      <ol className="ex-mons" onKeyDown={onSteps}>
        {steps.map((s, i) => (
          <li key={s.k} className="ex-mon" data-on={i === act ? '' : undefined} ref={(el) => { fills.current[i] = el; }}>
            <button type="button" className="ex-stepb" aria-current={i === act ? 'step' : undefined} ref={(el) => { btns.current[i] = el; }} onClick={() => go(i)}>
              <span className="ex-lamp" aria-hidden="true" />
              <span className="ex-umd"><span className="ex-k">{s.k}</span><span className="ex-t">{s.t}</span></span>
            </button>
            <p className="ex-p">{s.p}</p>
            {compact && cfg.next && i < 2 ? <button type="button" className="ex-next" onClick={() => go(i + 1)}>Next: {steps[i + 1].k}</button> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}
