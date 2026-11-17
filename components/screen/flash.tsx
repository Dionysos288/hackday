'use client';
import { useState, type ReactNode } from 'react';
import type { ChangeMark } from '@/components/board/config';

/* A change shows in its cell: the value swaps at once, the cell is lit for --bd-hold and fades over --bd-fade. Numbers
   never count up. Not on first draw: only a change seen while the page is open. The mark is the flash, a delta beside
   the value (+12, or a place gained), or both. The lit layer is an opacity on a pseudo-element, so it costs no paint
   of the text. Under reduced motion the cell is not lit; the delta still shows, as text. */

/* the value and how many times it changed since this cell first drew */
export function useChange<T>(v: T): { v: T; prev: T; n: number } {
  const [s, setS] = useState({ v, prev: v, n: 0 });
  if (!Object.is(s.v, v)) { const next = { v, prev: s.v, n: s.n + 1 }; setS(next); return next; }
  return s;
}

export function Flash({ value, mark = 'flash', delta, children, className, as: Tag = 'span' }: {
  value: number | string; mark?: ChangeMark; delta?: (prev: number | string, now: number | string) => string | null;
  children?: ReactNode; className?: string; as?: 'span' | 'td' | 'div';
}) {
  const c = useChange(value);
  const d = c.n && mark !== 'flash' && delta ? delta(c.prev, c.v) : null;
  return (
    <Tag className={'fl' + (className ? ' ' + className : '')}>
      {c.n && mark !== 'delta' ? <i key={c.n} className="fl-lit" aria-hidden="true" /> : null}
      {children ?? value}
      {d ? <span key={'d' + c.n} className="fl-d">{d}</span> : null}
    </Tag>
  );
}

/* the usual delta for a count: +12 */
export function countDelta(a: number | string, b: number | string): string | null {
  const x = Number(b) - Number(a); return x > 0 ? '+' + x : x < 0 ? '−' + -x : null;
}
