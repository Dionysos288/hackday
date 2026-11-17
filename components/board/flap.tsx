'use client';
import { useLayoutEffect, useRef } from 'react';
import { useChange } from '@/components/screen/flash';
import type { FlapMode } from './config';

/* Split-flap text. A change turns each character past a few flaps on its way to the new one, left to right, one
   position every `stagger` ms, each flap `flipMs` long: the change takes a beat, as on a real board. Word mode turns
   the whole cell once, as a board whose flaps hold whole words. The loop runs only while a flip is under way; at rest
   nothing is scheduled. Under reduced motion the text swaps at once. Screen readers get the text, never the flaps.

   width: the board's fixed cell count; shorter text is padded so the cells never move. */

const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const rnd = (i: number, k: number) => POOL[((Math.imul(i + 1, 2654435761) ^ Math.imul(k + 7, 40503)) >>> 0) % POOL.length];

/* whether a change turns flaps: not under reduced motion, not in word mode, not with no flaps */
function flips(o: { mode: FlapMode; flaps: number }): boolean {
  return o.mode !== 'word' && o.flaps > 0 && !(typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

export type FlapOpts = { flipMs: number; flaps: number; stagger: number; mode: FlapMode; onStep?: () => void };

export function FlapText({ text, width, opts, className }: { text: string; width?: number; opts: FlapOpts; className?: string }) {
  /* the flip writes its frames straight into the text node React owns, so a flip never renders React again */
  const c = useChange(text), raf = useRef(0), el = useRef<HTMLSpanElement>(null);
  const pad = (s: string) => (width ? s.padEnd(width, ' ').slice(0, Math.max(width, s.length)) : s);
  useLayoutEffect(() => {
    if (!c.n || !flips(opts)) return;
    const box = el.current, node = box?.firstChild; if (!box || !node) return;
    const from = pad(c.prev), to = pad(c.v), n = Math.max(from.length, to.length), t0 = performance.now();
    /* a long line still turns within a second: the spread across positions is capped */
    const st = Math.min(opts.stagger, 900 / Math.max(1, n)), end = (n - 1) * st + (opts.flaps + 1) * opts.flipMs;
    opts.onStep?.();
    node.nodeValue = c.prev;
    const frame = () => {
      const e = performance.now() - t0; let s = '';
      for (let i = 0; i < n; i++) {
        const a = from[i] ?? ' ', b = to[i] ?? ' ', k = Math.floor((e - i * st) / opts.flipMs);
        s += a === b ? b : k < 0 ? a : k >= opts.flaps ? b : b === ' ' && k === opts.flaps - 1 ? ' ' : rnd(i, k + c.n);
      }
      node.nodeValue = e >= end ? c.v : s.replace(/\s+$/, '');
      if (e < end) raf.current = requestAnimationFrame(frame);
    };
    raf.current = requestAnimationFrame(frame);
    /* stopped early (unmount or a newer change): show the text React last committed, which the screen-reader copy holds */
    return () => { cancelAnimationFrame(raf.current); node.nodeValue = box.previousElementSibling?.textContent ?? c.v; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a flip starts on a change of the text only
  }, [c.n]);
  const word = opts.mode === 'word';
  return (
    <span className={'fp' + (className ? ' ' + className : '')} data-mode={opts.mode} style={width ? { minWidth: width + 'ch' } : undefined}>
      <span className="sr-only">{text}</span>
      {word ? <span key={c.n} className={'fp-w' + (c.n ? ' fp-in' : '')} aria-hidden="true">{text}</span>
        : <span ref={el} className="fp-c" aria-hidden="true">{text}</span>}
    </span>
  );
}
