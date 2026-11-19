/* A split-flap forward turn written straight into an element's text: every character turns past `flaps` flaps and
   lands on its own, one position every `stagger` ms, each flap `flapMs` long. Spaces stay spaces, so a word's shape
   holds while it turns. The flaps are fixed by position and turn, not random. Under reduced motion, or with no flaps,
   the text is simply set. Returns a stop that leaves the final text. Use it on monospaced text only, so nothing moves
   sideways while it turns. */

const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const pick = (i: number, k: number) => POOL[((Math.imul(i + 3, 2654435761) ^ Math.imul(k + 11, 40503)) >>> 0) % POOL.length];
export const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export type FlapOpts = { flapMs: number; flaps: number; stagger: number };

export function flapInto(el: HTMLElement, text: string, o: FlapOpts, from?: string): () => void {
  if (reducedMotion() || o.flaps <= 0 || o.flapMs <= 0) { el.textContent = text; return () => {}; }
  const n = text.length, t0 = performance.now(), end = (n - 1) * o.stagger + o.flaps * o.flapMs;
  let raf = 0;
  const frame = () => {
    const e = performance.now() - t0; let s = '';
    for (let i = 0; i < n; i++) {
      const b = text[i], k = Math.floor((e - i * o.stagger) / o.flapMs);
      /* before its turn a position shows what was there (or a first flap); then it turns forward and lands */
      s += b === ' ' ? ' ' : k >= o.flaps ? b : k < 0 ? (from?.[i] ?? pick(i, 0)) : pick(i, k + 1);
    }
    el.textContent = s;
    if (e < end) raf = requestAnimationFrame(frame); else el.textContent = text;
  };
  raf = requestAnimationFrame(frame);
  return () => { cancelAnimationFrame(raf); el.textContent = text; };
}
