/* clock.ts: the pages follow the real clock. For checking, the URL can move it (it then keeps running from there):
   ?moment= or ?t= on either page, ?still=1 to stop it. Pure: the caller passes the current time. */
import { EPOCH } from './day-data';

export type Query = Record<string, string | string[] | undefined>;
export function param(q: Query, k: string): string | null { const v = q[k]; return v == null ? null : Array.isArray(v) ? (v[0] ?? null) : v; }

/* at: the minute on screen when the page was drawn; preview: the URL moved the clock; still: it does not run */
export type ClockInit = { at: number; preview: boolean; still: boolean };
export function realMinute(ms: number): number { return (ms - EPOCH) / 60000; }

/* the clock from the URL: a named moment (resolved by the page's own moment list), else ?t= through toMinute,
   else the real minute */
export function clockFrom(q: Query, nowMs: number, momentT: (id: string) => number | null, toMinute: (t: number) => number): ClockInit {
  let at: number | null = null;
  const mm = param(q, 'moment'), t = param(q, 't');
  if (mm) { const mt = momentT(mm); if (mt != null) at = toMinute(mt); }
  if (at == null && t != null && t !== '' && isFinite(+t)) at = toMinute(+t);
  const preview = at != null;
  return { at: at == null ? realMinute(nowMs) : at, preview, still: param(q, 'still') === '1' };
}
