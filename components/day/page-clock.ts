'use client';
import { useEffect } from 'react';
import { realMinute } from '@/lib/clock';
import type { DayClock } from '@/components/board/clock';

/* The real pages' clock: it follows the real time, and after the tab has been hidden it comes back at the real time,
   not where it stopped. A page moved by the URL (?moment=, ?m=, ?t=) or stopped (?still=1) keeps its own time. Returns
   whether the URL moved it, so links can carry the same moment to the next page. */
export function useRealClock(clock: DayClock, real: boolean, q: Record<string, string | undefined>): boolean {
  const moved = !!(q.moment || q.t || q.m), still = q.still === '1';
  useEffect(() => {
    if (!real || moved || still) return;
    const on = () => { if (!document.hidden) clock.set(realMinute(Date.now())); };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [clock, real, moved, still]);
  return moved;
}

/* a query string from the keys that have a value ('' writes the bare key, as in ?admin) */
export function pageQuery(o: Record<string, string | null>): string {
  const p = Object.entries(o).filter(([, v]) => v != null).map(([k, v]) => (v === '' ? k : k + '=' + encodeURIComponent(v as string)));
  return p.length ? '?' + p.join('&') : '';
}
