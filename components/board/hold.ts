'use client';
import { useRef, useState, type FocusEvent, type PointerEvent } from 'react';

/* A board holds still while someone is reading it: while a mouse is over it or focus is inside it, it keeps showing
   what it showed when they arrived, and catches up on the next tick after they leave. A finger does not hold it (a tap
   has no "leave"), so on a phone the board moves only on its tick. */
export function useHold<T>(value: T): { shown: T; held: boolean; props: {
  onPointerEnter: (e: PointerEvent) => void; onPointerLeave: (e: PointerEvent) => void; onFocus: (e: FocusEvent) => void; onBlur: (e: FocusEvent) => void;
} } {
  const [frozen, setFrozen] = useState<{ v: T } | null>(null), over = useRef(false), inside = useRef(false);
  const hold = () => setFrozen((f) => f ?? { v: value });
  const free = () => { if (!over.current && !inside.current) setFrozen(null); };
  return {
    shown: frozen ? frozen.v : value,
    held: !!frozen,
    props: {
      onPointerEnter: (e) => { if (e.pointerType === 'touch') return; over.current = true; hold(); },
      onPointerLeave: (e) => { if (e.pointerType === 'touch') return; over.current = false; free(); },
      /* focus a press leaves behind (a click or a tap on a button) does not hold; keyboard focus does */
      onFocus: (e) => { if (!(e.target as Element).matches?.(':focus-visible')) return; inside.current = true; hold(); },
      onBlur: (e) => { if (e.currentTarget.contains(e.relatedTarget as Node | null)) return; inside.current = false; free(); },
    },
  };
}
