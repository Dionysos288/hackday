/* gate.ts: when the day pages open (door-plan.md, D2, decision 15). Before then only the preview page is open; the
   home and the city pages send visitors there. Two inputs: an opening time, and the desk's override.
   - opensAt: set on the event's row; when unset, three hours before the first city's planned start.
   - open: 'auto' follows the time; 'open' and 'closed' are the desk's press, and win over the time.
   Without a backend the same sum runs from the site's config (rule 8). Pure: server and pages share it. */
import { CITIES, EPOCH, SCHED } from './day-data';
import day from '@/saved/day.config.json';

export type Override = 'auto' | 'open' | 'closed';
export type Gate = { open: boolean; opensAt: number; override: Override; why: 'time' | 'desk' };

export const LEAD_MIN = 180;
const startHour = typeof (day as { startHour?: number }).startHour === 'number' ? (day as { startHour: number }).startHour : SCHED.startHour;

/* each city's planned start from the config, ms: 09:00 local on the day */
export const plannedStart = (offsetMin: number) => EPOCH + (startHour * 60 - offsetMin) * 60000;
/* the default opening: three hours before the first city's planned start */
export function defaultOpensAt(starts?: number[]): number {
  const s = starts && starts.length ? starts : CITIES.map((c) => plannedStart(c.offset));
  return Math.min(...s) - LEAD_MIN * 60000;
}

export function gateAt(now: number, opensAt: number, override: Override = 'auto'): Gate {
  if (override === 'open') return { open: true, opensAt, override, why: 'desk' };
  if (override === 'closed') return { open: false, opensAt, override, why: 'desk' };
  return { open: now >= opensAt, opensAt, override, why: 'time' };
}
