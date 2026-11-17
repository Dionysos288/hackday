/* format.ts: how times, counts and countdowns are written. Pure. */

/* a non-breaking space between a number and its unit */
export const NB = ' ';

export const r2 = (n: number): number => Math.round(n * 100) / 100;
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

/* 24-hour, zero-padded, wrapped to the day */
export function hhmm(m: number): string { m = ((Math.round(m) % 1440) + 1440) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
export function tz(off: number): string { if (!off) return 'UTC'; const s = off < 0 ? '−' : '+', a = Math.abs(off); return 'UTC' + s + Math.floor(a / 60) + (a % 60 ? ':' + String(a % 60).padStart(2, '0') : ''); }
export function fmtN(n: number): string { return Number(n).toLocaleString('en-US'); }
export function ord(n: number): string { return n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th'); }

/* the home writes counts as they are ("1204 votes"); a city page groups thousands ("1,204 votes") */
export function plural(n: number, w: string): string { return n + NB + w + (n === 1 ? '' : 's'); }
export function pluralN(n: number, w: string, pl?: string): string { return fmtN(n) + NB + (n === 1 ? w : (pl || w + 's')); }

/* a countdown: zero units drop; a day or more is said in days and hours. grouped: the city page's numbers. */
export function dur(min: number, short?: boolean, grouped?: boolean): string {
  const pl = grouped ? (n: number, w: string) => pluralN(n, w) : plural;
  min = Math.max(1, Math.round(min));
  if (min >= 1440) { const d = Math.floor(min / 1440), dh = Math.floor((min % 1440) / 60); return short ? d + NB + 'd' + (dh ? ' ' + dh + NB + 'h' : '') : pl(d, 'day') + (dh ? ' ' + pl(dh, 'hour') : ''); }
  const h = Math.floor(min / 60), m = min % 60;
  if (short) return (h ? h + NB + 'h' : '') + (h && m ? ' ' : '') + (m ? m + NB + 'min' : '');
  return (h ? pl(h, 'hour') : '') + (h && m ? ' ' : '') + (m ? pl(m, 'minute') : '');
}
